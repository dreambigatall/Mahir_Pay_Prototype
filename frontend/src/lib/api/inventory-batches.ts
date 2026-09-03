import { apiRequest } from "@/lib/api/client";

export type InventoryBatch = {
  id: string; catalog_item_id: string; item_code: string; item_name: string; unit: string | null;
  batch_number: string; supplier_name: string; purchase_reference: string | null;
  received_quantity: string; quantity_remaining: string; expiry_date: string | null; unit_cost: string | null;
  received_by: string; received_by_name: string; received_at: string; expired: boolean; days_to_expiry: number | null;
};

export type InventoryReceiptInput = {
  batchNumber: string; supplierName: string; purchaseReference?: string; quantity: number; expiryDate?: string; unitCost?: number;
};

export function listInventoryBatches(signal?: AbortSignal) {
  return apiRequest<{ items: InventoryBatch[] }>("/catalog/inventory-batches?limit=500", { signal });
}

export function receiveInventoryBatch(itemId: string, input: InventoryReceiptInput) {
  return apiRequest<{ item: InventoryBatch }>(`/catalog/${itemId}/inventory-receipts`, { method: "POST", body: JSON.stringify(input) });
}
