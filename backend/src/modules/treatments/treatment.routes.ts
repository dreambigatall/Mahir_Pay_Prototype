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
import {
  administerDoseSchema,
  cancelTreatmentCourseSchema,
  createTreatmentCourseSchema,
  missDoseSchema,
} from "./treatment.schemas";
import { TreatmentService } from "./treatment.service";

export function createTreatmentRouter(service: TreatmentService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged);

  router.get("/", requirePermission("course.read"), asyncHandler(async (request, response) => {
    const patientId = optionalUuid(request.query.patientId);
    const status = z.enum(["active", "completed", "cancelled"]).optional().parse(request.query.status);
    const limit = z.coerce.number().int().positive().max(200).default(100).parse(request.query.limit);
    response.json({ items: await service.list(patientId, status, limit) });
  }));
  router.get("/:id", requirePermission("course.read"), asyncHandler(async (request, response) => {
    response.json({ item: await service.get(uuid(request.params.id)) });
  }));
  router.post("/", requirePermission("course.manage"), validateBody(createTreatmentCourseSchema), asyncHandler(async (request, response) => {
    response.status(201).json({ item: await service.create(request.auth!.userId, request.body, metadata(request)) });
  }));
  router.post("/:id/doses/:doseId/check-in", requirePermission("queue.manage"), asyncHandler(async (request, response) => {
    response.json({ item: await service.checkIn(uuid(request.params.id), uuid(request.params.doseId), request.auth!.userId, metadata(request)) });
  }));
  router.post("/:id/doses/:doseId/administer", requirePermission("procedure.administer"), validateBody(administerDoseSchema), asyncHandler(async (request, response) => {
    response.json({ item: await service.administer(uuid(request.params.id), uuid(request.params.doseId), request.body.notes, request.auth!.userId, metadata(request)) });
  }));
  router.post("/:id/doses/:doseId/miss", requirePermission("course.manage"), validateBody(missDoseSchema), asyncHandler(async (request, response) => {
    response.json({ item: await service.miss(uuid(request.params.id), uuid(request.params.doseId), request.body.reason, request.auth!.userId, metadata(request)) });
  }));
  router.post("/:id/cancel", requirePermission("course.manage"), validateBody(cancelTreatmentCourseSchema), asyncHandler(async (request, response) => {
    response.json({ item: await service.cancel(uuid(request.params.id), request.body.reason, request.auth!.userId, metadata(request)) });
  }));
  return router;
}

function uuid(value: unknown): string { return z.string().uuid().parse(value); }
function optionalUuid(value: unknown): string | undefined { return value === undefined ? undefined : uuid(value); }
function metadata(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}

