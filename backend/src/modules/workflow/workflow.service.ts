import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { WorkflowRepository } from "./workflow.repository";
import type { QueueStation, TriageWrite, VisitPriority } from "./workflow.types";

export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  createAppointment(
    actorUserId: string,
    input: { patientId: string; doctorId?: string; scheduledAt: string; durationMinutes: number; reason: string; notes?: string },
    metadata: RequestMetadata,
  ) {
    if (new Date(input.scheduledAt) <= new Date()) {
      throw new AppError(400, "APPOINTMENT_TIME_INVALID", "Appointment must be scheduled in the future");
    }
    return this.repository.createAppointment(input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "appointment.created",
      resourceType: "appointment",
    });
  }

  listAppointments(from: string | undefined, to: string | undefined, doctorId: string | undefined, limit: number) {
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1_000);
    if (end <= start) throw new AppError(400, "DATE_RANGE_INVALID", "Appointment end date must follow start date");
    if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1_000) {
      throw new AppError(400, "DATE_RANGE_TOO_LARGE", "Appointment date range cannot exceed one year");
    }
    return this.repository.listAppointments(start.toISOString(), end.toISOString(), doctorId, limit);
  }

  cancelAppointment(appointmentId: string, actorUserId: string, reason: string, metadata: RequestMetadata) {
    return this.repository.cancelAppointment(appointmentId, actorUserId, reason, {
      ...metadata,
      actorUserId,
      action: "appointment.cancelled",
      resourceType: "appointment",
    });
  }

  async checkIn(
    actorUserId: string,
    input: { patientId: string; appointmentId?: string; doctorId?: string; kind: string; reason: string; priority: VisitPriority },
    metadata: RequestMetadata,
  ) {
    try {
      return await this.repository.checkIn(input, actorUserId, {
        ...metadata,
        actorUserId,
        action: "visit.checked_in",
        resourceType: "visit",
      });
    } catch (error) {
      if (isConstraint(error, "23505")) {
        throw new AppError(409, "ACTIVE_VISIT_EXISTS", "Patient already has an active visit");
      }
      throw error;
    }
  }

  async getVisit(visitId: string) {
    const visit = await this.repository.findVisit(visitId);
    if (!visit) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
    return visit;
  }

  async getActiveVisitByPatient(patientId: string) {
    return this.repository.findActiveVisitByPatient(patientId);
  }

  listVisits(doctorId: string, limit: number, scope: "today" | "all" = "today") {
    return this.repository.listVisitsForDoctor(doctorId, limit, scope);
  }

  assignDoctor(visitId: string, doctorId: string | null, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.assignDoctor(visitId, doctorId, actorUserId, {
      ...metadata,
      actorUserId,
      action: "visit.doctor_assigned",
      resourceType: "visit",
    });
  }

  listQueue(station: QueueStation, status: string | undefined, limit: number) {
    return this.repository.listQueue(station, status, limit);
  }

  transitionQueue(
    queueEntryId: string,
    action: "call" | "start" | "cancel",
    notes: string | undefined,
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.transitionQueue(queueEntryId, action, notes, actorUserId, {
      ...metadata,
      actorUserId,
      action: `queue.${action}`,
      resourceType: "queue_entry",
    });
  }

  recordTriage(visitId: string, input: TriageWrite, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.recordTriage(visitId, input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "triage.recorded",
      resourceType: "visit",
    });
  }

  sendToDoctor(visitId: string, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.sendToDoctor(visitId, actorUserId, {
      ...metadata,
      actorUserId,
      action: "visit.sent_to_doctor",
      resourceType: "visit",
    });
  }

  saveVitals(visitId: string, input: TriageWrite, actorUserId: string, metadata: RequestMetadata) {
    return this.repository.saveVitals(visitId, input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "vitals.saved",
      resourceType: "visit",
    });
  }
}

function isConstraint(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
