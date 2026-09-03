import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  DATABASE_SSL: booleanFromString.default(true),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  TRUST_PROXY: booleanFromString.default(false),
  SESSION_COOKIE_NAME: z.string().min(1).default("mahir_clinic_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().max(720).default(30),
  PASSWORD_PEPPER: z.string().min(32),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid backend environment: ${details}`);
  }
  return parsed.data;
}

export const env = loadEnvironment();



