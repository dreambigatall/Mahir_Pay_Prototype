import { Router, type Request } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requireAnyPermission } from "../../middleware/authorize-any";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { validateBody } from "../../middleware/validate";
import { AppError } from "../../shared/errors/app-error";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import type { RequestMetadata } from "../audit/audit.repository";
import { createStaffSchema, setStaffStatusSchema } from "./staff.schemas";
import { StaffService } from "./staff.service";

export function createStaffRouter(service: StaffService, authStore: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(authStore, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES));
  router.use(requirePasswordChanged);

  router.get(
    "/roles",
    requirePermission("roles.read"),
    asyncHandler(async (_request, response) => response.json({ items: await service.listRoles() })),
  );
  router.get(
    "/doctors",
    requireAnyPermission("visit.manage", "roles.read", "staff.manage"),
    asyncHandler(async (_request, response) => response.json({ items: await service.listDoctors() })),
  );
  router.get(
    "/",
    requirePermission("staff.manage"),
    asyncHandler(async (request, response) => {
      const query = z.object({
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().max(100).default(25),
      }).safeParse(request.query);
      if (!query.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid pagination", query.error.flatten());
      const result = await service.list(query.data.page, query.data.pageSize);
      response.json({ ...result, page: query.data.page, pageSize: query.data.pageSize });
    }),
  );
  router.post(
    "/",
    requirePermission("staff.manage"),
    validateBody(createStaffSchema),
    asyncHandler(async (request, response) => {
      const item = await service.create(request.auth!.userId, request.body, metadataFrom(request));
      response.status(201).json({ item });
    }),
  );
  router.patch(
    "/:userId/status",
    requirePermission("staff.manage"),
    validateBody(setStaffStatusSchema),
    asyncHandler(async (request, response) => {
      const userId = z.string().uuid().parse(request.params.userId);
      const item = await service.setStatus(request.auth!.userId, userId, request.body.status, metadataFrom(request));
      response.json({ item });
    }),
  );
  return router;
}

function metadataFrom(request: Request): RequestMetadata {
  return { requestId: request.requestId, ipAddress: request.ip, userAgent: request.get("user-agent") };
}
