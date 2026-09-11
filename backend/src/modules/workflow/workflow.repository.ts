import type { Pool, PoolClient } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import type { Appointment, QueueEntry, QueueStation, TriageWrite, Visit, VisitBoardItem, VisitPriority } from "./workflow.types";

const VISIT_SELECT = `
  select v.id, v.visit_number, v.patient_id, p.medical_record_number,
    concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
    v.appointment_id, v.doctor_id, d.full_name as doctor_name, v.kind, v.reason,
    v.status, v.priority, v.checked_in_at, v.completed_at,
    case when q.id is null then null else jsonb_build_object(
      'id', q.id, 'visit_id', q.visit_id, 'visit_number', v.visit_number,
      'patient_id', p.id, 'medical_record_number', p.medical_record_number,
      'patient_name', concat_ws(' ', p.first_name, p.middle_name, p.last_name),
      'station', q.station, 'status', q.status, 'priority', q.priority,
      'assigned_user_id', q.assigned_user_id, 'queued_at', q.queued_at,
      'called_at', q.called_at, 'service_started_at', q.service_started_at,
      'wait_minutes', greatest(0, floor(extract(epoch from (now() - q.queued_at)) / 60))::int
    ) end as active_queue
  from clinic.visits v
  join clinic.patients p on p.id = v.patient_id
  left join clinic.users d on d.id = v.doctor_id
  left join lateral (
    select qe.* from clinic.queue_entries qe where qe.visit_id = v.id
      and qe.status in ('waiting', 'called', 'in_service')
    order by qe.queued_at desc limit 1
  ) q on true
`;

const VISIT_BOARD_FROM = `
  from clinic.visits v
  join clinic.patients p on p.id = v.patient_id
  left join clinic.users d on d.id = v.doctor_id
  left join lateral (
    select qe.* from clinic.queue_entries qe where qe.visit_id = v.id
      and qe.status in ('waiting', 'called', 'in_service')
    order by qe.queued_at desc limit 1
  ) q on true`;

const VISIT_BOARD_COLUMNS = `
  v.id, v.visit_number, v.patient_id, p.medical_record_number,
  concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
  v.appointment_id, v.doctor_id, d.full_name as doctor_name, v.kind, v.reason,
  v.status, v.priority, v.checked_in_at, v.completed_at,
  case when q.id is null then null else jsonb_build_object(
    'id', q.id, 'visit_id', q.visit_id, 'visit_number', v.visit_number,
    'patient_id', p.id, 'medical_record_number', p.medical_record_number,
    'patient_name', concat_ws(' ', p.first_name, p.middle_name, p.last_name),
    'station', q.station, 'status', q.status, 'priority', q.priority,
    'assigned_user_id', q.assigned_user_id, 'queued_at', q.queued_at,
    'called_at', q.called_at, 'service_started_at', q.service_started_at,
    'wait_minutes', greatest(0, floor(extract(epoch from (now() - q.queued_at)) / 60))::int
  ) end as active_queue,
  p.date_of_birth::text as patient_date_of_birth,
  p.sex as patient_sex,
  greatest(0, floor(extract(epoch from (now() - v.checked_in_at)) / 60))::int as wait_minutes`;

function visitBoardSelect(): string {
  return `select ${VISIT_BOARD_COLUMNS}${VISIT_BOARD_FROM}`;
}

