import { z } from "zod";

export const diagnosticOrderSchema=z.object({
  encounterId:z.string().uuid(),
  catalogItemIds:z.array(z.string().uuid()).min(1).max(30).transform((ids)=>[...new Set(ids)]),
  urgency:z.enum(["routine","urgent"]).default("routine"),
  clinicalNotes:z.string().trim().min(1).max(4000).optional(),
});
export const diagnosticWorklistQuerySchema=z.object({
  status:z.enum(["requested","in_progress","result_ready","verified","reviewed"]).optional(),
  includeReviewed:z.enum(["true","false"]).transform((v)=>v==="true").optional(),
  limit:z.coerce.number().int().positive().max(200).default(100),
});
export const diagnosticCancelSchema=z.object({
  reason:z.string().trim().min(1).max(500).optional(),
});
export const diagnosticOrderUpdateSchema=z.object({
  urgency:z.enum(["routine","urgent"]).optional(),
  clinicalNotes:z.union([z.string().trim().max(4000),z.null()]).optional(),
}).refine((input)=>input.urgency!==undefined||input.clinicalNotes!==undefined,{message:"At least one field must be provided"});
export const diagnosticResultSchema=z.object({
  resultValue:z.string().trim().min(1).max(4000),
  resultUnit:z.string().trim().min(1).max(100).optional(),
  resultFlag:z.enum(["normal","abnormal","critical"]).optional(),
  referenceRange:z.string().trim().min(1).max(500).optional(),
  notes:z.string().trim().min(1).max(4000).optional(),
});
