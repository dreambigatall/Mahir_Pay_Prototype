import type { Pool } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";

export type Referral = {
  id: string;
  visit_id: string;
  visit_number: string;
  encounter_id: string | null;
  patient_id: string;
  medical_record_number: string;
  patient_name: string;
  from_clinician_id: string;
  from_clinician_name: string;
  recipient_user_id: string | null;
  recipient_name: string | null;
  destination_type: string;
  to_department: string | null;
  to_branch: string | null;
  external_provider: string | null;
  diagnosis: string;
  notes: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

const REFERRAL_SELECT = `
  select r.id, r.visit_id, v.visit_number, r.encounter_id, r.patient_id,
    p.medical_record_number, concat_ws(' ',p.first_name,p.middle_name,p.last_name) as patient_name,
    r.from_clinician_id, f.full_name as from_clinician_name,
    r.recipient_user_id, recipient.full_name as recipient_name,
    r.destination_type, r.to_department, r.to_branch, r.external_provider,
    r.diagnosis, r.notes, r.status, r.created_at, r.updated_at
  from clinic.referrals r
  join clinic.visits v on v.id=r.visit_id
  join clinic.patients p on p.id=r.patient_id
  join clinic.users f on f.id=r.from_clinician_id
  left join clinic.users recipient on recipient.id=r.recipient_user_id`;

export class ReferralRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async create(
    input: {
      visitId: string;
      encounterId?: string;
      recipientUserId?: string;
      destinationType: "department" | "branch" | "external";
      toDepartment?: string;
      toBranch?: string;
      externalProvider?: string;
      diagnosis: string;
      notes: string;
    },
    actorUserId: string,
    event: AuditEventInput,
  ): Promise<Referral> {
    return withTransaction(this.pool, async (client) => {
      const visit = await client.query<{ patient_id: string }>("select patient_id from clinic.visits where id=$1", [input.visitId]);
      const visitRow = visit.rows[0];
      if (!visitRow) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
      if (input.encounterId) {
        const encounter = await client.query(
          "select 1 from clinic.encounters where id=$1 and visit_id=$2 and patient_id=$3",
          [input.encounterId, input.visitId, visitRow.patient_id],
        );
        if (!encounter.rowCount) throw new AppError(409, "ENCOUNTER_MISMATCH", "Encounter does not belong to this visit and patient");
      }
      if (input.recipientUserId) {
        const recipient = await client.query("select 1 from clinic.users where id=$1 and status='active'", [input.recipientUserId]);
        if (!recipient.rowCount) throw new AppError(400, "RECIPIENT_INVALID", "Referral recipient is not an active staff member");
      }
      const created = await client.query<{ id: string }>(
        `insert into clinic.referrals
          (visit_id, encounter_id, patient_id, from_clinician_id, recipient_user_id,
           destination_type, to_department, to_branch, external_provider, diagnosis, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [input.visitId, input.encounterId ?? null, visitRow.patient_id, actorUserId,
          input.recipientUserId ?? null, input.destinationType,
          input.destinationType === "department" ? input.toDepartment : null,
          input.destinationType === "branch" ? input.toBranch : null,
          input.destinationType === "external" ? input.externalProvider : null,
          input.diagnosis, input.notes],
      );
      const referralId = created.rows[0]!.id;
      if (input.recipientUserId) {
        await client.query(
          `insert into clinic.notifications
            (recipient_user_id, kind, title, message, resource_type, resource_id)
           values ($1,'referral.created','New clinical referral',$2,'referral',$3)`,
          [input.recipientUserId, input.diagnosis, referralId],
        );
      }
      const referral = (await this.find(referralId, client))!;
      await this.audit.record({ ...event, resourceId: referralId, afterData: referral }, client);
      return referral;
    });
  }

  async list(patientId: string | undefined, status: string | undefined, limit: number): Promise<Referral[]> {
    const result = await this.pool.query<Referral>(
      `${REFERRAL_SELECT} where ($1::uuid is null or r.patient_id=$1)
       and ($2::text is null or r.status=$2)
       order by r.created_at desc, r.id desc limit $3`,
      [patientId ?? null, status ?? null, limit],
    );
    return result.rows;
  }

  async find(id: string, database: Queryable = this.pool): Promise<Referral | null> {
    const result = await database.query<Referral>(`${REFERRAL_SELECT} where r.id=$1`, [id]);
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: string, reason: string | undefined, actorUserId: string, event: AuditEventInput): Promise<Referral> {
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ status: string }>("select status from clinic.referrals where id=$1 for update", [id]);
      const before = current.rows[0];
      if (!before) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral was not found");
      const allowed: Record<string, string[]> = { created: ["sent", "cancelled"], sent: ["accepted", "cancelled"], accepted: ["completed", "cancelled"], completed: [], cancelled: [] };
      if (!allowed[before.status]?.includes(status)) {
        throw new AppError(409, "REFERRAL_TRANSITION_INVALID", `Cannot move referral from ${before.status} to ${status}`);
      }
      await client.query(
        `update clinic.referrals set status=$2,
           sent_at=case when $2='sent' then now() else sent_at end,
           accepted_at=case when $2='accepted' then now() else accepted_at end,
           completed_at=case when $2='completed' then now() else completed_at end,
           cancelled_at=case when $2='cancelled' then now() else cancelled_at end,
           cancellation_reason=case when $2='cancelled' then $3 else cancellation_reason end,
           updated_at=now() where id=$1`,
        [id, status, reason ?? null],
      );
      const referral = (await this.find(id, client))!;
      await this.audit.record({ ...event, resourceId: id, beforeData: before, afterData: referral }, client);
      return referral;
    });
  }
}

