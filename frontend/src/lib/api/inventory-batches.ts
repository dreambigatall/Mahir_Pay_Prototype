import { apiRequest } from "@/lib/api/client";

export type InventoryBatch = {
  id: string;
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  batch_number: string;
  supplier_name: string;
  purchase_reference: string | null;
  received_quantity: string;
  quantity_remaining: string;
  expiry_date: string | null;
  unit_cost: string | null;
  received_by: string;
  received_by_name: string;
  received_at: string;
  expired: boolean;
  days_to_expiry: number | null;
  pack_quantity: string | null;
  units_per_pack: string;
  locations: Array<{
    location_id: string;
    location_name: string;
    quantity: string;
  }>;
};

export type InventoryReceiptInput = {
  batchNumber: string;
  supplierName: string;
  purchaseReference?: string;
  quantity: number;
  expiryDate?: string;
  unitCost?: number;
  locationId?: string;
  packQuantity?: number;
  unitsPerPack?: number;
};

export function listInventoryBatches(
  signal?: AbortSignal,
  itemType?: "drug" | "supply",
) {
  const query = new URLSearchParams({ limit: "500" });
  if (itemType) query.set("type", itemType);
  return apiRequest<{ items: InventoryBatch[] }>(
    `/catalog/inventory-batches?${query}`,
    { signal },
  );
}

export function receiveInventoryBatch(
  itemId: string,
  input: InventoryReceiptInput,
) {
  return apiRequest<{ item: InventoryBatch }>(
    `/catalog/${itemId}/inventory-receipts`,
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );
}

export function receiveInventoryLines(input: {
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
}) {
  return apiRequest<{ items: InventoryBatch[] }>(
    "/catalog/inventory-receipts",
    {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );
}
