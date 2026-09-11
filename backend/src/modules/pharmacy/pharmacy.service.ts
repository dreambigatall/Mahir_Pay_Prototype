import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { PharmacyRepository } from "./pharmacy.repository";

export class PharmacyService {
  constructor(private readonly r: PharmacyRepository) {}

  create(
    actor: string,
    input: {
      encounterId: string;
      items: Array<{
        catalogItemId: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
        quantity: number;
      }>;
      notes?: string;
    },
    m: RequestMetadata,
  ) {
    return this.r.create(input.encounterId, input.items, input.notes, actor, {
      ...m,
      actorUserId: actor,
      action: "prescription.created",
      resourceType: "prescription",
    });
  }

  list(limit: number) {
    return this.r.listWorklist(limit);
  }

  async byId(id: string) {
    const item = await this.r.findById(id);
    if (!item) throw new AppError(404, "PRESCRIPTION_NOT_FOUND", "Prescription was not found");
    return item;
  }

  byVisit(id: string) {
    return this.r.findByVisit(id);
  }

  dispense(
    id: string,
    items: Array<{ prescriptionItemId: string; quantity: number }>,
    notes: string | undefined,
    actor: string,
    m: RequestMetadata,
  ) {
    return this.r.dispense(id, items, notes, actor, {
      ...m,
      actorUserId: actor,
      action: "medication.dispensed",
      resourceType: "prescription",
    });
  }
}
