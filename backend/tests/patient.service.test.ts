import { describe, expect, it, vi } from "vitest";

import type { PatientRepository } from "../src/modules/patients/patient.repository";
import { PatientService } from "../src/modules/patients/patient.service";

const metadata = { requestId: "8b9322ef-b083-4ccd-bf44-d8f60bb2db5c" };

describe("PatientService", () => {
  it("rejects a future date of birth before writing", () => {
    const repository = { create: vi.fn() } as unknown as PatientRepository;
    const service = new PatientService(repository);
    expect(() => service.create("user", {
      firstName: "Future",
      lastName: "Patient",
      dateOfBirth: "2999-01-01",
      sex: "unknown",
      allergies: [],
    }, metadata)).toThrowError(expect.objectContaining({ code: "DATE_OF_BIRTH_INVALID" }));
    expect(repository.create).not.toHaveBeenCalled();
  });
});
