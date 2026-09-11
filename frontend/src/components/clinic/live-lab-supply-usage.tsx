"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  createSupplyUsageRequest,
  listSupplyUsageRequests,
  type SupplyUsageRequest,
} from "@/lib/api/inventory";

export function LiveLabSupplyUsage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [requests, setRequests] = useState<SupplyUsageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [logging, setLogging] = useState<CatalogItem | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [catalog, mine] = await Promise.all([
        listCatalog("supply"),
        listSupplyUsageRequests({ mine: true, signal }),
      ]);
      setItems(catalog.items);
      setRequests(mine.items);
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
        `${item.name} ${item.item_code} ${item.supply_group_name ?? ""}`
          .toLowerCase()
          .includes(query),
    );
  }, [items, search]);

  const lowNames = items
    .filter((item) => {
      const qty = Number(item.usable_quantity ?? item.quantity_on_hand ?? 0);
      return qty <= Number(item.reorder_level ?? 0);
    })
    .map((item) => item.name);
  const pending = requests.filter((request) => request.status === "pending");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/15 bg-surface-2 p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Clinic supplies
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Log today’s usage. Admin approves before stock is deducted.
        </p>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-5 min-h-11"
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
          <div className="flex min-h-40 items-center justify-center text-sm text-fg-muted">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-muted">
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
                  const low = qty <= Number(item.reorder_level ?? 0);
                  return (
                    <tr
                      key={item.id}
                      className="odd:bg-transparent even:bg-surface-1/70"
                    >
                      <td className="px-3 py-3.5 pr-4 text-[15px] font-semibold">
                        {item.name}
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
                          className="text-[15px] font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-40"
                          disabled={qty <= 0}
                          onClick={() => setLogging(item)}
                        >
                          Log usage
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
      </div>

      {pending.length > 0 || requests.length > 0 ? (
        <div className="rounded-2xl border border-border/15 bg-surface-2 p-5 sm:p-6">
          <h3 className="font-heading text-base font-semibold">My requests</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[15px]">
              <thead>
                <tr>
                  <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground first:rounded-l-lg">
                    Date
                  </th>
                  <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground">
                    Item
                  </th>
                  <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground">
                    Qty
                  </th>
                  <th className="bg-surface-1 px-3 py-3 text-left text-base font-bold text-foreground last:rounded-r-lg">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.slice(0, 20).map((request) => (
                  <tr
                    key={request.id}
                    className="odd:bg-transparent even:bg-surface-1/70"
                  >
                    <td className="px-3 py-3 pr-4 text-[15px] font-medium text-fg-secondary">
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                      }).format(new Date(request.created_at))}
                    </td>
                    <td className="px-3 py-3 pr-4 text-[15px] font-semibold">
                      {request.item_name}
                    </td>
                    <td className="px-3 py-3 pr-4 font-mono text-[15px] font-semibold">
                      {request.quantity}
                    </td>
                    <td className="px-3 py-3 text-[15px] font-medium capitalize text-fg-secondary">
                      {request.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <LogUsageDialog
        item={logging}
        onClose={() => setLogging(null)}
        onSaved={async () => {
          setLogging(null);
          await load();
        }}
      />
    </div>
  );
}

function LogUsageDialog({
  item,
  onClose,
  onSaved,
}: {
  item: CatalogItem | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const stock = Number(item?.usable_quantity ?? item?.quantity_on_hand ?? 0);

  useEffect(() => {
    if (item) {
      setQuantity("");
      setReason("");
    }
  }, [item]);

  async function submit() {
    if (!item) return;
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!reason.trim()) {
      toast.error("Add a short reason for today’s usage");
      return;
    }
    setSaving(true);
    try {
      await createSupplyUsageRequest({
        catalogItemId: item.id,
        quantity: amount,
        reason: reason.trim(),
      });
      toast.success("Usage sent to admin", {
        description: "Stock is not deducted until admin approves.",
      });
      await onSaved();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Usage request could not be submitted.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log today’s usage</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.name} · In stock: ${stock} ${item.unit ?? "units"}. Sent to admin for approval.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lab-usage-qty">Quantity used *</Label>
            <Input
              id="lab-usage-qty"
              type="number"
              min={0.001}
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lab-usage-reason">Reason *</Label>
            <Textarea
              id="lab-usage-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Malaria RDTs used today"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
