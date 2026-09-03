import { z } from "zod";

export const appointmentCreateSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid().optional(),
  scheduledAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  reason: z.string().trim().min(1).max(500),
  notes: z.string().trim().min(1).max(1000).optional(),
});

export const appointmentListQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  doctorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const visitListQuerySchema = z.object({
  doctorId: z.string().uuid().optional(),
  scope: z.enum(["today", "all"]).default("today"),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const checkInSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  kind: z.enum(["consultation", "procedure"]).default("consultation"),
  reason: z.string().trim().min(1).max(500),
  priority: z.enum(["routine", "urgent", "emergency"]).default("routine"),
});

export const queueListQuerySchema = z.object({
  station: z.enum(["triage", "doctor", "lab", "pharmacy", "billing", "procedure"]),
  status: z.enum(["waiting", "called", "in_service"]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const queueTransitionSchema = z.object({
  action: z.enum(["call", "start", "cancel"]),
  notes: z.string().trim().min(1).max(500).optional(),
});

export const assignDoctorSchema = z.object({
  doctorId: z.string().uuid().nullable(),
});

export const triageWriteSchema = z.object({
  temperatureC: z.number().min(25).max(45).optional(),
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  pulseBpm: z.number().int().min(20).max(300).optional(),
  respiratoryRate: z.number().int().min(5).max(100).optional(),
  oxygenSaturation: z.number().min(40).max(100).optional(),
  weightKg: z.number().positive().max(1000).optional(),
  heightCm: z.number().positive().max(300).optional(),
  painScore: z.number().int().min(0).max(10).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "At least one triage observation is required",
});
