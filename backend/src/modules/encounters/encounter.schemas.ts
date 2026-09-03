import { z } from "zod";

const note = z.string().trim().max(20_000).optional();

export const startEncounterSchema = z.object({
  visitId: z.string().uuid(),
});

export const encounterDocumentSchema = z.object({
  subjective: note,
  objective: note,
  assessment: note,
  plan: note,
  diagnosis: z.string().trim().max(2_000).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one clinical field is required",
});

export const encounterAmendmentSchema = z.object({
  reason: z.string().trim().min(1).max(1_000),
  content: z.string().trim().min(1).max(20_000),
});
