import { z } from "zod";

export const createTreatmentCourseSchema = z.object({
  patientId: z.string().uuid(),
  catalogItemId: z.string().uuid(),
  totalDoses: z.number().int().min(1).max(365),
  startDate: z.iso.date(),
  billingMode: z.enum(["per_dose", "package"]),
  notes: z.string().trim().max(2_000).optional(),
});

export const administerDoseSchema = z.object({
  notes: z.string().trim().min(1).max(2_000).optional(),
});

export const missDoseSchema = z.object({
  reason: z.string().trim().min(1).max(1_000),
});

export const cancelTreatmentCourseSchema = z.object({
  reason: z.string().trim().min(1).max(1_000),
});

