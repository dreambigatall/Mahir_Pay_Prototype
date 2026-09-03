import { z } from "zod";

export const createReferralSchema = z.object({
  visitId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  recipientUserId: z.string().uuid().optional(),
  destinationType: z.enum(["department", "branch", "external"]),
  toDepartment: z.string().trim().min(1).max(200).optional(),
  toBranch: z.string().trim().min(1).max(200).optional(),
  externalProvider: z.string().trim().min(1).max(300).optional(),
  diagnosis: z.string().trim().min(1).max(1_000),
  notes: z.string().trim().min(1).max(4_000),
}).superRefine((value, context) => {
  const destinations = {
    department: value.toDepartment,
    branch: value.toBranch,
    external: value.externalProvider,
  };
  if (!destinations[value.destinationType]) {
    context.addIssue({ code: "custom", path: [destinationField(value.destinationType)], message: "Referral destination is required" });
  }
});

export const updateReferralStatusSchema = z.object({
  status: z.enum(["sent", "accepted", "completed", "cancelled"]),
  reason: z.string().trim().min(1).max(1_000).optional(),
}).superRefine((value, context) => {
  if (value.status === "cancelled" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Cancellation reason is required" });
  }
});

function destinationField(type: "department" | "branch" | "external") {
  return type === "department" ? "toDepartment" : type === "branch" ? "toBranch" : "externalProvider";
}

