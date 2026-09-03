import { Router } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import { NotificationService } from "./notification.service";

export function createNotificationRouter(service: NotificationService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged);
  router.get("/", asyncHandler(async (request, response) => {
    const unreadOnly = z.enum(["true", "false"]).default("false").transform((value) => value === "true").parse(request.query.unreadOnly);
    const limit = z.coerce.number().int().positive().max(100).default(30).parse(request.query.limit);
    response.json({ items: await service.list(request.auth!.userId, unreadOnly, limit) });
  }));
  router.patch("/read-all", asyncHandler(async (request, response) => {
    response.json({ updated: await service.markAllRead(request.auth!.userId) });
  }));
  router.patch("/:id/read", asyncHandler(async (request, response) => {
    response.json({ item: await service.markRead(z.string().uuid().parse(request.params.id), request.auth!.userId) });
  }));
  return router;
}

