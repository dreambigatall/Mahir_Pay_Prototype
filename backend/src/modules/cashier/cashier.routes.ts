import { Router } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { requirePasswordChanged } from "../../middleware/require-password-changed";
import { asyncHandler } from "../../shared/http/async-handler";
import type { AuthStore } from "../auth/auth.repository";
import { CashierService } from "./cashier.service";

export function createCashierRouter(service: CashierService, auth: AuthStore, env: Environment): Router {
  const router = Router();
  router.use(authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES), requirePasswordChanged);
  router.get("/worklist", requirePermission("billing.read"), asyncHandler(async (request, response) => {
    const limit = z.coerce.number().int().positive().max(200).default(100).parse(request.query.limit);
    response.json({ items: await service.worklist(limit) });
  }));
  router.get("/suggestions/:visitId", requirePermission("billing.read"), asyncHandler(async (request, response) => {
    response.json({ items: await service.suggestions(z.string().uuid().parse(request.params.visitId)) });
  }));
  return router;
}