export class WorkflowRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async createAppointment(
    input: { patientId: string; doctorId?: string; scheduledAt: string; durationMinutes: number; reason: string; notes?: string },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<Appointment> {
    return withTransaction(this.pool, async (client) => {
      await requireActivePatient(client, input.patientId);
      if (input.doctorId) await requireDoctor(client, input.doctorId);
      const created = await client.query<{ id: string }>(
        `insert into clinic.appointments
          (patient_id, doctor_id, scheduled_at, duration_minutes, reason, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [input.patientId, input.doctorId ?? null, input.scheduledAt, input.durationMinutes,
          input.reason, input.notes ?? null, actorUserId],
      );
      const appointment = (await this.findAppointment(created.rows[0]!.id, client))!;
      await this.audit.record({ ...event, resourceId: appointment.id, afterData: appointment }, client);
      return appointment;
    });
  }

  async listAppointments(from: string, to: string, doctorId: string | undefined, limit: number): Promise<Appointment[]> {
    const result = await this.pool.query<Appointment>(
      `select a.id, a.patient_id, p.medical_record_number,
         concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
         a.doctor_id, d.full_name as doctor_name, a.scheduled_at, a.duration_minutes,
         a.reason, a.status, a.notes, a.created_at
       from clinic.appointments a
       join clinic.patients p on p.id = a.patient_id
       left join clinic.users d on d.id = a.doctor_id
       where a.scheduled_at >= $1 and a.scheduled_at < $2
         and ($3::uuid is null or a.doctor_id = $3)
       order by a.scheduled_at, a.id limit $4`,
      [from, to, doctorId ?? null, limit],
    );
    return result.rows;
  }

  async cancelAppointment(appointmentId: string, actorUserId: string, reason: string, event: AuditEventInput): Promise<Appointment> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findAppointment(appointmentId, client, true);
      if (!before) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment was not found");
      if (!['scheduled', 'confirmed'].includes(before.status)) {
        throw new AppError(409, "APPOINTMENT_NOT_CANCELLABLE", "Only scheduled appointments can be cancelled");
      }
      await client.query(
        `update clinic.appointments set status='cancelled', cancelled_by=$2,
          cancelled_at=now(), cancellation_reason=$3, updated_at=now() where id=$1`,
        [appointmentId, actorUserId, reason],
      );
      const after = (await this.findAppointment(appointmentId, client))!;
      await this.audit.record({ ...event, resourceId: appointmentId, beforeData: before, afterData: after }, client);
      return after;
    });
  }

  async checkIn(
    input: { patientId: string; appointmentId?: string; doctorId?: string; kind: string; reason: string; priority: VisitPriority },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      await requireActivePatient(client, input.patientId, true);
      if (input.doctorId) await requireDoctor(client, input.doctorId);
      if (input.appointmentId) {
        const appointment = await client.query<{ patient_id: string; doctor_id: string | null; status: string }>(
          "select patient_id, doctor_id, status from clinic.appointments where id=$1 for update",
          [input.appointmentId],
        );
        const row = appointment.rows[0];
        if (!row) throw new AppError(404, "APPOINTMENT_NOT_FOUND", "Appointment was not found");
        if (row.patient_id !== input.patientId) throw new AppError(409, "APPOINTMENT_PATIENT_MISMATCH", "Appointment belongs to another patient");
        if (!['scheduled', 'confirmed'].includes(row.status)) throw new AppError(409, "APPOINTMENT_ALREADY_PROCESSED", "Appointment is not available for check-in");
        if (input.doctorId && row.doctor_id && input.doctorId !== row.doctor_id) {
          throw new AppError(409, "APPOINTMENT_DOCTOR_MISMATCH", "Selected doctor differs from the appointment doctor");
        }
        await client.query("update clinic.appointments set status='checked_in', updated_at=now() where id=$1", [input.appointmentId]);
        input.doctorId ??= row.doctor_id ?? undefined;
      }
      const initialStatus = input.doctorId ? "awaiting_doctor" : "awaiting_triage";
      const created = await client.query<{ id: string }>(
        `insert into clinic.visits
          (patient_id, appointment_id, doctor_id, receptionist_id, kind, reason, status, priority)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [input.patientId, input.appointmentId ?? null, input.doctorId ?? null, actorUserId,
          input.kind, input.reason, initialStatus, input.priority],
      );
      const visitId = created.rows[0]!.id;
      if (input.doctorId) {
        await createQueueEntry(client, visitId, "doctor", input.priority, actorUserId);
      } else {
        await createQueueEntry(client, visitId, "triage", input.priority, actorUserId);
      }
      const visit = (await this.findVisit(visitId, client))!;
      await this.audit.record({ ...event, resourceId: visit.id, afterData: visit }, client);
      return visit;
    });
  }

  async findVisit(visitId: string, database: Queryable = this.pool): Promise<Visit | null> {
    const result = await database.query<Visit>(`${VISIT_SELECT} where v.id = $1`, [visitId]);
    return result.rows[0] ?? null;
  }

  async findActiveVisitByPatient(patientId: string): Promise<Visit | null> {
    const result = await this.pool.query<Visit>(
      `${VISIT_SELECT}
       where v.patient_id = $1
         and v.status not in ('completed', 'billed', 'cancelled')
       order by v.checked_in_at desc, v.id desc
       limit 1`,
      [patientId],
    );
    return result.rows[0] ?? null;
  }

  async assignDoctor(
    visitId: string,
    doctorId: string | null,
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findVisit(visitId, client);
      if (!before) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (["completed", "billed", "cancelled"].includes(before.status)) {
        throw new AppError(409, "VISIT_NOT_ASSIGNABLE", "Doctor cannot be changed on a closed visit");
      }
      if (!["awaiting_triage", "awaiting_doctor"].includes(before.status)) {
        throw new AppError(
          409,
          "VISIT_DOCTOR_LOCKED",
          "Doctor cannot be changed after consultation has started",
        );
      }
      if (doctorId) await requireDoctor(client, doctorId);
      await client.query(
        "update clinic.visits set doctor_id=$2, updated_at=now() where id=$1",
        [visitId, doctorId],
      );
      if (doctorId) {
        const current = await client.query<{ status: string; priority: VisitPriority }>(
          "select status, priority from clinic.visits where id=$1",
          [visitId],
        );
        const row = current.rows[0]!;
        if (row.status === "awaiting_triage") {
          await routeVisitToDoctorQueue(client, visitId, row.priority, actorUserId, "Doctor assigned at front desk");
        } else {
          await ensureDoctorQueueEntry(client, visitId, row.priority, actorUserId);
        }
      }
      const after = (await this.findVisit(visitId, client))!;
      await this.audit.record({ ...event, resourceId: visitId, beforeData: before, afterData: after }, client);
      return after;
    });
  }

  async listVisitsForDoctor(doctorId: string, limit: number, scope: "today" | "all" = "today"): Promise<VisitBoardItem[]> {
    await this.pool.query(
      `update clinic.visits v
       set status = 'in_consultation', cancelled_at = null, cancellation_reason = null, updated_at = now()
       where v.doctor_id = $1
         and v.status = 'cancelled'
         and exists (
           select 1 from clinic.encounters e where e.visit_id = v.id and e.status = 'open'
         )
         and not exists (
           select 1 from clinic.diagnostic_orders o
           where o.visit_id = v.id and o.status not in ('cancelled', 'reviewed')
         )
         and exists (
           select 1 from clinic.queue_entries q
           where q.visit_id = v.id and q.station = 'doctor' and q.status in ('waiting', 'called', 'in_service')
         )`,
      [doctorId],
    );

    const select = visitBoardSelect();

    if (scope === "today") {
      const result = await this.pool.query<VisitBoardItem>(
        `${select}
         where v.doctor_id = $1
           and v.kind = 'consultation'
           and v.status <> 'cancelled'
           and (
             v.checked_in_at >= current_date
             or v.status in (
               'in_consultation', 'awaiting_lab', 'lab_complete', 'awaiting_doctor', 'awaiting_triage',
               'ready_for_billing', 'medication_prescribed', 'billed', 'completed'
             )
           )
         order by v.checked_in_at desc, v.id
         limit $2`,
        [doctorId, limit],
      );
      return result.rows;
    }

    const result = await this.pool.query<VisitBoardItem>(
      `select * from (
         select distinct on (v.patient_id) ${VISIT_BOARD_COLUMNS}
         ${VISIT_BOARD_FROM}
         where v.doctor_id = $1
           and v.kind = 'consultation'
           and v.status <> 'cancelled'
         order by v.patient_id, v.checked_in_at desc, v.id desc
       ) latest
       order by latest.checked_in_at desc, latest.id desc
       limit $2`,
      [doctorId, limit],
    );
    return result.rows;
  }

  async listQueue(station: QueueStation, status: string | undefined, limit: number): Promise<QueueEntry[]> {
    const result = await this.pool.query<QueueEntry>(
      `select q.id, q.visit_id, v.visit_number, v.patient_id, p.medical_record_number,
         concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
         v.doctor_id, d.full_name as doctor_name,
         q.station, q.status, q.priority, q.assigned_user_id, q.queued_at,
         q.called_at, q.service_started_at,
         greatest(0, floor(extract(epoch from (now() - q.queued_at)) / 60))::int as wait_minutes
       from clinic.queue_entries q
       join clinic.visits v on v.id = q.visit_id
       join clinic.patients p on p.id = v.patient_id
       left join clinic.users d on d.id = v.doctor_id
       where q.station=$1 and q.status = coalesce($2, q.status)
         and q.status in ('waiting','called','in_service')
         and (
           q.station <> 'billing'
           or (
             v.status not in ('billed','completed','cancelled')
             and not exists (
               select 1 from clinic.invoices i
               where i.visit_id = v.id and i.status = 'paid'
             )
           )
         )
       order by case q.priority when 'emergency' then 1 when 'urgent' then 2 else 3 end,
         q.queued_at, q.id limit $3`,
      [station, status ?? null, limit],
    );
    return result.rows;
  }

  async transitionQueue(
    queueEntryId: string,
    action: "call" | "start" | "cancel",
    notes: string | undefined,
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<QueueEntry> {
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ id: string; status: string }>(
        "select id, status from clinic.queue_entries where id=$1 for update",
        [queueEntryId],
      );
      const row = current.rows[0];
      if (!row) throw new AppError(404, "QUEUE_ENTRY_NOT_FOUND", "Queue entry was not found");
      const next = nextQueueStatus(row.status, action);
      const timestampColumn = next === 'called' ? 'called_at' : next === 'in_service' ? 'service_started_at' : 'completed_at';
      await client.query(
        `update clinic.queue_entries set status=$2, assigned_user_id=coalesce(assigned_user_id,$3),
           ${timestampColumn}=now(), updated_at=now() where id=$1`,
        [queueEntryId, next, actorUserId],
      );
      await client.query(
        `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
         values ($1,$2,$3,$4,$5)`,
        [queueEntryId, row.status, next, actorUserId, notes ?? null],
      );
      const after = await findQueueEntry(client, queueEntryId);
      await this.audit.record({ ...event, resourceId: queueEntryId, beforeData: row, afterData: after }, client);
      return after;
    });
  }

  async recordTriage(visitId: string, input: TriageWrite, actorUserId: string, event: AuditEventInput): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      const visit = await client.query<{ id: string; status: string; priority: VisitPriority }>(
        "select id, status, priority from clinic.visits where id=$1 for update",
        [visitId],
      );
      const current = visit.rows[0];
      if (!current) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (current.status !== 'awaiting_triage') throw new AppError(409, "TRIAGE_NOT_AVAILABLE", "Visit is not awaiting triage");
      await upsertTriageObservations(client, visitId, input, actorUserId);
      const activeQueue = await client.query<{ id: string; status: string }>(
        `select id, status from clinic.queue_entries where visit_id=$1 and station='triage'
         and status in ('waiting','called','in_service') for update`,
        [visitId],
      );
      if (!activeQueue.rows[0]) throw new AppError(409, "TRIAGE_QUEUE_MISSING", "Active triage queue entry was not found");
      await completeQueueEntry(client, activeQueue.rows[0], actorUserId, "Triage completed");
      await client.query("update clinic.visits set status='awaiting_doctor', updated_at=now() where id=$1", [visitId]);
      await createQueueEntry(client, visitId, "doctor", current.priority, actorUserId);
      const after = (await this.findVisit(visitId, client))!;
      await this.audit.record({ ...event, resourceId: visitId, afterData: { triage: input, visit: after } }, client);
      return after;
    });
  }

  async saveVitals(visitId: string, input: TriageWrite, actorUserId: string, event: AuditEventInput): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      const visit = await client.query<{ id: string; status: string }>(
        "select id, status from clinic.visits where id=$1 for update",
        [visitId],
      );
      const current = visit.rows[0];
      if (!current) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (!["awaiting_triage", "awaiting_doctor", "in_consultation"].includes(current.status)) {
        throw new AppError(409, "VITALS_NOT_EDITABLE", "Vitals cannot be updated for this visit");
      }
      await upsertTriageObservations(client, visitId, input, actorUserId);
      const after = (await this.findVisit(visitId, client))!;
      await this.audit.record({ ...event, resourceId: visitId, afterData: { triage: input, visit: after } }, client);
      return after;
    });
  }

  async sendToDoctor(visitId: string, actorUserId: string, event: AuditEventInput): Promise<Visit> {
    return withTransaction(this.pool, async (client) => {
      const visit = await client.query<{ id: string; status: string; priority: VisitPriority; doctor_id: string | null }>(
        "select id, status, priority, doctor_id from clinic.visits where id=$1 for update",
        [visitId],
      );
      const current = visit.rows[0];
      if (!current) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (current.status !== "awaiting_triage") {
        throw new AppError(409, "SEND_TO_DOCTOR_UNAVAILABLE", "Visit is not waiting in triage");
      }
      if (!current.doctor_id) {
        throw new AppError(409, "DOCTOR_NOT_ASSIGNED", "Assign a doctor before sending the patient to consultation");
      }
      const activeQueue = await client.query<{ id: string; status: string }>(
        `select id, status from clinic.queue_entries where visit_id=$1 and station='triage'
         and status in ('waiting','called','in_service') for update`,
        [visitId],
      );
      if (!activeQueue.rows[0]) throw new AppError(409, "TRIAGE_QUEUE_MISSING", "Active triage queue entry was not found");
      await routeVisitToDoctorQueue(client, visitId, current.priority, actorUserId, "Sent to doctor from triage");
      const after = (await this.findVisit(visitId, client))!;
      await this.audit.record({ ...event, resourceId: visitId, afterData: after }, client);
      return after;
    });
  }

  private async findAppointment(id: string, database: Queryable, lock = false): Promise<Appointment | null> {
    const result = await database.query<Appointment>(
      `select a.id, a.patient_id, p.medical_record_number,
         concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
         a.doctor_id, d.full_name as doctor_name, a.scheduled_at, a.duration_minutes,
         a.reason, a.status, a.notes, a.created_at
       from clinic.appointments a join clinic.patients p on p.id=a.patient_id
       left join clinic.users d on d.id=a.doctor_id where a.id=$1 ${lock ? 'for update of a' : ''}`,
      [id],
    );
    return result.rows[0] ?? null;
  }
}

