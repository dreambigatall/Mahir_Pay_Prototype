import { apiRequest } from "@/lib/api/client";
import type { CatalogItem, LabPanel, PanelMember } from "@/lib/api/clinical";

export type { CatalogItem, LabPanel, PanelMember };
export type CatalogItemType = CatalogItem["item_type"];

export function listCatalogItems(options?: {
  type?: CatalogItemType;
  search?: string;
  includeInactive?: boolean;
  signal?: AbortSignal;
}) {
  const query = new URLSearchParams({ limit: "200" });
  if (options?.type) query.set("type", options.type);
  if (options?.search) query.set("search", options.search);
  if (options?.includeInactive) query.set("includeInactive", "true");
  return apiRequest<{ items: CatalogItem[] }>(`/catalog?${query}`, { signal: options?.signal });
}

export function listLabPanels(options?: { includeInactive?: boolean; signal?: AbortSignal }) {
  const query = new URLSearchParams({ limit: "200" });
  if (options?.includeInactive) query.set("includeInactive", "true");
  return apiRequest<{ items: LabPanel[] }>(`/catalog/panels?${query}`, { signal: options?.signal });
}

export type SupplyGroup = { id: string; name: string; item_count: string };

export function listSupplyGroups(signal?: AbortSignal) {
  return apiRequest<{ items: SupplyGroup[] }>("/catalog/supply-groups", { signal });
}

export function createSupplyGroup(name: string) {
  return apiRequest<{ item: SupplyGroup }>("/catalog/supply-groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function createSupplies(input: {
  groupId?: string;
  groupName?: string;
  items: Array<{ name: string; unit?: string; openingQuantity?: number; reorderLevel?: number }>;
}) {
  return apiRequest<{ items: CatalogItem[] }>("/catalog/supplies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createCatalogItem(input: {
  itemType: Exclude<CatalogItemType, "lab_panel" | "supply">;
  name: string;
  price: number;
  description?: string;
  unit?: string;
  trackInventory?: boolean;
  openingQuantity?: number;
  reorderLevel?: number;
}) {
  return apiRequest<{ item: CatalogItem }>("/catalog", {
    method: "POST",
    body: JSON.stringify({
      itemType: input.itemType,
      name: input.name,
      price: input.price,
      description: input.description,
      unit: input.unit,
      trackInventory: input.trackInventory ?? false,
      openingQuantity: input.openingQuantity ?? 0,
      reorderLevel: input.reorderLevel ?? 0,
    }),
  });
}

export function createLabPanel(input: {
  name: string;
  description?: string;
  memberItemIds: string[];
}) {
  return apiRequest<{ item: LabPanel }>("/catalog", {
    method: "POST",
    body: JSON.stringify({
      itemType: "lab_panel",
      name: input.name,
      description: input.description,
      memberItemIds: input.memberItemIds,
    }),
  });
}

export function updateCatalogItem(
  itemId: string,
  input: {
    name?: string;
    description?: string | null;
    unit?: string | null;
    price?: number;
    active?: boolean;
    reorderLevel?: number;
    memberItemIds?: string[];
  },
) {
  return apiRequest<{ item: CatalogItem | LabPanel }>(`/catalog/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
