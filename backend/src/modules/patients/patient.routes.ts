import { Router, type Request } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../shared/errors/app-error";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import type { RequestMetadata } from "../audit/audit.repository";
import { patientListQuerySchema, patientWriteSchema } from "./patient.schemas";
import { PatientService } from "./patient.service";

export function createPatientRouter(service: PatientService, authStore: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(authStore, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES));
  router.use(requirePasswordChanged);

  router.get(
    "/",
    requirePermission("patient.read"),
    asyncHandler(async (request, response) => {
      const query = patientListQuerySchema.safeParse(request.query);
      if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid patient query", query.error.flatten());
      response.json(await service.list(query.data.search, query.data.cursor, query.data.limit));
    }),
  );
  router.get(
    "/:patientId",
    requirePermission("patient.read"),
    asyncHandler(async (request, response) => {
      response.json({ item: await service.get(z.string().uuid().parse(request.params.patientId)) });
    }),
  );
  router.post(
    "/",
    requirePermission("patient.create"),
    validateBody(patientWriteSchema),
    asyncHandler(async (request, response) => {
      const item = await service.create(request.auth!.userId, request.body, metadataFrom(request));
      response.status(201).json({ item });
    }),
  );
  router.put(
    "/:patientId",
    requirePermission("patient.update"),
    validateBody(patientWriteSchema),
    asyncHandler(async (request, response) => {
      const item = await service.update(
        z.string().uuid().parse(request.params.patientId),
        request.auth!.userId,
        request.body,
        metadataFrom(request),
      );
      response.json({ item });
    }),
  );
  return router;
}

function metadataFrom(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}
