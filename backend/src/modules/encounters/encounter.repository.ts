import type { Pool, PoolClient } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import { enqueueBillingIfNeeded } from "../workflow/queue-helpers";
import type { Encounter, EncounterDocument } from "./encounter.types";

const ENCOUNTER_SELECT = `
  select e.id, e.visit_id, v.visit_number, e.patient_id, p.medical_record_number,
    concat_ws(' ', p.first_name, p.middle_name, p.last_name) as patient_name,
    e.clinician_id, u.full_name as clinician_name, e.status, e.subjective,
    e.objective, e.assessment, e.plan, e.diagnosis, e.started_at,
    e.signed_at, e.signed_by, e.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'author_user_id', a.author_user_id, 'author_name', au.full_name,
        'reason', a.reason, 'content', a.content, 'created_at', a.created_at
      ) order by a.created_at, a.id)
      from clinic.encounter_amendments a
      join clinic.users au on au.id = a.author_user_id
      where a.encounter_id = e.id
    ), '[]'::jsonb) as amendments
  from clinic.encounters e
  join clinic.visits v on v.id = e.visit_id
  join clinic.patients p on p.id = e.patient_id
  join clinic.users u on u.id = e.clinician_id
`;

export class EncounterRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async start(visitId: string, actorUserId: string, canOverride: boolean, event: AuditEventInput): Promise<Encounter> {
    return withTransaction(this.pool, async (client) => {
      await requireActiveDoctor(client, actorUserId, canOverride);
      const visit = await client.query<{ id: string; patient_id: string; doctor_id: string | null; status: string }>(
        "select id, patient_id, doctor_id, status from clinic.visits where id=$1 for update",
        [visitId],
      );
      const row = visit.rows[0];
      if (!row) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (!['awaiting_doctor', 'in_consultation'].includes(row.status)) {
        throw new AppError(409, "ENCOUNTER_NOT_AVAILABLE", "Visit is not ready for consultation");
      }
      if (row.doctor_id && row.doctor_id !== actorUserId && !canOverride) {
        throw new AppError(403, "VISIT_ASSIGNED_TO_ANOTHER_DOCTOR", "Visit is assigned to another doctor");
      }
      const created = await client.query<{ id: string }>(
        `insert into clinic.encounters (visit_id, patient_id, clinician_id)
         values ($1,$2,$3) returning id`,
        [visitId, row.patient_id, actorUserId],
      );
      await client.query(
        "update clinic.visits set status='in_consultation', doctor_id=coalesce(doctor_id,$2), updated_at=now() where id=$1",
        [visitId, actorUserId],
      );
      const queue = await client.query<{ id: string; status: string }>(
        `select id, status from clinic.queue_entries where visit_id=$1 and station='doctor'
         and status in ('waiting','called','in_service') for update`,
        [visitId],
      );
      if (queue.rows[0]) {
        const q = queue.rows[0];
        await client.query(
          "update clinic.queue_entries set status='in_service', assigned_user_id=$2, service_started_at=coalesce(service_started_at,now()), updated_at=now() where id=$1",
          [q.id, actorUserId],
        );
        if (q.status !== 'in_service') await queueEvent(client, q.id, q.status, 'in_service', actorUserId, 'Encounter started');
      }
      const encounter = (await this.findById(created.rows[0]!.id, client))!;
      await this.audit.record({ ...event, resourceId: encounter.id, afterData: encounter }, client);
      return encounter;
    });
  }

  async findByVisit(visitId: string): Promise<Encounter | null> {
    const result = await this.pool.query<Encounter>(`${ENCOUNTER_SELECT} where e.visit_id=$1`, [visitId]);
    return result.rows[0] ?? null;
  }

  async document(
    encounterId: string,
    input: EncounterDocument,
    actorUserId: string,
    canOverride: boolean,
    event: AuditEventInput,
  ): Promise<Encounter> {
    return withTransaction(this.pool, async (client) => {
      const current = await lockEncounter(client, encounterId);
      requireEncounterOwner(current, actorUserId, canOverride);
      if (current.status !== 'open') throw new AppError(409, "ENCOUNTER_SIGNED", "Signed encounters cannot be edited");
      const before = (await this.findById(encounterId, client))!;
      await client.query(
        `update clinic.encounters set subjective=coalesce($2,subjective), objective=coalesce($3,objective),
          assessment=coalesce($4,assessment), plan=coalesce($5,plan),
          diagnosis=coalesce($6,diagnosis), updated_at=now() where id=$1`,
        [encounterId, input.subjective ?? null, input.objective ?? null, input.assessment ?? null,
          input.plan ?? null, input.diagnosis ?? null],
      );
      const after = (await this.findById(encounterId, client))!;
      await this.audit.record({ ...event, resourceId: encounterId, beforeData: before, afterData: after }, client);
      return after;
    });
  }

  async sign(encounterId: string, actorUserId: string, canOverride: boolean, event: AuditEventInput): Promise<Encounter> {
    return withTransaction(this.pool, async (client) => {
      const current = await lockEncounter(client, encounterId);
      requireEncounterOwner(current, actorUserId, canOverride);
      if (current.status !== 'open') throw new AppError(409, "ENCOUNTER_ALREADY_SIGNED", "Encounter is already signed");
      if (!current.assessment?.trim() || !current.plan?.trim()) {
        throw new AppError(400, "ENCOUNTER_INCOMPLETE", "Assessment and plan are required before signing");
      }
      const pendingDiagnostics = await client.query(
        `select 1 from clinic.diagnostic_orders
         where encounter_id=$1 and status not in ('reviewed','cancelled') limit 1`,
        [encounterId],
      );
      if (pendingDiagnostics.rowCount) {
        throw new AppError(409, "DIAGNOSTICS_PENDING", "All diagnostic results must be verified and acknowledged before signing");
      }
      await client.query(
        "update clinic.encounters set status='signed', signed_at=now(), signed_by=$2, updated_at=now() where id=$1",
        [encounterId, actorUserId],
      );
      await client.query("update clinic.visits set status='ready_for_billing', updated_at=now() where id=$1", [current.visit_id]);
      const queue = await client.query<{ id: string; status: string }>(
        `select id,status from clinic.queue_entries where visit_id=$1 and station='doctor'
         and status in ('waiting','called','in_service') for update`,
        [current.visit_id],
      );
      if (queue.rows[0]) {
        await client.query(
          "update clinic.queue_entries set status='completed', completed_at=now(), updated_at=now() where id=$1",
          [queue.rows[0].id],
        );
        await queueEvent(client, queue.rows[0].id, queue.rows[0].status, 'completed', actorUserId, 'Encounter signed');
      }
      await enqueueBillingIfNeeded(client, current.visit_id, actorUserId, "Encounter signed — ready for billing");
      const after = (await this.findById(encounterId, client))!;
      await this.audit.record({ ...event, resourceId: encounterId, afterData: after }, client);
      return after;
    });
  }

  async amend(
    encounterId: string,
    input: { reason: string; content: string },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<Encounter> {
    return withTransaction(this.pool, async (client) => {
      const current = await lockEncounter(client, encounterId);
      if (current.status !== 'signed') throw new AppError(409, "ENCOUNTER_NOT_SIGNED", "Only signed encounters can be amended");
      const amendment = await client.query<{ id: string }>(
        `insert into clinic.encounter_amendments (encounter_id, author_user_id, reason, content)
         values ($1,$2,$3,$4) returning id`,
        [encounterId, actorUserId, input.reason, input.content],
      );
      await this.audit.record({
        ...event,
        resourceId: encounterId,
        afterData: { amendmentId: amendment.rows[0]!.id, ...input },
      }, client);
      return (await this.findById(encounterId, client))!;
    });
  }

  private async findById(encounterId: string, database: Queryable): Promise<Encounter | null> {
    const result = await database.query<Encounter>(`${ENCOUNTER_SELECT} where e.id=$1`, [encounterId]);
    return result.rows[0] ?? null;
  }
}

