import { apiRequest } from "@/lib/api/client";
import type { CatalogItem } from "@/lib/api/clinical";

export type InventoryMovement = {
  id: string;
  catalog_item_id: string;
  item_code: string;
  item_name: string;
  unit: string | null;
  movement_type: "opening" | "adjustment_in" | "adjustment_out" | "dispense" | string;
  quantity_delta: string;
  balance_after: string;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  actor_user_id: string;
  actor_name: string;
  occurred_at: string;
};

export function listInventoryMovements(signal?: AbortSignal, itemId?: string) {
  const query = new URLSearchParams({ limit: "200" });
  if (itemId) query.set("itemId", itemId);
  return apiRequest<{ items: InventoryMovement[] }>(`/catalog/inventory-movements?${query}`, { signal });
}

export function adjustInventory(itemId: string, quantityDelta: number, reason: string) {
  return apiRequest<{ item: CatalogItem }>(`/catalog/${itemId}/inventory-adjustments`, {
    method: "POST",
    body: JSON.stringify({ quantityDelta, reason }),
  });
}
