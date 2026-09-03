import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { TreatmentRepository } from "./treatment.repository";

export class TreatmentService {
  constructor(private readonly repository: TreatmentRepository) {}

  create(actorUserId: string, input: Parameters<TreatmentRepository["create"]>[0], metadata: RequestMetadata) {
    const start = new Date(`${input.startDate}T00:00:00Z`);
    const oldestAllowed = new Date();
    oldestAllowed.setUTCDate(oldestAllowed.getUTCDate() - 1);
    if (start < new Date(Date.UTC(oldestAllowed.getUTCFullYear(), oldestAllowed.getUTCMonth(), oldestAllowed.getUTCDate()))) {
      throw new AppError(400, "COURSE_START_DATE_INVALID", "Course cannot start more than one day in the past");
    }
    return this.repository.create(input, actorUserId, {
      ...metadata, actorUserId, action: "treatment_course.created", resourceType: "treatment_course",
    });
  }

  list(patientId: string | undefined, status: string | undefined, limit: number) {
    return this.repository.list(patientId, status, limit);
  }

  async get(id: string) {
    const item = await this.repository.find(id);
    if (!item) throw new AppError(404, "COURSE_NOT_FOUND", "Treatment course was not found");
    return item;
  }

  checkIn(courseId: string, doseId: string, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.checkInDose(courseId, doseId, actorUserId, {
      ...metadata, actorUserId, action: "treatment_dose.checked_in", resourceType: "treatment_course_dose",
    });
  }

  administer(courseId: string, doseId: string, notes: string | undefined, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.administerDose(courseId, doseId, notes, actorUserId, {
      ...metadata, actorUserId, action: "treatment_dose.given", resourceType: "treatment_course_dose",
    });
  }

  miss(courseId: string, doseId: string, reason: string, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.missDose(courseId, doseId, reason, actorUserId, {
      ...metadata, actorUserId, action: "treatment_dose.missed", resourceType: "treatment_course_dose",
    });
  }

  cancel(courseId: string, reason: string, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.cancel(courseId, reason, actorUserId, {
      ...metadata, actorUserId, action: "treatment_course.cancelled", resourceType: "treatment_course",
    });
  }
}

