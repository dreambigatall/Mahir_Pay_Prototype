import type { RequestHandler } from "express";

import type { AuthStore } from "../modules/auth/auth.repository";
import { AppError } from "../shared/errors/app-error";
import { hashSessionToken } from "../shared/security/session-token";

export function authenticate(
  store: AuthStore,
  cookieName: string,
  idleMinutes: number,
): RequestHandler {
  return async (request, _response, next) => {
    try {
      const token = request.cookies?.[cookieName];
      if (typeof token !== "string" || token.length < 20) {
        throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
      }
      const principal = await store.findPrincipalByTokenHash(hashSessionToken(token));
      if (!principal) {
        throw new AppError(401, "SESSION_INVALID", "Session is invalid or expired");
      }
      request.auth = {
        sessionId: principal.session_id,
        userId: principal.user_id,
        email: principal.email,
        fullName: principal.full_name,
        mustChangePassword: principal.must_change_password,
        roles: principal.roles,
        title: principal.title,
        room: principal.room,
        permissions: principal.permissions,
      };
      await store.touchSession(principal.session_id, idleMinutes);
      next();
    } catch (error) {
      next(error);
    }
  };
}
