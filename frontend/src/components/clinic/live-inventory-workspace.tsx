"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AddCatalogItemDialog } from "@/components/clinic/add-catalog-item-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { listCatalog, type CatalogItem } from "@/lib/api/clinical";
import {
  listInventoryMovements,
  type InventoryMovement,
} from "@/lib/api/inventory";
import { receiveInventoryBatch } from "@/lib/api/inventory-batches";
import { formatMoney } from "@/lib/format";

export function LiveInventoryWorkspace({
  showAdd = false,
}: {
  showAdd?: boolean;
}) {
  const [drugs, setDrugs] = useState<CatalogItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restockItem, setRestockItem] = useState<CatalogItem | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [catalog, ledger] = await Promise.all([
        listCatalog("drug"),
        listInventoryMovements(signal, undefined, "drug"),
      ]);
      setDrugs(catalog.items.filter((item) => item.track_inventory));
      setMovements(ledger.items);
    } catch (caught) {
      if (!signal?.aborted) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Inventory could not be loaded.",
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
    return drugs.filter(
      (drug) =>
        !query ||
        `${drug.name} ${drug.item_code} ${drug.unit ?? ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [drugs, search]);

  const selected = drugs.find((drug) => drug.id === selectedId) ?? null;
  const lowNames = drugs
    .filter((drug) => isLowStock(drug))
    .map((drug) => drug.name);

  if (selected) {
    const itemMovements = movements.filter(
      (movement) => movement.catalog_item_id === selected.id,
    );
    return (
      <>
        <InventoryDetail
          item={selected}
          movements={itemMovements}
          onBack={() => setSelectedId(null)}
          onRestock={() => setRestockItem(selected)}
          restockLabel="Restock"
        />
        <RestockDialog
          item={restockItem}
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
      {showAdd ? (
        <div className="mb-3 flex justify-end">
          <AddCatalogItemDialog
            defaultType="drug"
            onSaved={() => void load()}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-3.5" aria-hidden="true" />
                Add item
              </Button>
            }
          />
        </div>
      ) : null}

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-9 max-w-sm min-h-9"
        placeholder="Search medications"
        aria-label="Search medications"
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"
        >
          {error}
        </div>
      ) : null}

      {loading && !drugs.length ? (
        <div className="mt-4 flex min-h-40 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 py-10 text-center text-sm text-fg-muted">
          No medications match this search.
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
              {filtered.map((drug) => {
                const qty = Number(
                  drug.usable_quantity ?? drug.quantity_on_hand ?? 0,
                );
                const low = isLowStock(drug);
                return (
                  <tr
                    key={drug.id}
                    className="odd:bg-transparent even:bg-surface-1/70"
                  >
                    <td className="px-3 py-3.5 pr-4 text-[15px] font-semibold">
                      {drug.name}
                    </td>
                    <td className="px-3 py-3.5 pr-4 text-[15px] font-medium text-fg-secondary">
                      {drug.unit ?? "—"}
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
                        onClick={() => setSelectedId(drug.id)}
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
        <p className="text-sm text-danger-text">
          Low stock: {lowNames.join(", ")}
        </p>
      ) : null}

      <RestockDialog
        item={restockItem}
        onClose={() => setRestockItem(null)}
        onSaved={async () => {
          setRestockItem(null);
          await load();
        }}
      />
    </div>
  );
}

export function InventoryDetail({
  item,
  movements,
  onBack,
  onRestock,
  restockLabel = "Restock",
  priceLabel = "Unit price",
}: {
  item: CatalogItem;
  movements: InventoryMovement[];
  onBack: () => void;
  onRestock: () => void;
  restockLabel?: string;
  priceLabel?: string;
}) {
  const qty = Number(item.usable_quantity ?? item.quantity_on_hand ?? 0);
  const reorder = Number(item.reorder_level ?? 0);
  const low = isLowStock(item);
  const showPrice = item.item_type === "drug";

  return (
    <div className="rounded-2xl border border-border/15 bg-surface-2 p-5 sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to list
      </button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            {item.name}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {item.unit ?? "units"} · reorder level {reorder}
          </p>
        </div>
        {low ? (
          <span className="shrink-0 text-sm font-medium text-danger-text">
            Low stock
          </span>
        ) : null}
      </div>

      <div
        className={`mt-5 grid gap-3 ${showPrice ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}
      >
        <div className="rounded-xl bg-surface-1 px-4 py-4">
          <p className="text-xs text-fg-muted">Current quantity</p>
          <p className="mt-1 font-heading text-3xl font-semibold tabular-nums">
            {qty}
          </p>
        </div>
        {showPrice ? (
          <div className="rounded-xl bg-surface-1 px-4 py-4">
            <p className="text-xs text-fg-muted">{priceLabel}</p>
            <p className="mt-1 font-heading text-3xl font-semibold tabular-nums">
              {formatMoney(Number(item.price))}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-semibold">Stock history</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onRestock}
        >
          {restockLabel}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {movements.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-fg-muted">
          No movements yet for this item.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-[15px]">
            <thead>
              <tr>
                <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground first:rounded-l-lg">
                  Date
                </th>
                <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground">
                  Type
                </th>
                <th className="bg-surface-1 px-3 py-3 text-right text-base font-bold text-foreground last:rounded-r-lg">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 40).map((movement) => {
                const delta = Number(movement.quantity_delta);
                return (
                  <tr
                    key={movement.id}
                    className="odd:bg-transparent even:bg-surface-1/70"
                  >
                    <td className="px-3 py-3 pr-4 text-[15px] font-medium text-fg-secondary">
                      {formatShortDate(movement.occurred_at)}
                    </td>
                    <td className="px-3 py-3 pr-4 text-[15px] font-semibold">
                      {formatMovementType(movement)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-mono text-[15px] font-semibold tabular-nums ${
                        delta >= 0 ? "text-success-text" : "text-danger-text"
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : String(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RestockDialog({
  item,
  onClose,
  onSaved,
}: {
  item: CatalogItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setQuantity("");
      setNote("");
    }
  }, [item]);

  async function save() {
    if (!item) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setSaving(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      await receiveInventoryBatch(item.id, {
        batchNumber: `RSTK-${stamp}-${Math.floor(Math.random() * 900 + 100)}`,
        supplierName: "Clinic restock",
        purchaseReference: note.trim() || undefined,
        quantity: amount,
      });
      toast.success("Stock restocked", {
        description: `${item.name} +${amount}`,
      });
      await onSaved();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Restock could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restock medication</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name} · currently ${Number(item.quantity_on_hand ?? 0)} ${item.unit ?? "units"}`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="restock-qty">Quantity *</Label>
            <Input
              id="restock-qty"
              className="mt-1 min-h-11"
              type="number"
              min="0.001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="restock-note">Note</Label>
            <Textarea
              id="restock-note"
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatMovementType(movement: InventoryMovement) {
  const type = movement.movement_type.replaceAll("_", " ");
  if (movement.movement_type === "dispense") {
    const ref =
      movement.transaction_reference ??
      (movement.reference_id
        ? `#${movement.reference_id.slice(0, 8)}`
        : null);
    return ref ? `Dispense (${ref})` : "Dispense";
  }
  if (movement.movement_type === "receipt" || movement.movement_type === "adjustment_in") {
    return "Restock";
  }
  if (movement.movement_type === "consume") {
    return movement.reason ? `Usage (${movement.reason})` : "Usage";
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}
