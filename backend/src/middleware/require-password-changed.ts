import type { RequestHandler } from "express";

import { AppError } from "../shared/errors/app-error";

export const requirePasswordChanged: RequestHandler = (request, _response, next) => {
  if (request.auth?.mustChangePassword) {
    next(new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Change the temporary password before continuing"));
    return;
  }
  next();
};
