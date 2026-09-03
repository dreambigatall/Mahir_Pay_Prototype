import { AppError } from "../../shared/errors/app-error";
import { CashierRepository } from "./cashier.repository";

export class CashierService {
  constructor(private readonly repository: CashierRepository) {}
  worklist(limit: number) { return this.repository.worklist(limit); }
  async suggestions(visitId: string) {
    if (!(await this.repository.isReadyForBilling(visitId))) throw new AppError(409, "VISIT_NOT_READY_FOR_BILLING", "Visit is not ready for billing");
    return this.repository.suggestions(visitId);
  }
}
