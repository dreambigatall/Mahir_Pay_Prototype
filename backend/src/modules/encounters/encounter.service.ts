import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { EncounterRepository } from "./encounter.repository";
import type { EncounterDocument } from "./encounter.types";

export class EncounterService {
  constructor(private readonly repository: EncounterRepository) {}

  async start(visitId: string, actorUserId: string, roles: string[], metadata: RequestMetadata) {
    try {
      return await this.repository.start(visitId, actorUserId, roles.includes("admin"), {
        ...metadata,
        actorUserId,
        action: "encounter.started",
        resourceType: "encounter",
      });
    } catch (error) {
      if (isConstraint(error, "23505")) {
        throw new AppError(409, "ENCOUNTER_EXISTS", "This visit already has an encounter");
      }
      throw error;
    }
  }

  async getByVisit(visitId: string) {
    const encounter = await this.repository.findByVisit(visitId);
    if (!encounter) throw new AppError(404, "ENCOUNTER_NOT_FOUND", "Encounter was not found");
    return encounter;
  }

  document(
    encounterId: string,
    input: EncounterDocument,
    actorUserId: string,
    roles: string[],
    metadata: RequestMetadata,
  ) {
    return this.repository.document(encounterId, input, actorUserId, roles.includes("admin"), {
      ...metadata,
      actorUserId,
      action: "encounter.documented",
      resourceType: "encounter",
    });
  }

  sign(encounterId: string, actorUserId: string, roles: string[], metadata: RequestMetadata) {
    return this.repository.sign(encounterId, actorUserId, roles.includes("admin"), {
      ...metadata,
      actorUserId,
      action: "encounter.signed",
      resourceType: "encounter",
    });
  }

  amend(
    encounterId: string,
    input: { reason: string; content: string },
    actorUserId: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.amend(encounterId, input, actorUserId, {
      ...metadata,
      actorUserId,
      action: "encounter.amended",
      resourceType: "encounter",
    });
  }
}

function isConstraint(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