async function requireActivePatient(database: Queryable, patientId: string, lock = false): Promise<void> {
  const result = await database.query(
    `select id from clinic.patients where id=$1 and active=true ${lock ? 'for update' : ''}`,
    [patientId],
  );
  if (!result.rowCount) throw new AppError(404, "PATIENT_NOT_FOUND", "Active patient was not found");
}

async function requireDoctor(database: Queryable, doctorId: string): Promise<void> {
  const result = await database.query(
    `select u.id from clinic.users u join clinic.user_roles ur on ur.user_id=u.id
     join clinic.roles r on r.id=ur.role_id where u.id=$1 and u.status='active' and r.slug='doctor'`,
    [doctorId],
  );
  if (!result.rowCount) throw new AppError(400, "DOCTOR_INVALID", "Selected doctor is not an active doctor");
}

async function upsertTriageObservations(
  client: PoolClient,
  visitId: string,
  input: TriageWrite,
  actorUserId: string,
): Promise<void> {
  await client.query(
    `insert into clinic.triage_observations (
      visit_id, recorded_by, temperature_c, systolic_bp, diastolic_bp, pulse_bpm,
      respiratory_rate, oxygen_saturation, weight_kg, height_cm, pain_score, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict (visit_id) do update set recorded_by=excluded.recorded_by,
      temperature_c=coalesce(excluded.temperature_c, clinic.triage_observations.temperature_c),
      systolic_bp=coalesce(excluded.systolic_bp, clinic.triage_observations.systolic_bp),
      diastolic_bp=coalesce(excluded.diastolic_bp, clinic.triage_observations.diastolic_bp),
      pulse_bpm=coalesce(excluded.pulse_bpm, clinic.triage_observations.pulse_bpm),
      respiratory_rate=coalesce(excluded.respiratory_rate, clinic.triage_observations.respiratory_rate),
      oxygen_saturation=coalesce(excluded.oxygen_saturation, clinic.triage_observations.oxygen_saturation),
      weight_kg=coalesce(excluded.weight_kg, clinic.triage_observations.weight_kg),
      height_cm=coalesce(excluded.height_cm, clinic.triage_observations.height_cm),
      pain_score=coalesce(excluded.pain_score, clinic.triage_observations.pain_score),
      notes=coalesce(excluded.notes, clinic.triage_observations.notes), updated_at=now()`,
    [visitId, actorUserId, input.temperatureC ?? null, input.systolicBp ?? null,
      input.diastolicBp ?? null, input.pulseBpm ?? null, input.respiratoryRate ?? null,
      input.oxygenSaturation ?? null, input.weightKg ?? null, input.heightCm ?? null,
      input.painScore ?? null, input.notes ?? null],
  );
}

