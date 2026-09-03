import { Router, type Request } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../shared/http/async-handler";
import type { RequestMetadata } from "../audit/audit.repository";
import type { AuthStore } from "../auth/auth.repository";
import { createReferralSchema, updateReferralStatusSchema } from "./referral.schemas";
import { ReferralService } from "./referral.service";

export function createReferralRouter(service: ReferralService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged);
  router.get("/", requirePermission("referral.read"), asyncHandler(async (request, response) => {
    const patientId = request.query.patientId === undefined ? undefined : uuid(request.query.patientId);
    const status = z.enum(["created", "sent", "accepted", "completed", "cancelled"]).optional().parse(request.query.status);
    const limit = z.coerce.number().int().positive().max(200).default(100).parse(request.query.limit);
    response.json({ items: await service.list(patientId, status, limit) });
  }));
  router.get("/:id", requirePermission("referral.read"), asyncHandler(async (request, response) => {
    response.json({ item: await service.get(uuid(request.params.id)) });
  }));
  router.post("/", requirePermission("referral.create"), validateBody(createReferralSchema), asyncHandler(async (request, response) => {
    response.status(201).json({ item: await service.create(request.auth!.userId, request.body, metadata(request)) });
  }));
  router.patch("/:id/status", requirePermission("referral.manage"), validateBody(updateReferralStatusSchema), asyncHandler(async (request, response) => {
    response.json({ item: await service.updateStatus(uuid(request.params.id), request.body.status, request.body.reason, request.auth!.userId, metadata(request)) });
  }));
  return router;
}

function uuid(value: unknown): string { return z.string().uuid().parse(value); }
function metadata(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}