type LockedEncounter = {
  id: string;
  visit_id: string;
  clinician_id: string;
  status: string;
  assessment: string | null;
  plan: string | null;
};

async function lockEncounter(client: PoolClient, encounterId: string): Promise<LockedEncounter> {
  const result = await client.query<LockedEncounter>(
    "select id, visit_id, clinician_id, status, assessment, plan from clinic.encounters where id=$1 for update",
    [encounterId],
  );
  if (!result.rows[0]) throw new AppError(404, "ENCOUNTER_NOT_FOUND", "Encounter was not found");
  return result.rows[0];
}

function requireEncounterOwner(encounter: LockedEncounter, actorUserId: string, canOverride: boolean): void {
  if (encounter.clinician_id !== actorUserId && !canOverride) {
    throw new AppError(403, "ENCOUNTER_OWNED_BY_ANOTHER_CLINICIAN", "Encounter belongs to another clinician");
  }
}

async function requireActiveDoctor(database: Queryable, userId: string, canOverride: boolean): Promise<void> {
  if (canOverride) return;
  const result = await database.query(
    `select u.id from clinic.users u join clinic.user_roles ur on ur.user_id=u.id
     join clinic.roles r on r.id=ur.role_id where u.id=$1 and u.status='active' and r.slug='doctor'`,
    [userId],
  );
  if (!result.rowCount) throw new AppError(403, "CLINICIAN_REQUIRED", "An active doctor account is required");
}

async function queueEvent(
  client: PoolClient,
  queueEntryId: string,
  fromStatus: string,
  toStatus: string,
  actorUserId: string,
  notes: string,
): Promise<void> {
  await client.query(
    `insert into clinic.queue_events (queue_entry_id, from_status, to_status, actor_user_id, notes)
     values ($1,$2,$3,$4,$5)`,
    [queueEntryId, fromStatus, toStatus, actorUserId, notes],
  );
}


