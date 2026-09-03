import type { Pool, PoolClient } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import { enqueueBillingIfNeeded } from "../workflow/queue-helpers";

export type TreatmentCourse = {
  id: string;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  catalog_item_id: string;
  procedure_name: string;
  unit_price: string;
  total_doses: number;
  start_date: string;
  billing_mode: "per_dose" | "package";
  status: "active" | "completed" | "cancelled";
  notes: string | null;
  created_by: string;
  created_at: Date;
  completed_at: Date | null;
  doses: Array<Record<string, unknown>>;
};

type DoseLock = {
  id: string;
  course_id: string;
  patient_id: string;
  catalog_item_id: string;
  procedure_name: string;
  total_doses: number;
  course_status: string;
  dose_number: number;
  scheduled_date: string;
  dose_status: string;
  visit_id: string | null;
};

const COURSE_SELECT = `
  select c.id, c.patient_id, p.medical_record_number,
    concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
    c.catalog_item_id, c.procedure_name, c.unit_price::text, c.total_doses,
    c.start_date::text, c.billing_mode, c.status, c.notes, c.created_by,
    c.created_at, c.completed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'dose_number', d.dose_number,
        'scheduled_date', d.scheduled_date, 'status', d.status,
        'visit_id', d.visit_id, 'checked_in_at', d.checked_in_at,
        'given_at', d.given_at, 'given_by', d.given_by,
        'clinical_notes', d.clinical_notes, 'missed_reason', d.missed_reason
      ) order by d.dose_number)
      from clinic.treatment_course_doses d where d.course_id = c.id
    ), '[]'::jsonb) as doses
  from clinic.treatment_courses c
  join clinic.patients p on p.id = c.patient_id`;

