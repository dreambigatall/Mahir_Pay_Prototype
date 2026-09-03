import { Router } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import { ClinicalService } from "./clinical.service";

export function createClinicalRouter(service: ClinicalService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged);
  router.get("/visits/:visitId/triage", requirePermission("patient.read"), asyncHandler(async (request, response) => {
    response.json({ item: await service.getTriage(z.string().uuid().parse(request.params.visitId)) });
  }));
  router.get("/visits/:visitId/diagnostics", requirePermission("encounter.read"), asyncHandler(async (request, response) => {
    response.json({ items: await service.getDiagnostics(z.string().uuid().parse(request.params.visitId)) });
  }));
  return router;
}
