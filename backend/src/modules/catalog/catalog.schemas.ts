import { z } from "zod";

const quantity = z.number().nonnegative().max(999_999_999).multipleOf(0.001);
const memberIds = z
  .array(z.string().uuid())
  .min(1)
  .max(30)
  .transform((ids) => [...new Set(ids)]);

const standardCatalogCreateSchema = z
  .object({
    itemType: z.enum([
      "consultation",
      "lab_test",
      "radiology",
      "drug",
      "procedure",
    ]),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000).optional(),
    unit: z.string().trim().min(1).max(50).optional(),
    price: z.number().nonnegative().max(999_999_999.99).multipleOf(0.01),
    trackInventory: z.boolean().default(false),
    openingQuantity: quantity.default(0),
    reorderLevel: quantity.default(0),
  })
  .superRefine((v, c) => {
    if (v.trackInventory && v.itemType !== "drug") {
      c.addIssue({
        code: "custom",
        path: ["trackInventory"],
        message: "Only drugs can track inventory",
      });
    }
    if (!v.trackInventory && v.openingQuantity > 0) {
      c.addIssue({
        code: "custom",
        path: ["openingQuantity"],
        message: "Inventory tracking is required",
      });
    }
  });

const labPanelCreateSchema = z.object({
  itemType: z.literal("lab_panel"),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000).optional(),
  memberItemIds: memberIds,
});

export const catalogCreateSchema = z.discriminatedUnion("itemType", [
  standardCatalogCreateSchema,
  labPanelCreateSchema,
]);

export const catalogUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(2000).nullable().optional(),
    unit: z.string().trim().min(1).max(50).nullable().optional(),
    price: z
      .number()
      .nonnegative()
      .max(999_999_999.99)
      .multipleOf(0.01)
      .optional(),
    active: z.boolean().optional(),
    reorderLevel: quantity.optional(),
    memberItemIds: memberIds.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const inventoryReceiptSchema = z
  .object({
    batchNumber: z.string().trim().min(1).max(100),
    supplierName: z.string().trim().min(1).max(200),
    purchaseReference: z.string().trim().min(1).max(100).optional(),
    quantity: quantity.refine((v) => v > 0),
    expiryDate: z.iso.date().optional(),
    unitCost: z
      .number()
      .nonnegative()
      .max(999_999_999.99)
      .multipleOf(0.01)
      .optional(),
    locationId: z.string().uuid().optional(),
    packQuantity: quantity.refine((v) => v > 0).optional(),
    unitsPerPack: quantity.refine((v) => v > 0).default(1),
  })
  .superRefine((v, c) => {
    if (v.expiryDate && v.expiryDate <= new Date().toISOString().slice(0, 10)) {
      c.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be in the future",
      });
    }
  });

export const inventoryReceiptLinesSchema = z.object({
  supplierName: z.string().trim().min(1).max(200),
  purchaseReference: z.string().trim().min(1).max(100),
  locationId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        catalogItemId: z.string().uuid(),
        batchNumber: z.string().trim().min(1).max(100),
        packQuantity: quantity.refine((v) => v > 0),
        unitsPerPack: quantity.refine((v) => v > 0).default(1),
        expiryDate: z.iso.date().optional(),
        unitCost: z
          .number()
          .nonnegative()
          .max(999_999_999.99)
          .multipleOf(0.01)
          .optional(),
      }),
    )
    .min(1)
    .max(30),
}).superRefine((value, context) => {
  value.lines.forEach((line, index) => {
    if (line.expiryDate && line.expiryDate <= new Date().toISOString().slice(0, 10)) {
      context.addIssue({ code: "custom", path: ["lines", index, "expiryDate"], message: "Expiry date must be in the future" });
    }
  });
});

export const inventoryTransferSchema = z.object({
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: quantity.refine((v) => v > 0),
  reason: z.string().trim().min(1).max(500),
  reference: z.string().trim().min(1).max(100).optional(),
});

export const inventoryCountSchema = z.object({
  locationId: z.string().uuid(),
  countedQuantity: quantity,
  reason: z.string().trim().min(1).max(500),
  reference: z.string().trim().min(1).max(100).optional(),
});

export const inventoryAdjustmentSchema = z.object({
  quantityDelta: z
    .number()
    .min(-999_999_999)
    .max(999_999_999)
    .multipleOf(0.001)
    .refine((v) => v !== 0),
  reason: z.string().trim().min(1).max(500),
});

export const inventoryConsumeSchema = z.object({
  quantity: quantity.refine((v) => v > 0),
  reason: z.string().trim().min(1).max(500),
  locationId: z.string().uuid(),
});

export const supplyUsageRequestCreateSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: quantity.refine((v) => v > 0),
  reason: z.string().trim().min(1).max(500),
  locationId: z.string().uuid().optional(),
});

export const supplyUsageRequestReviewSchema = z.object({
  reviewNote: z.string().trim().min(1).max(500).optional(),
});

export const supplyUsageRequestRejectSchema = z.object({
  reviewNote: z.string().trim().min(1).max(500),
});

export const supplyUsageRequestListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  mine: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const catalogListQuerySchema = z.object({
  type: z
    .enum([
      "consultation",
      "lab_test",
      "radiology",
      "drug",
      "procedure",
      "lab_panel",
      "supply",
    ])
    .optional(),
  search: z.string().trim().max(100).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const supplyGroupCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const supplyBundleSchema = z
  .object({
    groupId: z.string().uuid().optional(),
    groupName: z.string().trim().min(1).max(200).optional(),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          unit: z.string().trim().min(1).max(50).optional(),
          openingQuantity: quantity.default(0),
          reorderLevel: quantity.default(0),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((v, c) => {
    if (!v.groupId && !v.groupName) {
      c.addIssue({
        code: "custom",
        path: ["groupName"],
        message: "Create or choose a supply type",
      });
    }
  });

export type CatalogCreateInput = z.infer<typeof catalogCreateSchema>;
export type CatalogUpdateInput = z.infer<typeof catalogUpdateSchema>;
export type SupplyBundleInput = z.infer<typeof supplyBundleSchema>;
