import type { Pool } from "pg";

import { withTransaction } from "../../database/transaction";
import type { Queryable } from "../../database/types";
import { AppError } from "../../shared/errors/app-error";
import type { TimestampCursor } from "../../shared/pagination/cursor";
import type { AuditEventInput } from "../audit/audit.repository";
import { AuditRepository } from "../audit/audit.repository";
import type { Patient, PatientWrite } from "./patient.types";

const PATIENT_SELECT = `
  select p.id, p.medical_record_number, p.first_name, p.middle_name, p.last_name,
    p.date_of_birth::text, p.sex, p.phone, p.email, p.address,
    p.emergency_contact_name, p.emergency_contact_phone, p.blood_group,
    p.active, p.created_at, p.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'allergen', a.allergen, 'reaction', a.reaction,
        'severity', a.severity, 'recorded_at', a.recorded_at
      ) order by lower(a.allergen))
      from clinic.patient_allergies a where a.patient_id = p.id
    ), '[]'::jsonb) as allergies
  from clinic.patients p
`;

export class PatientRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit: AuditRepository,
  ) {}

  async list(search: string | undefined, cursor: TimestampCursor | null, limit: number): Promise<Patient[]> {
    const result = await this.pool.query<Patient>(
      `${PATIENT_SELECT}
       where p.active = true
         and ($1::text is null or p.medical_record_number ilike '%' || $1 || '%'
           or p.first_name ilike '%' || $1 || '%' or p.last_name ilike '%' || $1 || '%'
           or p.phone ilike '%' || $1 || '%')
         and ($2::timestamptz is null or (p.created_at, p.id) < ($2::timestamptz, $3::uuid))
       order by p.created_at desc, p.id desc limit $4`,
      [search ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, limit],
    );
    return result.rows;
  }

  async findById(patientId: string, database: Queryable = this.pool): Promise<Patient | null> {
    const result = await database.query<Patient>(`${PATIENT_SELECT} where p.id = $1`, [patientId]);
    return result.rows[0] ?? null;
  }

  async create(input: PatientWrite, actorUserId: string, event: AuditEventInput): Promise<Patient> {
    return withTransaction(this.pool, async (client) => {
      const created = await client.query<{ id: string }>(
        `insert into clinic.patients (
          first_name, middle_name, last_name, date_of_birth, sex, phone, email,
          address, emergency_contact_name, emergency_contact_phone, blood_group,
          created_by, updated_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) returning id`,
        valuesForPatient(input, actorUserId),
      );
      const patientId = created.rows[0]!.id;
      await replaceAllergies(client, patientId, input, actorUserId);
      const patient = (await this.findById(patientId, client))!;
      await this.audit.record({ ...event, resourceId: patientId, afterData: patient }, client);
      return patient;
    });
  }

  async update(patientId: string, input: PatientWrite, actorUserId: string, event: AuditEventInput): Promise<Patient> {
    return withTransaction(this.pool, async (client) => {
      const before = await this.findById(patientId, client);
      if (!before) throw new AppError(404, "PATIENT_NOT_FOUND", "Patient was not found");
      await client.query(
        `update clinic.patients set first_name=$1, middle_name=$2, last_name=$3,
          date_of_birth=$4, sex=$5, phone=$6, email=$7, address=$8,
          emergency_contact_name=$9, emergency_contact_phone=$10, blood_group=$11,
          updated_by=$12, updated_at=now() where id=$13`,
        [...valuesForPatient(input, actorUserId), patientId],
      );
      await client.query("delete from clinic.patient_allergies where patient_id = $1", [patientId]);
      await replaceAllergies(client, patientId, input, actorUserId);
      const after = (await this.findById(patientId, client))!;
      await this.audit.record({ ...event, resourceId: patientId, beforeData: before, afterData: after }, client);
      return after;
    });
  }
}

function valuesForPatient(input: PatientWrite, actorUserId: string): unknown[] {
  return [input.firstName, input.middleName ?? null, input.lastName, input.dateOfBirth, input.sex,
    input.phone ?? null, input.email?.toLowerCase() ?? null, input.address ?? null,
    input.emergencyContactName ?? null, input.emergencyContactPhone ?? null,
    input.bloodGroup ?? null, actorUserId];
}

async function replaceAllergies(
  database: Queryable,
  patientId: string,
  input: PatientWrite,
  actorUserId: string,
): Promise<void> {
  for (const allergy of input.allergies) {
    await database.query(
      `insert into clinic.patient_allergies (patient_id, allergen, reaction, severity, recorded_by)
       values ($1,$2,$3,$4,$5)`,
      [patientId, allergy.allergen, allergy.reaction ?? null, allergy.severity ?? null, actorUserId],
    );
  }
}
