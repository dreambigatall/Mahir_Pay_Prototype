import { apiRequest } from "@/lib/api/client";
import type { CatalogItem } from "@/lib/api/clinical";

export type InventoryMovement = {
  id: string;
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  movement_type:
    | "opening"
    | "adjustment_in"
    | "adjustment_out"
    | "dispense"
    | "consume"
    | "receipt"
    | string;
  quantity_delta: string;
  movement_quantity: string;
  balance_after: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  actor_user_id: string;
  actor_name: string;
  occurred_at: string;
  transaction_reference: string | null;
  source_location_id: string | null;
  source_location_name: string | null;
  destination_location_id: string | null;
  destination_location_name: string | null;
};

export type InventoryLocation = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};
export type LocationStock = {
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  item_type: "drug" | "supply";
  unit: string | null;
  supply_group_id: string | null;
  supply_group_name: string | null;
  location_id: string;
  location_name: string;
  quantity_on_hand: string;
  usable_quantity: string;
  reorder_level: string;
  suggested_order_quantity: string;
  next_expiry: string | null;
  last_counted_at: string | null;
};

export function listInventoryMovements(
  signal?: AbortSignal,
  itemId?: string,
  itemType?: "drug" | "supply",
) {
  const query = new URLSearchParams({ limit: "200" });
  if (itemId) query.set("itemId", itemId);
  if (itemType) query.set("type", itemType);
  return apiRequest<{ items: InventoryMovement[] }>(
    `/catalog/inventory-movements?${query}`,
    { signal },
  );
}

export function adjustInventory(
  itemId: string,
  quantityDelta: number,
  reason: string,
) {
  return apiRequest<{ item: CatalogItem }>(
    `/catalog/${itemId}/inventory-adjustments`,
    {
      method: "POST",
      body: JSON.stringify({ quantityDelta, reason }),
    },
  );
}

export function consumeInventory(
  itemId: string,
  quantity: number,
  reason: string,
  locationId: string,
) {
  return apiRequest<{ item: CatalogItem }>(
    `/catalog/${itemId}/inventory-consume`,
    {
      method: "POST",
      body: JSON.stringify({ quantity, reason, locationId }),
      headers: { "Idempotency-Key": crypto.randomUUID() },
    },
  );
}

export type SupplyUsageRequest = {
  id: string;
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  supply_group_name: string | null;
  location_id: string;
  location_name: string;
  quantity: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  requested_by_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  movement_id: string | null;
  quantity_on_hand: string | null;
  created_at: string;
  updated_at: string;
};

export function listSupplyUsageRequests(
  options?: {
    status?: "pending" | "approved" | "rejected";
    mine?: boolean;
    signal?: AbortSignal;
  },
) {
  const query = new URLSearchParams({ limit: "100" });
  if (options?.status) query.set("status", options.status);
  if (options?.mine) query.set("mine", "true");
  return apiRequest<{ items: SupplyUsageRequest[] }>(
    `/catalog/supply-usage-requests?${query}`,
    { signal: options?.signal },
  );
}

export function createSupplyUsageRequest(input: {
  catalogItemId: string;
  quantity: number;
  reason: string;
  locationId?: string;
}) {
  return apiRequest<{ item: SupplyUsageRequest }>(
    "/catalog/supply-usage-requests",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function approveSupplyUsageRequest(
  requestId: string,
  reviewNote?: string,
) {
  return apiRequest<{ item: SupplyUsageRequest }>(
    `/catalog/supply-usage-requests/${requestId}/approve`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ reviewNote }),
    },
  );
}

export function rejectSupplyUsageRequest(requestId: string, reviewNote: string) {
  return apiRequest<{ item: SupplyUsageRequest }>(
    `/catalog/supply-usage-requests/${requestId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reviewNote }),
    },
  );
}

export function listInventoryLocations(signal?: AbortSignal) {
  return apiRequest<{ items: InventoryLocation[] }>(
    "/catalog/inventory-locations",
    { signal },
  );
}
export function listLocationStock(
  type?: "drug" | "supply",
  signal?: AbortSignal,
) {
  return apiRequest<{ items: LocationStock[] }>(
    `/catalog/inventory-stock${type ? `?type=${type}` : ""}`,
    { signal },
  );
}
export function transferInventory(
  itemId: string,
  input: {
    sourceLocationId: string;
    destinationLocationId: string;
    quantity: number;
    reason: string;
    reference?: string;
  },
) {
  return apiRequest<{ item: unknown }>(
    `/catalog/${itemId}/inventory-transfer`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );
}
export function countInventory(
  itemId: string,
  input: {
    locationId: string;
    countedQuantity: number;
    reason: string;
    reference?: string;
  },
) {
  return apiRequest<{ item: unknown }>(`/catalog/${itemId}/inventory-count`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}