async function ensureDoctorQueueEntry(
  client: PoolClient,
  visitId: string,
  priority: VisitPriority,
  actorUserId: string,
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    `select id from clinic.queue_entries where visit_id=$1 and station='doctor'
     and status in ('waiting','called','in_service') limit 1`,
    [visitId],
  );
  if (!existing.rows[0]) {
    await createQueueEntry(client, visitId, "doctor", priority, actorUserId);
  }
}

async function routeVisitToDoctorQueue(
  client: PoolClient,
  visitId: string,
  priority: VisitPriority,
  actorUserId: string,
  notes: string,
): Promise<void> {
  const triageQueue = await client.query<{ id: string; status: string }>(
    `select id, status from clinic.queue_entries where visit_id=$1 and station='triage'
     and status in ('waiting','called','in_service') for update`,
    [visitId],
  );
  if (triageQueue.rows[0]) {
    await completeQueueEntry(client, triageQueue.rows[0], actorUserId, notes);
  }
  await client.query(
    `insert into clinic.triage_observations (visit_id, recorded_by, notes)
     values ($1,$2,$3)
     on conflict (visit_id) do nothing`,
    [visitId, actorUserId, notes],
  );
  await client.query("update clinic.visits set status='awaiting_doctor', updated_at=now() where id=$1", [visitId]);
  await ensureDoctorQueueEntry(client, visitId, priority, actorUserId);
}

