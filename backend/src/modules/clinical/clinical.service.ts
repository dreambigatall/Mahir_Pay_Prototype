import { AppError } from "../../shared/errors/app-error";
import { ClinicalRepository } from "./clinical.repository";

export class ClinicalService {
  constructor(private readonly repository: ClinicalRepository) {}

  async getTriage(visitId: string) {
    const item = await this.repository.findTriage(visitId);
    if (item) return item;
    if (!(await this.repository.visitExists(visitId))) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
    throw new AppError(404, "TRIAGE_NOT_FOUND", "Triage observations were not found");
  }

  async getDiagnostics(visitId: string) {
    if (!(await this.repository.visitExists(visitId))) throw new AppError(404, "VISIT_NOT_FOUND", "Visit was not found");
    return this.repository.findDiagnostics(visitId);
  }
}
