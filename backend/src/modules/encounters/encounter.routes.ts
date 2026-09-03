import { Router, type Request } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import type { RequestMetadata } from "../audit/audit.repository";
import { encounterAmendmentSchema, encounterDocumentSchema, startEncounterSchema } from "./encounter.schemas";
import { EncounterService } from "./encounter.service";

export function createEncounterRouter(service: EncounterService, authStore: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(authStore, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES));
  router.use(requirePasswordChanged);

  router.post(
    "/",
    requirePermission("encounter.start"),
    validateBody(startEncounterSchema),
    asyncHandler(async (request, response) => {
      const item = await service.start(
        request.body.visitId,
        request.auth!.userId,
        request.auth!.roles,
        metadataFrom(request),
      );
      response.status(201).json({ item });
    }),
  );
  router.get(
    "/by-visit/:visitId",
    requirePermission("encounter.read"),
    asyncHandler(async (request, response) => {
      response.json({ item: await service.getByVisit(z.string().uuid().parse(request.params.visitId)) });
    }),
  );
  router.patch(
    "/:encounterId",
    requirePermission("encounter.document"),
    validateBody(encounterDocumentSchema),
    asyncHandler(async (request, response) => {
      const item = await service.document(
        z.string().uuid().parse(request.params.encounterId),
        request.body,
        request.auth!.userId,
        request.auth!.roles,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  router.post(
    "/:encounterId/sign",
    requirePermission("encounter.sign"),
    asyncHandler(async (request, response) => {
      const item = await service.sign(
        z.string().uuid().parse(request.params.encounterId),
        request.auth!.userId,
        request.auth!.roles,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  router.post(
    "/:encounterId/amendments",
    requirePermission("encounter.sign"),
    validateBody(encounterAmendmentSchema),
    asyncHandler(async (request, response) => {
      const item = await service.amend(
        z.string().uuid().parse(request.params.encounterId),
        request.body,
        request.auth!.userId,
        metadataFrom(request),
      );
      response.status(201).json({ item });
    }),
  );
  return router;
}

function metadataFrom(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}
