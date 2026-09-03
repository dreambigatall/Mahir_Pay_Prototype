import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { ReferralRepository } from "./referral.repository";

const TRANSITIONS: Record<string, string[]> = {
  created: ["sent", "cancelled"],
  sent: ["accepted", "cancelled"],
  accepted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export class ReferralService {
  constructor(private readonly repository: ReferralRepository) {}

  create(actorUserId: string, input: Parameters<ReferralRepository["create"]>[0], metadata: RequestMetadata) {
    return this.repository.create(input, actorUserId, {
      ...metadata, actorUserId, action: "referral.created", resourceType: "referral",
    });
  }

  list(patientId: string | undefined, status: string | undefined, limit: number) {
    return this.repository.list(patientId, status, limit);
  }

  async get(id: string) {
    const referral = await this.repository.find(id);
    if (!referral) throw new AppError(404, "REFERRAL_NOT_FOUND", "Referral was not found");
    return referral;
  }

  async updateStatus(id: string, status: string, reason: string | undefined, actorUserId: string, metadata: RequestMetadata) {
    const referral = await this.get(id);
    if (!TRANSITIONS[referral.status]?.includes(status)) {
      throw new AppError(409, "REFERRAL_TRANSITION_INVALID", `Cannot move referral from ${referral.status} to ${status}`);
    }
    return this.repository.updateStatus(id, status, reason, actorUserId, {
      ...metadata, actorUserId, action: `referral.${status}`, resourceType: "referral",
    });
  }
}

