import { AppError } from "../../shared/errors/app-error";
import type { RequestMetadata } from "../audit/audit.repository";
import { CatalogRepository } from "./catalog.repository";
import type {
  CatalogCreateInput,
  CatalogUpdateInput,
  SupplyBundleInput,
} from "./catalog.schemas";

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}
  list(
    type: string | undefined,
    search: string | undefined,
    includeInactive: boolean,
    limit: number,
  ) {
    return this.repository.list(type, search, includeInactive, limit);
  }
  listPanels(includeInactive: boolean, limit: number) {
    return this.repository.listPanels(includeInactive, limit);
  }
  async create(
    actor: string,
    input: CatalogCreateInput,
    metadata: RequestMetadata,
  ) {
    try {
      if (input.itemType === "lab_panel") {
        return await this.repository.createLabPanel(
          {
            name: input.name,
            description: input.description,
            memberItemIds: input.memberItemIds,
          },
          actor,
          {
            ...metadata,
            actorUserId: actor,
            action: "catalog.panel_created",
            resourceType: "catalog_item",
          },
        );
      }
      return await this.repository.create(
        {
          itemType: input.itemType,
          name: input.name,
          description: input.description,
          unit: input.unit,
          price: input.price,
          trackInventory: input.trackInventory,
          openingQuantity: input.openingQuantity,
          reorderLevel: input.reorderLevel,
        },
        actor,
        {
          ...metadata,
          actorUserId: actor,
          action: "catalog.created",
          resourceType: "catalog_item",
        },
      );
    } catch (error) {
      if (isUnique(error))
        throw new AppError(
          409,
          "CATALOG_ITEM_EXISTS",
          "A catalog item with this type and name already exists",
        );
      throw error;
    }
  }
  async update(
    id: string,
    actor: string,
    input: CatalogUpdateInput,
    metadata: RequestMetadata,
  ) {
    try {
      return await this.repository.update(id, input, actor, {
        ...metadata,
        actorUserId: actor,
        action: "catalog.updated",
        resourceType: "catalog_item",
      });
    } catch (error) {
      if (isUnique(error))
        throw new AppError(
          409,
          "CATALOG_ITEM_EXISTS",
          "A catalog item with this type and name already exists",
        );
      throw error;
    }
  }
  async receiveInventory(
    id: string,
    input: Parameters<CatalogRepository["receiveBatch"]>[1],
    actor: string,
    metadata: RequestMetadata,
  ) {
    try {
      return await this.repository.receiveBatch(id, input, actor, {
        ...metadata,
        actorUserId: actor,
        action: "inventory.received",
        resourceType: "inventory_batch",
      });
    } catch (error) {
      if (isUnique(error))
        throw new AppError(
          409,
          "INVENTORY_BATCH_EXISTS",
          "This batch number already exists for the selected medication",
        );
      throw error;
    }
  }
  async receiveInventoryLines(
    input: {
      supplierName: string;
      purchaseReference: string;
      locationId: string;
      lines: Array<{
        catalogItemId: string;
        batchNumber: string;
        packQuantity: number;
        unitsPerPack: number;
        expiryDate?: string;
        unitCost?: number;
      }>;
    },
    actor: string,
    metadata: RequestMetadata,
    idempotencyKey: string,
  ) {
    const items = [];
    for (let index = 0; index < input.lines.length; index += 1) {
      const line = input.lines[index]!;
      items.push(
        await this.receiveInventory(
          line.catalogItemId,
          {
            batchNumber: line.batchNumber,
            supplierName: input.supplierName,
            purchaseReference: input.purchaseReference,
            quantity: line.packQuantity * line.unitsPerPack,
            packQuantity: line.packQuantity,
            unitsPerPack: line.unitsPerPack,
            expiryDate: line.expiryDate,
            unitCost: line.unitCost,
            locationId: input.locationId,
            idempotencyKey: `${idempotencyKey}:${index}`,
          },
          actor,
          metadata,
        ),
      );
    }
    return items;
  }
  listInventoryBatches(limit: number, itemId?: string, itemType?: string) {
    return this.repository.listInventoryBatches(limit, itemId, itemType);
  }
  listInventoryMovements(limit: number, itemId?: string, itemType?: string) {
    return this.repository.listInventoryMovements(limit, itemId, itemType);
  }
  adjustInventory(
    id: string,
    delta: number,
    reason: string,
    actor: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.adjustInventory(id, delta, reason, actor, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.adjusted",
      resourceType: "catalog_item",
    });
  }
  consumeInventory(
    id: string,
    quantity: number,
    reason: string,
    locationId: string,
    actor: string,
    metadata: RequestMetadata,
    idempotencyKey?: string,
  ) {
    return this.repository.consumeInventory(
      id,
      quantity,
      reason,
      locationId,
      actor,
      {
        ...metadata,
        actorUserId: actor,
        action: "inventory.consumed",
        resourceType: "catalog_item",
      },
      idempotencyKey,
    );
  }
  createSupplyUsageRequest(
    input: {
      catalogItemId: string;
      quantity: number;
      reason: string;
      locationId?: string;
    },
    actor: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.createSupplyUsageRequest(input, actor, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.usage_requested",
      resourceType: "supply_usage_request",
    });
  }
  listSupplyUsageRequests(input: {
    status?: "pending" | "approved" | "rejected";
    requestedBy?: string;
    limit: number;
  }) {
    return this.repository.listSupplyUsageRequests(input);
  }
  approveSupplyUsageRequest(
    id: string,
    actor: string,
    reviewNote: string | undefined,
    metadata: RequestMetadata,
    idempotencyKey?: string,
  ) {
    return this.repository.approveSupplyUsageRequest(
      id,
      actor,
      reviewNote,
      {
        ...metadata,
        actorUserId: actor,
        action: "inventory.usage_approved",
        resourceType: "supply_usage_request",
      },
      idempotencyKey,
    );
  }
  rejectSupplyUsageRequest(
    id: string,
    actor: string,
    reviewNote: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.rejectSupplyUsageRequest(id, actor, reviewNote, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.usage_rejected",
      resourceType: "supply_usage_request",
    });
  }
  listInventoryLocations() {
    return this.repository.listInventoryLocations();
  }
  listLocationStock(itemType?: string) {
    return this.repository.listLocationStock(itemType);
  }
  transferInventory(
    id: string,
    input: Parameters<CatalogRepository["transferInventory"]>[1],
    actor: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.transferInventory(id, input, actor, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.transferred",
      resourceType: "catalog_item",
    });
  }
  countInventory(
    id: string,
    input: Parameters<CatalogRepository["countInventory"]>[1],
    actor: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.countInventory(id, input, actor, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.counted",
      resourceType: "inventory_stock_count",
    });
  }
  listSupplyGroups() {
    return this.repository.listSupplyGroups();
  }
  async createSupplyGroup(
    actor: string,
    name: string,
    metadata: RequestMetadata,
  ) {
    return this.repository.createSupplyGroup(name, actor, {
      ...metadata,
      actorUserId: actor,
      action: "inventory.supply_group_created",
      resourceType: "supply_group",
    });
  }
  async createSupplies(
    actor: string,
    input: SupplyBundleInput,
    metadata: RequestMetadata,
  ) {
    try {
      return await this.repository.createSupplyBundle(input, actor, {
        ...metadata,
        actorUserId: actor,
        action: "inventory.supplies_created",
        resourceType: "supply_group",
      });
    } catch (error) {
      if (isUnique(error))
        throw new AppError(
          409,
          "CATALOG_ITEM_EXISTS",
          "A supply with this name already exists",
        );
      throw error;
    }
  }
}
function isUnique(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
