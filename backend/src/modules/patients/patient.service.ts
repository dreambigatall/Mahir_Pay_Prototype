import { AppError } from "../../shared/errors/app-error";
import { decodeCursor, encodeCursor } from "../../shared/pagination/cursor";
import type { RequestMetadata } from "../audit/audit.repository";
import { PatientRepository } from "./patient.repository";
import type { PatientWrite } from "./patient.types";

export class PatientService {
  constructor(private readonly repository: PatientRepository) {}

  async list(search: string | undefined, cursorValue: string | undefined, limit: number) {
    const patients = await this.repository.list(search, decodeCursor(cursorValue), limit + 1);
    const hasMore = patients.length > limit;
    const items = hasMore ? patients.slice(0, limit) : patients;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
        : null,
    };
  }

  async get(patientId: string) {
    const patient = await this.repository.findById(patientId);
    if (!patient) throw new AppError(404, "PATIENT_NOT_FOUND", "Patient was not found");
    return patient;
  }

  create(actorUserId: string, input: PatientWrite, metadata: RequestMetadata) {
    ensureDateOfBirth(input.dateOfBirth);
    return this.repository.create(input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "patient.created",
      resourceType: "patient",
    });
  }

  update(patientId: string, actorUserId: string, input: PatientWrite, metadata: RequestMetadata) {
    ensureDateOfBirth(input.dateOfBirth);
    return this.repository.update(patientId, input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "patient.updated",
      resourceType: "patient",
    });
  }
}

function ensureDateOfBirth(value: string): void {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > new Date()) {
    throw new AppError(400, "DATE_OF_BIRTH_INVALID", "Date of birth cannot be in the future");
  }
}
