import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/app-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function originGuard(allowedOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }
    const origin = request.get("origin");
    if (origin && origin !== allowedOrigin) {
      next(new AppError(403, "INVALID_ORIGIN", "Request origin is not allowed"));
      return;
    }
    next();
  };
}