export class TreatmentRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async create(
    input: {
      patientId: string;
      catalogItemId: string;
      totalDoses: number;
      startDate: string;
      billingMode: "per_dose" | "package";
      notes?: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<TreatmentCourse> {
    return withTransaction(this.pool, async (client) => {
      const patient = await client.query("select id from clinic.patients where id=$1 and active=true", [input.patientId]);
      if (!patient.rowCount) throw new AppError(404, "PATIENT_NOT_FOUND", "Active patient was not found");

      const catalog = await client.query<{ name: string; price: string }>(
        "select name, price::text from clinic.catalog_items where id=$1 and item_type='procedure' and active=true",
        [input.catalogItemId],
      );
      const procedure = catalog.rows[0];
      if (!procedure) throw new AppError(400, "PROCEDURE_INVALID", "Select an active procedure from the catalog");

      const created = await client.query<{ id: string }>(
        `insert into clinic.treatment_courses
          (patient_id, catalog_item_id, procedure_name, unit_price, total_doses, start_date, billing_mode, notes, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [input.patientId, input.catalogItemId, procedure.name, procedure.price, input.totalDoses,
          input.startDate, input.billingMode, input.notes ?? null, actorUserId],
      );
      const courseId = created.rows[0]!.id;
      await client.query(
        `insert into clinic.treatment_course_doses (course_id, dose_number, scheduled_date)
         select $1, n, $2::date + (n - 1) from generate_series(1, $3::int) as n`,
        [courseId, input.startDate, input.totalDoses],
      );
      await client.query(
        `insert into clinic.notifications
          (recipient_user_id, kind, title, message, resource_type, resource_id, available_at)
         select $1, 'course.dose_due', 'Treatment dose due',
           $2 || ' · dose ' || d.dose_number || ' of ' || $3,
           'treatment_course', $4, d.scheduled_date::timestamptz + interval '6 hours'
         from clinic.treatment_course_doses d where d.course_id=$4`,
        [actorUserId, procedure.name, input.totalDoses, courseId],
      );
      const course = (await this.find(courseId, client))!;
      await this.audit.record({ ...event, resourceId: courseId, afterData: course }, client);
      return course;
    });
  }

  async list(patientId: string | undefined, status: string | undefined, limit: number): Promise<TreatmentCourse[]> {
    const result = await this.pool.query<TreatmentCourse>(
      `${COURSE_SELECT}
       where ($1::uuid is null or c.patient_id=$1)
         and ($2::text is null or c.status=$2)
       order by c.created_at desc, c.id desc limit $3`,
      [patientId ?? null, status ?? null, limit],
    );
    return result.rows;
  }

  async find(id: string, database: Queryable = this.pool): Promise<TreatmentCourse | null> {
    const result = await database.query<TreatmentCourse>(`${COURSE_SELECT} where c.id=$1`, [id]);
    return result.rows[0] ?? null;
  }

  async checkInDose(courseId: string, doseId: string, actorUserId: string, event: AuditEventInput): Promise<TreatmentCourse> {
    return withTransaction(this.pool, async (client) => {
      const dose = await lockDose(client, courseId, doseId);
      if (dose.course_status !== "active") throw new AppError(409, "COURSE_NOT_ACTIVE", "Treatment course is not active");
      if (dose.dose_status !== "scheduled") throw new AppError(409, "DOSE_NOT_AVAILABLE", "Only a scheduled dose can be checked in");
      const tooEarly = await client.query<{ too_early: boolean }>(
        "select $1::date > current_date + 1 as too_early",
        [dose.scheduled_date],
      );
      if (tooEarly.rows[0]?.too_early) throw new AppError(409, "DOSE_TOO_EARLY", "Dose check-in is available from one day before its scheduled date");

      const visit = await client.query<{ id: string }>(
        `insert into clinic.visits
          (patient_id, receptionist_id, kind, reason, status, priority)
         values ($1,$2,'procedure',$3,'registered','routine') returning id`,
        [dose.patient_id, actorUserId, `${dose.procedure_name} · dose ${dose.dose_number} of ${dose.total_doses}`],
      );
      const visitId = visit.rows[0]!.id;
      const queue = await client.query<{ id: string }>(
        "insert into clinic.queue_entries (visit_id, station, priority) values ($1,'procedure','routine') returning id",
        [visitId],
      );
      await client.query(
        "insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes) values ($1,null,'waiting',$2,'Treatment dose checked in')",
        [queue.rows[0]!.id, actorUserId],
      );
      await client.query(
        `update clinic.treatment_course_doses set status='checked_in', visit_id=$3,
           checked_in_by=$4, checked_in_at=now(), updated_at=now()
         where course_id=$1 and id=$2`,
        [courseId, doseId, visitId, actorUserId],
      );
      const course = (await this.find(courseId, client))!;
      await this.audit.record({ ...event, resourceId: doseId, beforeData: dose, afterData: course }, client);
      return course;
    });
  }

  async administerDose(courseId: string, doseId: string, notes: string | undefined, actorUserId: string, event: AuditEventInput): Promise<TreatmentCourse> {
    return withTransaction(this.pool, async (client) => {
      const dose = await lockDose(client, courseId, doseId);
      if (dose.course_status !== "active" || dose.dose_status !== "checked_in" || !dose.visit_id) {
        throw new AppError(409, "DOSE_NOT_READY", "Dose must be checked in before administration");
      }
      const activeQueue = await client.query<{ id: string; status: string }>(
        `select id, status from clinic.queue_entries where visit_id=$1 and station='procedure'
         and status in ('waiting','called','in_service') for update`,
        [dose.visit_id],
      );
      const entry = activeQueue.rows[0];
      if (!entry) throw new AppError(409, "PROCEDURE_QUEUE_MISSING", "Active procedure queue entry was not found");

      await client.query(
        `insert into clinic.procedure_administrations
          (treatment_course_dose_id, visit_id, patient_id, catalog_item_id, performed_by, notes)
         values ($1,$2,$3,$4,$5,$6)`,
        [doseId, dose.visit_id, dose.patient_id, dose.catalog_item_id, actorUserId, notes ?? null],
      );
      await client.query(
        `update clinic.treatment_course_doses set status='given', given_by=$3,
           given_at=now(), clinical_notes=$4, updated_at=now() where course_id=$1 and id=$2`,
        [courseId, doseId, actorUserId, notes ?? null],
      );
      await completeProcedureQueue(client, entry, actorUserId);
      await client.query("update clinic.visits set status='ready_for_billing', updated_at=now() where id=$1", [dose.visit_id]);
      await enqueueBillingIfNeeded(client, dose.visit_id, actorUserId, "Procedure completed — ready for billing");
      await client.query(
        `update clinic.treatment_courses c set status='completed', completed_at=now(), updated_at=now()
         where c.id=$1 and not exists (
           select 1 from clinic.treatment_course_doses d where d.course_id=c.id and d.status in ('scheduled','checked_in')
         )`,
        [courseId],
      );
      const course = (await this.find(courseId, client))!;
      await this.audit.record({ ...event, resourceId: doseId, beforeData: dose, afterData: course }, client);
      return course;
    });
  }

  async missDose(courseId: string, doseId: string, reason: string, actorUserId: string, event: AuditEventInput): Promise<TreatmentCourse> {
    return withTransaction(this.pool, async (client) => {
      const dose = await lockDose(client, courseId, doseId);
      if (dose.course_status !== "active" || dose.dose_status !== "scheduled") {
        throw new AppError(409, "DOSE_NOT_MISSABLE", "Only a scheduled dose on an active course can be marked missed");
      }
      await client.query(
        "update clinic.treatment_course_doses set status='missed', missed_reason=$3, updated_at=now() where course_id=$1 and id=$2",
        [courseId, doseId, reason],
      );
      await client.query(
        `update clinic.treatment_courses c set status='completed', completed_at=now(), updated_at=now()
         where c.id=$1 and not exists (
           select 1 from clinic.treatment_course_doses d where d.course_id=c.id and d.status in ('scheduled','checked_in')
         )`,
        [courseId],
      );
      const course = (await this.find(courseId, client))!;
      await this.audit.record({ ...event, resourceId: doseId, beforeData: dose, afterData: course }, client);
      return course;
    });
  }

  async cancel(courseId: string, reason: string, actorUserId: string, event: AuditEventInput): Promise<TreatmentCourse> {
    return withTransaction(this.pool, async (client) => {
      const locked = await client.query<{ status: string }>(
        "select status from clinic.treatment_courses where id=$1 for update",
        [courseId],
      );
      const current = locked.rows[0];
      if (!current) throw new AppError(404, "COURSE_NOT_FOUND", "Treatment course was not found");
      if (current.status !== "active") throw new AppError(409, "COURSE_NOT_CANCELLABLE", "Only an active course can be cancelled");
      const checkedIn = await client.query("select 1 from clinic.treatment_course_doses where course_id=$1 and status='checked_in' limit 1", [courseId]);
      if (checkedIn.rowCount) throw new AppError(409, "COURSE_HAS_ACTIVE_DOSE", "Complete the checked-in dose before cancelling the course");

      await client.query(
        `update clinic.treatment_courses set status='cancelled', cancelled_by=$2,
           cancelled_at=now(), cancellation_reason=$3, updated_at=now() where id=$1`,
        [courseId, actorUserId, reason],
      );
      await client.query(
        "update clinic.treatment_course_doses set status='cancelled', updated_at=now() where course_id=$1 and status='scheduled'",
        [courseId],
      );
      const course = (await this.find(courseId, client))!;
      await this.audit.record({ ...event, resourceId: courseId, beforeData: current, afterData: course }, client);
      return course;
    });
  }
}

async function lockDose(client: PoolClient, courseId: string, doseId: string): Promise<DoseLock> {
  const result = await client.query<DoseLock>(
    `select d.id, d.course_id, c.patient_id, c.catalog_item_id, c.procedure_name,
       c.total_doses, c.status as course_status, d.dose_number, d.scheduled_date::text,
       d.status as dose_status, d.visit_id
     from clinic.treatment_course_doses d join clinic.treatment_courses c on c.id=d.course_id
     where c.id=$1 and d.id=$2 for update of c, d`,
    [courseId, doseId],
  );
  if (!result.rows[0]) throw new AppError(404, "DOSE_NOT_FOUND", "Treatment dose was not found");
  return result.rows[0];
}

async function completeProcedureQueue(client: PoolClient, entry: { id: string; status: string }, actorUserId: string): Promise<void> {
  await client.query(
    "update clinic.queue_entries set status='completed', completed_at=now(), updated_at=now() where id=$1",
    [entry.id],
  );
  await client.query(
    `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
     values ($1,$2,'completed',$3,'Procedure administered')`,
    [entry.id, entry.status, actorUserId],
  );
}

