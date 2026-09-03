import pino from "pino";

import type { Environment } from "./env";

export function createLogger(environment: Pick<Environment,"NODE_ENV"|"LOG_LEVEL">) {
  return pino({
    level: environment.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization", "req.headers.cookie", "req.headers.set-cookie",
        "request.headers.authorization", "request.headers.cookie",
        "res.headers.set-cookie", "response.headers.set-cookie",
        "password", "currentPassword", "newPassword", "token", "sessionToken",
        "body.password", "body.currentPassword", "body.newPassword",
        "req.body.password", "req.body.currentPassword", "req.body.newPassword",
      ],
      censor: "[REDACTED]",
    },
    base: environment.NODE_ENV === "production" ? undefined : { service: "mahir-clinic-api" },
    transport: environment.NODE_ENV === "development" ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard", singleLine: true, ignore: "pid,hostname" } } : undefined,
  });
}
