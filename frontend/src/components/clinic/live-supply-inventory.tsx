"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AddSupplyDialog } from "@/components/clinic/add-supply-dialog";
import { InventoryDetail } from "@/components/clinic/live-inventory-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { listCatalog, type CatalogItem } from "@/lib/api/clinical";
import {
  listInventoryLocations,
  listInventoryMovements,
  type InventoryLocation,
  type InventoryMovement,
} from "@/lib/api/inventory";
import { receiveInventoryBatch } from "@/lib/api/inventory-batches";

export function LiveSupplyInventory({
  hideAdd = false,
}: {
  hideAdd?: boolean;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restockItem, setRestockItem] = useState<CatalogItem | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [catalog, ledger, locationResult] = await Promise.all([
        listCatalog("supply"),
        listInventoryMovements(signal, undefined, "supply"),
        listInventoryLocations(signal),
      ]);
      setItems(catalog.items);
      setMovements(ledger.items);
      setLocations(locationResult.items);
    } catch (caught) {
      if (!signal?.aborted) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Clinic supplies could not be loaded.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Initial remote-data synchronization for this client workspace.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        !query ||
        `${item.name} ${item.item_code} ${item.supply_group_name ?? ""} ${item.unit ?? ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [items, search]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const lowNames = items
    .filter((item) => isLowStock(item))
    .map((item) => item.name);

  if (selected) {
    return (
      <>
        <InventoryDetail
          item={selected}
          movements={movements.filter(
            (movement) => movement.catalog_item_id === selected.id,
          )}
          onBack={() => setSelectedId(null)}
          onRestock={() => setRestockItem(selected)}
          restockLabel="Receive"
        />
        <ReceiveSupplyDialog
          item={restockItem}
          locations={locations}
          onClose={() => setRestockItem(null)}
          onSaved={async () => {
            setRestockItem(null);
            await load();
          }}
        />
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-border/15 bg-surface-2 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-4">
      {!hideAdd ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            Clinic supplies
          </h2>
          <AddSupplyDialog onSaved={() => void load()} />
        </div>
      ) : null}

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-9 max-w-sm min-h-9"
        placeholder="Search supplies"
        aria-label="Search clinic supplies"
      />

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"
        >
          {error}
        </div>
      ) : null}

      {loading && !items.length ? (
        <div className="mt-4 flex min-h-40 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 py-10 text-center text-sm text-fg-muted">
          No supplies match this search.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[15px]">
            <thead>
              <tr>
                <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground first:rounded-l-lg">
                  Name
                </th>
                <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground">
                  Unit
                </th>
                <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground">
                  Qty
                </th>
                <th className="bg-surface-1 px-3 py-3 text-right text-base font-bold text-foreground last:rounded-r-lg">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const qty = Number(
                  item.usable_quantity ?? item.quantity_on_hand ?? 0,
                );
                const low = isLowStock(item);
                return (
                  <tr
                    key={item.id}
                    className="odd:bg-transparent even:bg-surface-1/70"
                  >
                    <td className="px-3 py-3.5 pr-4">
                      <p className="text-[15px] font-semibold">{item.name}</p>
                      {item.supply_group_name ? (
                        <p className="text-sm font-medium text-fg-muted">
                          {item.supply_group_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 pr-4 text-[15px] font-medium text-fg-secondary">
                      {item.unit ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-3.5 pr-4 font-mono text-[15px] font-semibold tabular-nums ${low ? "text-danger-text" : ""}`}
                    >
                      {qty}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        type="button"
                        className="text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
                        onClick={() => setSelectedId(item.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lowNames.length > 0 ? (
        <p className="mt-4 text-sm text-danger-text">
          Low stock: {lowNames.join(", ")}
        </p>
      ) : null}

      <ReceiveSupplyDialog
        item={restockItem}
        locations={locations}
        onClose={() => setRestockItem(null)}
        onSaved={async () => {
          setRestockItem(null);
          await load();
        }}
      />
    </div>
  );
}

function ReceiveSupplyDialog({
  item,
  locations,
  onClose,
  onSaved,
}: {
  item: CatalogItem | null;
  locations: InventoryLocation[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [locationId, setLocationId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setQuantity("");
    setNote("");
    const preferred =
      locations.find((location) => location.code === "main_store") ??
      locations[0];
    setLocationId(preferred?.id ?? "");
  }, [item, locations]);

  async function save() {
    if (!item) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!locationId) {
      toast.error("Choose a location");
      return;
    }
    setSaving(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      await receiveInventoryBatch(item.id, {
        batchNumber: `SUP-${stamp}-${Math.floor(Math.random() * 900 + 100)}`,
        supplierName: "Clinic restock",
        purchaseReference: note.trim() || undefined,
        quantity: amount,
        locationId,
      });
      toast.success("Supply received", {
        description: `${item.name} +${amount}`,
      });
      await onSaved();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Receive could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive supply</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name} · currently ${Number(item.quantity_on_hand ?? 0)} ${item.unit ?? "units"}`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="supply-restock-qty">Quantity *</Label>
            <Input
              id="supply-restock-qty"
              className="mt-1 min-h-11"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div>
            <Label>Receive into *</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="mt-1 min-h-11">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="supply-restock-note">Note</Label>
            <Textarea
              id="supply-restock-note"
              className="mt-1"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save restock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function isLowStock(item: CatalogItem) {
  const qty = Number(item.usable_quantity ?? item.quantity_on_hand ?? 0);
  const reorder = Number(item.reorder_level ?? 0);
  return qty <= reorder;
}
