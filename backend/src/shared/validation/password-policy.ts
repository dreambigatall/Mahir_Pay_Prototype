import { z } from "zod";

/** Simple clinic staff password: length only, no complexity rules. */
export const passwordSchema = z
  .string()
  .min(6, "Password must contain at least 6 characters")
  .max(128, "Password is too long");