async function createQueueEntry(
  client: PoolClient,
  visitId: string,
  station: QueueStation,
  priority: VisitPriority,
  actorUserId: string,
): Promise<string> {
  const created = await client.query<{ id: string }>(
    "insert into clinic.queue_entries (visit_id, station, priority) values ($1,$2,$3) returning id",
    [visitId, station, priority],
  );
  await client.query(
    `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id)
     values ($1,null,'waiting',$2)`,
    [created.rows[0]!.id, actorUserId],
  );
  return created.rows[0]!.id;
}

async function completeQueueEntry(
  client: PoolClient,
  entry: { id: string; status: string },
  actorUserId: string,
  notes: string,
): Promise<void> {
  await client.query(
    "update clinic.queue_entries set status='completed', completed_at=now(), updated_at=now() where id=$1",
    [entry.id],
  );
  await client.query(
    `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
     values ($1,$2,'completed',$3,$4)`,
    [entry.id, entry.status, actorUserId, notes],
  );
}

function nextQueueStatus(current: string, action: "call" | "start" | "cancel"): string {
  if (action === 'call' && current === 'waiting') return 'called';
  if (action === 'start' && ['waiting', 'called'].includes(current)) return 'in_service';
  if (action === 'cancel' && ['waiting', 'called', 'in_service'].includes(current)) return 'cancelled';
  throw new AppError(409, "QUEUE_TRANSITION_INVALID", `Cannot ${action} a queue entry in ${current} state`);
}

async function findQueueEntry(database: Queryable, queueEntryId: string): Promise<QueueEntry> {
  const result = await database.query<QueueEntry>(
    `select q.id, q.visit_id, v.visit_number, v.patient_id, p.medical_record_number,
       concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
       v.doctor_id, d.full_name as doctor_name,
       q.station, q.status, q.priority, q.assigned_user_id, q.queued_at,
       q.called_at, q.service_started_at,
       greatest(0, floor(extract(epoch from (now() - q.queued_at)) / 60))::int as wait_minutes
     from clinic.queue_entries q join clinic.visits v on v.id=q.visit_id
     join clinic.patients p on p.id=v.patient_id
     left join clinic.users d on d.id = v.doctor_id
     where q.id=$1`,
    [queueEntryId],
  );
  if (!result.rows[0]) throw new AppError(404, "QUEUE_ENTRY_NOT_FOUND", "Queue entry was not found");
  return result.rows[0];
}
