import { z } from "zod";

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();
const allergySchema = z.object({
  allergen: z.string().trim().min(1).max(150),
  reaction: optionalText(500),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
});

export const patientWriteSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.iso.date(),
  sex: z.enum(["female", "male", "intersex", "unknown"]),
  phone: optionalText(30),
  email: z.string().trim().email().max(254).optional(),
  address: optionalText(500),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(30),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  allergies: z.array(allergySchema).max(50).default([]).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = item.allergen.toLowerCase();
      if (seen.has(key)) context.addIssue({ code: "custom", path: [index, "allergen"], message: "Duplicate allergen" });
      seen.add(key);
    });
  }),
});

export const patientListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});
