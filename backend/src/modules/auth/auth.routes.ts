import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../shared/http/async-handler";
import type { RequestMetadata } from "../audit/audit.repository";
import type { AuthStore } from "./auth.repository";
import { changePasswordSchema, loginSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";

export function createAuthRouter(service: AuthService, store: AuthStore, env: Environment): Router {
  const router = Router();
  const sessionAuth = authenticate(store, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });

  router.post(
    "/login",
    loginLimiter,
    validateBody(loginSchema),
    asyncHandler(async (request, response) => {
      const result = await service.login(request.body.email, request.body.password, metadataFrom(request));
      response.cookie(env.SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        expires: result.expiresAt,
        path: "/",
      });
      response.status(200).json({ user: result.user });
    }),
  );

  router.get("/me", sessionAuth, (request, response) => response.json({ user: request.auth }));

  router.post(
    "/logout",
    sessionAuth,
    asyncHandler(async (request, response) => {
      await service.logout(request.auth!.sessionId, request.auth!.userId, metadataFrom(request));
      clearSessionCookie(response, env);
      response.status(204).end();
    }),
  );

  router.post(
    "/change-password",
    sessionAuth,
    validateBody(changePasswordSchema),
    asyncHandler(async (request, response) => {
      const result = await service.changePassword(
        request.auth!.userId,
        request.body.currentPassword,
        request.body.newPassword,
        metadataFrom(request),
      );
      response.cookie(env.SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        expires: result.expiresAt,
        path: "/",
      });
      response.status(200).json({ user: result.user });
    }),
  );
  return router;
}

function metadataFrom(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}

function clearSessionCookie(response: Response, env: Environment): void {
  response.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
