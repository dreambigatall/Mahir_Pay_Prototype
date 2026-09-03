import { describe, expect, it, vi } from "vitest";

import { createReferralSchema, updateReferralStatusSchema } from "../src/modules/referrals/referral.schemas";
import { ReferralService } from "../src/modules/referrals/referral.service";
import { ReportService } from "../src/modules/reports/report.service";
import { createTreatmentCourseSchema } from "../src/modules/treatments/treatment.schemas";

const id = "00000000-0000-4000-8000-000000000001";

describe("phase four request schemas", () => {
  it("accepts a bounded daily treatment course", () => {
    const parsed = createTreatmentCourseSchema.parse({
      patientId: id,
      catalogItemId: id,
      totalDoses: 5,
      startDate: "2026-08-28",
      billingMode: "per_dose",
    });
    expect(parsed.totalDoses).toBe(5);
  });

  it("requires the destination field matching the referral type", () => {
    expect(() => createReferralSchema.parse({
      visitId: id,
      destinationType: "branch",
      diagnosis: "Needs specialist review",
      notes: "Transfer with encounter summary",
    })).toThrow();
  });

  it("requires a reason when cancelling a referral", () => {
    expect(() => updateReferralStatusSchema.parse({ status: "cancelled" })).toThrow();
  });
});

describe("phase four workflow guards", () => {
  it("rejects referral transition skips", async () => {
    const repository = {
      find: vi.fn().mockResolvedValue({ id, status: "created" }),
      updateStatus: vi.fn(),
    };
    const service = new ReferralService(repository as never);
    await expect(service.updateStatus(id, "completed", undefined, id, {})).rejects.toMatchObject({ code: "REFERRAL_TRANSITION_INVALID" });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it("limits operational reports to one year", () => {
    const service = new ReportService({ period: vi.fn(), dashboard: vi.fn() } as never);
    expect(() => service.period("2024-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toThrowError(/one year/i);
  });
});
