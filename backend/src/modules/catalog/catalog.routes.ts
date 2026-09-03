import { Router,type Request } from "express";
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
import { catalogCreateSchema,catalogListQuerySchema,catalogUpdateSchema,inventoryAdjustmentSchema,inventoryReceiptSchema } from "./catalog.schemas";
import { CatalogService } from "./catalog.service";

export function createCatalogRouter(service:CatalogService,auth:AuthStore,env:Environment):Router{
  const router=Router();
  router.use(authenticate(auth,env.SESSION_COOKIE_NAME,env.SESSION_IDLE_MINUTES),requirePasswordChanged);
  router.get("/",requirePermission("catalog.read"),asyncHandler(async(req,res)=>{
    const parsed=catalogListQuerySchema.safeParse(req.query);
    if(!parsed.success)throw new AppError(400,"VALIDATION_ERROR","Invalid catalog query",parsed.error.flatten());
    res.json({items:await service.list(parsed.data.type,parsed.data.search,parsed.data.includeInactive??false,parsed.data.limit)});
  }));
  router.get("/panels",requirePermission("catalog.read"),asyncHandler(async(req,res)=>{
    const parsed=catalogListQuerySchema.safeParse(req.query);
    if(!parsed.success)throw new AppError(400,"VALIDATION_ERROR","Invalid catalog query",parsed.error.flatten());
    res.json({items:await service.listPanels(parsed.data.includeInactive??false,parsed.data.limit)});
  }));
  router.get("/inventory-movements",requirePermission("inventory.manage"),asyncHandler(async(req,res)=>{
    const limit=z.coerce.number().int().positive().max(500).default(100).parse(req.query.limit);
    const itemId=req.query.itemId===undefined?undefined:z.string().uuid().parse(req.query.itemId);
    res.json({items:await service.listInventoryMovements(limit,itemId)});
  }));
  router.get("/inventory-batches",requirePermission("inventory.manage"),asyncHandler(async(req,res)=>{
    const limit=z.coerce.number().int().positive().max(500).default(200).parse(req.query.limit);
    const itemId=req.query.itemId===undefined?undefined:z.string().uuid().parse(req.query.itemId);
    res.json({items:await service.listInventoryBatches(limit,itemId)});
  }));
  router.post("/",requirePermission("catalog.manage"),validateBody(catalogCreateSchema),asyncHandler(async(req,res)=>{
    res.status(201).json({item:await service.create(req.auth!.userId,req.body,meta(req))});
  }));
  router.patch("/:itemId",requirePermission("catalog.manage"),validateBody(catalogUpdateSchema),asyncHandler(async(req,res)=>{
    res.json({item:await service.update(z.string().uuid().parse(req.params.itemId),req.auth!.userId,req.body,meta(req))});
  }));
  router.post("/:itemId/inventory-receipts",requirePermission("inventory.manage"),validateBody(inventoryReceiptSchema),asyncHandler(async(req,res)=>{
    res.status(201).json({item:await service.receiveInventory(z.string().uuid().parse(req.params.itemId),req.body,req.auth!.userId,meta(req))});
  }));
  router.post("/:itemId/inventory-adjustments",requirePermission("inventory.manage"),validateBody(inventoryAdjustmentSchema),asyncHandler(async(req,res)=>{
    res.status(201).json({item:await service.adjustInventory(z.string().uuid().parse(req.params.itemId),req.body.quantityDelta,req.body.reason,req.auth!.userId,meta(req))});
  }));
  return router;
}
function meta(req:Request):RequestMetadata{return{requestId:req.requestId,ipAddress:req.ip,userAgent:req.get("user-agent")};}




