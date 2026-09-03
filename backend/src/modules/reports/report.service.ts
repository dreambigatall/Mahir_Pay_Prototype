import { AppError } from "../../shared/errors/app-error";
import { ReportRepository } from "./report.repository";

export class ReportService {
  constructor(private readonly repository: ReportRepository) {}

  dashboard() { return this.repository.dashboard(); }

  period(fromInput: string | undefined, toInput: string | undefined) {
    const to = toInput ? new Date(toInput) : new Date();
    const from = fromInput ? new Date(fromInput) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new AppError(400, "DATE_RANGE_INVALID", "Report dates must be valid ISO timestamps");
    }
    if (to <= from) throw new AppError(400, "DATE_RANGE_INVALID", "Report end must follow start");
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1_000) {
      throw new AppError(400, "DATE_RANGE_TOO_LARGE", "Report range cannot exceed one year");
    }
    return this.repository.period(from.toISOString(), to.toISOString());
  }
}

