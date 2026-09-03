import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/app-error";

export function requireAnyPermission(...permissions: string[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
      return;
    }
    if (!permissions.some((permission) => request.auth!.permissions.includes(permission))) {
      next(new AppError(403, "PERMISSION_DENIED", "You do not have permission for this action"));
      return;
    }
    next();
  };
}
