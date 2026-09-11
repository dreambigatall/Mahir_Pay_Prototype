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
import {
  catalogCreateSchema,
  catalogListQuerySchema,
  catalogUpdateSchema,
  inventoryAdjustmentSchema,
  inventoryConsumeSchema,
  inventoryReceiptLinesSchema,
  inventoryReceiptSchema,
  inventoryTransferSchema,
  inventoryCountSchema,
  supplyBundleSchema,
  supplyGroupCreateSchema,
  supplyUsageRequestCreateSchema,
  supplyUsageRequestListQuerySchema,
  supplyUsageRequestRejectSchema,
  supplyUsageRequestReviewSchema,
} from "./catalog.schemas";
import { CatalogService } from "./catalog.service";

export function createCatalogRouter(
  service: CatalogService,
  auth: AuthStore,
  env: Environment,
): Router {
  const router = Router();
  router.use(
    authenticate(auth, env.SESSION_COOKIE_NAME, env.SESSION_IDLE_MINUTES),
    requirePasswordChanged,
  );
  router.get(
    "/",
    requirePermission("catalog.read"),
    asyncHandler(async (req, res) => {
      const parsed = catalogListQuerySchema.safeParse(req.query);
      if (!parsed.success)
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid catalog query",
          parsed.error.flatten(),
        );
      res.json({
        items: await service.list(
          parsed.data.type,
          parsed.data.search,
          parsed.data.includeInactive ?? false,
          parsed.data.limit,
        ),
      });
    }),
  );
  router.get(
    "/panels",
    requirePermission("catalog.read"),
    asyncHandler(async (req, res) => {
      const parsed = catalogListQuerySchema.safeParse(req.query);
      if (!parsed.success)
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid catalog query",
          parsed.error.flatten(),
        );
      res.json({
        items: await service.listPanels(
          parsed.data.includeInactive ?? false,
          parsed.data.limit,
        ),
      });
    }),
  );
  router.get(
    "/inventory-movements",
    requirePermission("inventory.read"),
    asyncHandler(async (req, res) => {
      const limit = z.coerce
        .number()
        .int()
        .positive()
        .max(500)
        .default(100)
        .parse(req.query.limit);
      const itemId =
        req.query.itemId === undefined
          ? undefined
          : z.string().uuid().parse(req.query.itemId);
      const itemType =
        req.query.type === undefined
          ? undefined
          : z.enum(["drug", "supply"]).parse(req.query.type);
      res.json({
        items: await service.listInventoryMovements(limit, itemId, itemType),
      });
    }),
  );
  router.get(
    "/inventory-batches",
    requirePermission("inventory.read"),
    asyncHandler(async (req, res) => {
      const limit = z.coerce
        .number()
        .int()
        .positive()
        .max(500)
        .default(200)
        .parse(req.query.limit);
      const itemId =
        req.query.itemId === undefined
          ? undefined
          : z.string().uuid().parse(req.query.itemId);
      const itemType =
        req.query.type === undefined
          ? undefined
          : z.enum(["drug", "supply"]).parse(req.query.type);
      res.json({
        items: await service.listInventoryBatches(limit, itemId, itemType),
      });
    }),
  );
  router.get(
    "/inventory-locations",
    requirePermission("inventory.read"),
    asyncHandler(async (_req, res) =>
      res.json({ items: await service.listInventoryLocations() }),
    ),
  );
  router.get(
    "/inventory-stock",
    requirePermission("inventory.read"),
    asyncHandler(async (req, res) => {
      const type =
        req.query.type === undefined
          ? undefined
          : z.enum(["drug", "supply"]).parse(req.query.type);
      res.json({ items: await service.listLocationStock(type) });
    }),
  );
  router.get(
    "/supply-usage-requests",
    requirePermission("inventory.read"),
    asyncHandler(async (req, res) => {
      const parsed = supplyUsageRequestListQuerySchema.safeParse(req.query);
      if (!parsed.success)
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid usage request query",
          parsed.error.flatten(),
        );
      res.json({
        items: await service.listSupplyUsageRequests({
          status: parsed.data.status,
          requestedBy: parsed.data.mine ? req.auth!.userId : undefined,
          limit: parsed.data.limit,
        }),
      });
    }),
  );
  router.post(
    "/supply-usage-requests",
    requirePermission("inventory.request"),
    validateBody(supplyUsageRequestCreateSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.createSupplyUsageRequest(
          req.body,
          req.auth!.userId,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/supply-usage-requests/:requestId/approve",
    requirePermission("inventory.approve"),
    validateBody(supplyUsageRequestReviewSchema),
    asyncHandler(async (req, res) => {
      res.json({
        item: await service.approveSupplyUsageRequest(
          z.string().uuid().parse(req.params.requestId),
          req.auth!.userId,
          req.body.reviewNote,
          meta(req),
          key(req),
        ),
      });
    }),
  );
  router.post(
    "/supply-usage-requests/:requestId/reject",
    requirePermission("inventory.approve"),
    validateBody(supplyUsageRequestRejectSchema),
    asyncHandler(async (req, res) => {
      res.json({
        item: await service.rejectSupplyUsageRequest(
          z.string().uuid().parse(req.params.requestId),
          req.auth!.userId,
          req.body.reviewNote,
          meta(req),
        ),
      });
    }),
  );
  router.get(
    "/supply-groups",
    requirePermission("inventory.read"),
    asyncHandler(async (_req, res) => {
      res.json({ items: await service.listSupplyGroups() });
    }),
  );
  router.post(
    "/supply-groups",
    requirePermission("inventory.configure"),
    validateBody(supplyGroupCreateSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.createSupplyGroup(
          req.auth!.userId,
          req.body.name,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/supplies",
    requirePermission("inventory.configure"),
    validateBody(supplyBundleSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        items: await service.createSupplies(
          req.auth!.userId,
          req.body,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/inventory-receipts",
    requirePermission("inventory.receive"),
    validateBody(inventoryReceiptLinesSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        items: await service.receiveInventoryLines(
          req.body,
          req.auth!.userId,
          meta(req),
          key(req),
        ),
      });
    }),
  );
  router.post(
    "/",
    requirePermission("catalog.manage"),
    validateBody(catalogCreateSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.create(req.auth!.userId, req.body, meta(req)),
      });
    }),
  );
  router.patch(
    "/:itemId",
    requirePermission("catalog.manage"),
    validateBody(catalogUpdateSchema),
    asyncHandler(async (req, res) => {
      res.json({
        item: await service.update(
          z.string().uuid().parse(req.params.itemId),
          req.auth!.userId,
          req.body,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/:itemId/inventory-receipts",
    requirePermission("inventory.receive"),
    validateBody(inventoryReceiptSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.receiveInventory(
          z.string().uuid().parse(req.params.itemId),
          { ...req.body, idempotencyKey: key(req) },
          req.auth!.userId,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/:itemId/inventory-adjustments",
    requirePermission("inventory.adjust"),
    validateBody(inventoryAdjustmentSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.adjustInventory(
          z.string().uuid().parse(req.params.itemId),
          req.body.quantityDelta,
          req.body.reason,
          req.auth!.userId,
          meta(req),
        ),
      });
    }),
  );
  router.post(
    "/:itemId/inventory-consume",
    requirePermission("inventory.adjust"),
    validateBody(inventoryConsumeSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({
        item: await service.consumeInventory(
          z.string().uuid().parse(req.params.itemId),
          req.body.quantity,
          req.body.reason,
          req.body.locationId,
          req.auth!.userId,
          meta(req),
          key(req),
        ),
      });
    }),
  );
  router.post(
    "/:itemId/inventory-transfer",
    requirePermission("inventory.transfer"),
    validateBody(inventoryTransferSchema),
    asyncHandler(async (req, res) =>
      res.status(201).json({
        item: await service.transferInventory(
          z.string().uuid().parse(req.params.itemId),
          { ...req.body, idempotencyKey: key(req) },
          req.auth!.userId,
          meta(req),
        ),
      }),
    ),
  );
  router.post(
    "/:itemId/inventory-count",
    requirePermission("inventory.count"),
    validateBody(inventoryCountSchema),
    asyncHandler(async (req, res) =>
      res.status(201).json({
        item: await service.countInventory(
          z.string().uuid().parse(req.params.itemId),
          { ...req.body, idempotencyKey: key(req) },
          req.auth!.userId,
          meta(req),
        ),
      }),
    ),
  );
  return router;
}
function meta(req: Request): RequestMetadata {
  return {
    requestId: req.requestId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  };
}
function key(req: Request) {
  return z
    .string()
    .trim()
    .min(8)
    .max(200)
    .parse(req.get("idempotency-key") ?? req.requestId);
}
