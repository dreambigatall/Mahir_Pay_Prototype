import { describe, expect, it, vi } from "vitest";

import type { WorkflowRepository } from "../src/modules/workflow/workflow.repository";
import { WorkflowService } from "../src/modules/workflow/workflow.service";

const metadata = { requestId: "9615a9e5-e99b-436c-a646-3fb8a167d773" };

function repositoryMock(): WorkflowRepository {
  return {
    createAppointment: vi.fn(),
    listAppointments: vi.fn().mockResolvedValue([]),
    cancelAppointment: vi.fn(),
    checkIn: vi.fn(),
    findVisit: vi.fn(),
    listQueue: vi.fn(),
    transitionQueue: vi.fn(),
    recordTriage: vi.fn(),
  } as unknown as WorkflowRepository;
}

describe("WorkflowService", () => {
  it("rejects appointments in the past", () => {
    const service = new WorkflowService(repositoryMock());
    expect(() => service.createAppointment("user", {
      patientId: "patient",
      scheduledAt: "2020-01-01T00:00:00.000Z",
      durationMinutes: 30,
      reason: "Follow up",
    }, metadata)).toThrowError(expect.objectContaining({ code: "APPOINTMENT_TIME_INVALID" }));
  });

  it("limits appointment search ranges", () => {
    const service = new WorkflowService(repositoryMock());
    expect(() => service.listAppointments(
      "2026-01-01T00:00:00.000Z",
      "2028-01-01T00:00:00.000Z",
      undefined,
      50,
    )).toThrowError(expect.objectContaining({ code: "DATE_RANGE_TOO_LARGE" }));
  });

  it("maps the active-visit unique constraint to a workflow conflict", async () => {
    const repository = repositoryMock();
    vi.mocked(repository.checkIn).mockRejectedValue({ code: "23505" });
    const service = new WorkflowService(repository);
    await expect(service.checkIn("user", {
      patientId: "patient",
      kind: "consultation",
      reason: "Fever",
      priority: "routine",
    }, metadata)).rejects.toMatchObject({ status: 409, code: "ACTIVE_VISIT_EXISTS" });
  });
});
