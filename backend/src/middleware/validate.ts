import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../shared/errors/app-error";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Request validation failed", parsed.error.flatten()));
      return;
    }
    request.body = parsed.data;
    next();
  };
}
