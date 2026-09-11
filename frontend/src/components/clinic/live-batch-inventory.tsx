"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { listCatalog, type CatalogItem } from "@/lib/api/clinical";
import {
  listInventoryBatches,
  receiveInventoryBatch,
  type InventoryBatch,
} from "@/lib/api/inventory-batches";

export function LiveBatchInventory() {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [drugs, setDrugs] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receiving, setReceiving] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [batchResult, catalog] = await Promise.all([
        listInventoryBatches(signal, "drug"),
        listCatalog("drug"),
      ]);
      setBatches(batchResult.items);
      setDrugs(catalog.items.filter((item) => item.track_inventory));
    } catch (caught) {
      if (!signal?.aborted)
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Batch inventory could not be loaded.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const active = useMemo(
    () => batches.filter((batch) => Number(batch.quantity_remaining) > 0),
    [batches],
  );
  const expired = active.filter((batch) => batch.expired);
  const expiring = active.filter(
    (batch) =>
      !batch.expired &&
      batch.days_to_expiry !== null &&
      batch.days_to_expiry <= 90,
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Batch and expiry control
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Dispensing automatically uses the earliest non-expired batch first.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw
              className={loading ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            type="button"
            className="min-h-11 gap-2"
            onClick={() => setReceiving(true)}
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            Receive batch
          </Button>
        </div>
      </div>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"
        >
          {error}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Open batches" value={active.length} />
        <Summary
          label="Expiring within 90 days"
          value={expiring.length}
          warning={expiring.length > 0}
        />
        <Summary
          label="Expired stock blocked"
          value={expired.length}
          danger={expired.length > 0}
        />
      </div>
      {loading && !batches.length ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading batches…
        </div>
      ) : active.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <div className="divide-y divide-border/60">
            {active.map((batch) => (
              <BatchRow key={batch.id} batch={batch} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-fg-muted">
          No open batches. Receive the first supplier delivery to start batch
          tracking.
        </div>
      )}
      <ReceiveBatchDialog
        open={receiving}
        drugs={drugs}
        onClose={() => setReceiving(false)}
        onSaved={async () => {
          setReceiving(false);
          await load();
        }}
      />
    </section>
  );
}

function BatchRow({ batch }: { batch: InventoryBatch }) {
  const expiring =
    !batch.expired &&
    batch.days_to_expiry !== null &&
    batch.days_to_expiry <= 90;
  return (
    <article className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">{batch.item_name}</h3>
          {batch.expired ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-fill/10 px-2 py-1 text-xs font-semibold text-danger-text">
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              Expired — blocked
            </span>
          ) : expiring ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-fill/10 px-2 py-1 text-xs font-semibold text-warning-text">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Expiring soon
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-fg-muted">
          Batch {batch.batch_number} · {batch.supplier_name}
          {batch.purchase_reference ? ` · ${batch.purchase_reference}` : ""}
        </p>
        <p className="mt-1 text-xs text-fg-muted">
          Expiry {batch.expiry_date ?? "Not recorded"} · Received by{" "}
          {batch.received_by_name}
        </p>
      </div>
      <div className="md:text-right">
        <p className="font-mono text-lg font-bold tabular-nums">
          {Number(batch.quantity_remaining)}{" "}
          <span className="text-xs font-normal text-fg-muted">
            {batch.unit ?? "units"}
          </span>
        </p>
        <p className="text-xs text-fg-muted">
          of {Number(batch.received_quantity)} received
        </p>
      </div>
    </article>
  );
}

function ReceiveBatchDialog({
  open,
  drugs,
  onClose,
  onSaved,
}: {
  open: boolean;
  drugs: CatalogItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [drugId, setDrugId] = useState("");
  const [batch, setBatch] = useState("");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cost, setCost] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const qty = Number(quantity);
  const valid = Boolean(
    drugId &&
    batch.trim() &&
    supplier.trim() &&
    Number.isFinite(qty) &&
    qty > 0 &&
    expiry &&
    expiry > new Date().toISOString().slice(0, 10),
  );
  function reset() {
    setDrugId("");
    setBatch("");
    setSupplier("");
    setReference("");
    setQuantity("");
    setExpiry("");
    setCost("");
    setError("");
    setConfirming(false);
  }
  function close() {
    if (!saving) {
      reset();
      onClose();
    }
  }
  async function save() {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      await receiveInventoryBatch(drugId, {
        batchNumber: batch.trim(),
        supplierName: supplier.trim(),
        purchaseReference: reference.trim() || undefined,
        quantity: qty,
        expiryDate: expiry,
        unitCost: cost ? Number(cost) : undefined,
      });
      toast.success("Batch received", {
        description: "The batch and total stock balance were recorded.",
      });
      reset();
      await onSaved();
    } catch (caught) {
      setConfirming(false);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The batch could not be received.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Receive medication batch</DialogTitle>
            <DialogDescription>
              Record supplier and expiry details. An expired or duplicate batch
              is rejected by the server.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medication *" wide>
              <Select value={drugId} onValueChange={setDrugId}>
                <SelectTrigger className="mt-1 min-h-11">
                  <SelectValue placeholder="Select tracked medication" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.map((drug) => (
                    <SelectItem key={drug.id} value={drug.id}>
                      {drug.name} · {drug.item_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Batch number *">
              <Input
                className="mt-1 min-h-11"
                value={batch}
                onChange={(event) => setBatch(event.target.value)}
              />
            </Field>
            <Field label="Supplier *">
              <Input
                className="mt-1 min-h-11"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              />
            </Field>
            <Field label="Purchase reference">
              <Input
                className="mt-1 min-h-11"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
            <Field label="Quantity *">
              <Input
                className="mt-1 min-h-11"
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>
            <Field label="Expiry date *">
              <Input
                className="mt-1 min-h-11"
                type="date"
                min={new Date(Date.now() + 86_400_000)
                  .toISOString()
                  .slice(0, 10)}
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              />
            </Field>
            <Field label="Unit cost">
              <Input
                className="mt-1 min-h-11"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </Field>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!valid || saving}
              onClick={() => setConfirming(true)}
            >
              Review receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirming}
        onOpenChange={(value) => !saving && setConfirming(value)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm batch receipt</DialogTitle>
            <DialogDescription>
              This permanently adds {qty || 0} units to inventory under batch{" "}
              {batch || "—"}, expiring {expiry || "—"}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirming(false)}
            >
              Back
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {saving ? "Receiving…" : "Confirm receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Summary({
  label,
  value,
  warning = false,
  danger = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <p
        className={
          danger
            ? "text-xs font-medium text-danger-text"
            : warning
              ? "text-xs font-medium text-warning-text"
              : "text-xs font-medium text-fg-muted"
        }
      >
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
