import { z } from "zod";

import { passwordSchema } from "../../shared/validation/password-policy";

export const createStaffSchema = z.object({
  email: z.string().trim().email().max(254),
  temporaryPassword: passwordSchema,
  fullName: z.string().trim().min(2).max(150),
  title: z.string().trim().min(1).max(100).optional(),
  room: z.string().trim().min(1).max(50).optional(),
  roles: z.array(z.string().trim().min(1).max(50)).min(1).max(5).transform((roles) => [...new Set(roles)]),
});

export const setStaffStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});
