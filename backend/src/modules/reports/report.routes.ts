import { Router } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import { ReportService } from "./report.service";

export function createReportRouter(service: ReportService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged, requirePermission("reports.read"));
  router.get("/dashboard", asyncHandler(async (_request, response) => response.json({ item: await service.dashboard() })));
  router.get("/period", asyncHandler(async (request, response) => {
    const iso = z.iso.datetime({ offset: true }).optional();
    response.json({ item: await service.period(iso.parse(request.query.from), iso.parse(request.query.to)) });
  }));
  return router;
}

