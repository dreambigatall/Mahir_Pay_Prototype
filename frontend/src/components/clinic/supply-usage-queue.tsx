"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  approveSupplyUsageRequest,
  listSupplyUsageRequests,
  rejectSupplyUsageRequest,
  type SupplyUsageRequest,
} from "@/lib/api/inventory";

export function SupplyUsageQueue({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<SupplyUsageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<SupplyUsageRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = await listSupplyUsageRequests({
        status: "pending",
        signal,
      });
      setItems(result.items);
    } catch (caught) {
      if (!signal?.aborted) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Pending usage requests could not be loaded.",
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

  async function approve(request: SupplyUsageRequest) {
    setBusyId(request.id);
    try {
      await approveSupplyUsageRequest(request.id);
      toast.success("Usage approved", {
        description: `${request.quantity} ${request.unit ?? "units"} of ${request.item_name} deducted.`,
      });
      await load();
      onChanged?.();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Usage could not be approved.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"
      >
        {error}
      </div>
    );
  }

  if (loading || items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Pending usage approvals
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Lab logged today’s usage. Approve to deduct stock, or reject with a
            note. Stock does not change until you approve.
          </p>
        </div>
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
          <span className="rounded-full bg-warning-fill/15 px-2 py-0.5 text-xs font-semibold text-warning-text">
            {items.length}
          </span>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface-2">
        <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr>
                <th className="bg-surface-1 px-4 py-3 text-left text-base font-bold text-foreground first:rounded-tl-xl">
                  Item
                </th>
                <th className="bg-surface-1 px-4 py-3 text-left text-base font-bold text-foreground">
                  Requested by
                </th>
                <th className="bg-surface-1 px-4 py-3 text-left text-base font-bold text-foreground">
                  Qty
                </th>
                <th className="bg-surface-1 px-4 py-3 text-left text-base font-bold text-foreground">
                  In stock
                </th>
                <th className="bg-surface-1 px-4 py-3 text-left text-base font-bold text-foreground">
                  Reason
                </th>
                <th className="bg-surface-1 px-4 py-3 text-right text-base font-bold text-foreground last:rounded-tr-xl">
                  Actions
                </th>
              </tr>
            </thead>
          <tbody>
            {items.map((request) => {
              const stock = Number(request.quantity_on_hand ?? 0);
              const qty = Number(request.quantity);
              const short = stock < qty;
              return (
                <tr
                  key={request.id}
                  className="odd:bg-transparent even:bg-surface-1/70 hover:bg-surface-1"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{request.item_name}</p>
                    <p className="text-xs font-medium text-fg-muted">
                      {request.item_code} ·{" "}
                      {request.supply_group_name ?? "Supply"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{request.requested_by_name}</p>
                    <p className="text-xs font-medium text-fg-muted">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {request.quantity} {request.unit ?? ""}
                  </td>
                  <td
                    className={`px-4 py-3 font-mono ${short ? "text-danger-text" : ""}`}
                  >
                    {request.quantity_on_hand ?? "—"}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-fg-secondary">
                    {request.reason}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        disabled={busyId === request.id || short}
                        onClick={() => void approve(request)}
                      >
                        <Check className="mr-1 size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === request.id}
                        onClick={() => setRejecting(request)}
                      >
                        <X className="mr-1 size-3.5" />
                        Reject
                      </Button>
                    </div>
                    {short ? (
                      <p className="mt-1 text-right text-xs text-danger-text">
                        Not enough stock to approve
                      </p>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <RejectDialog
        request={rejecting}
        onClose={() => setRejecting(null)}
        onRejected={async () => {
          setRejecting(null);
          await load();
          onChanged?.();
        }}
      />
    </section>
  );
}

function RejectDialog({
  request,
  onClose,
  onRejected,
}: {
  request: SupplyUsageRequest | null;
  onClose: () => void;
  onRejected: () => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (request) setNote("");
  }, [request]);

  async function submit() {
    if (!request || !note.trim()) return;
    setSaving(true);
    try {
      await rejectSupplyUsageRequest(request.id, note.trim());
      toast.success("Usage rejected", {
        description: "Stock was not changed.",
      });
      await onRejected();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError
          ? caught.message
          : "Usage could not be rejected.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject usage request</DialogTitle>
          <DialogDescription>
            {request
              ? `${request.item_name} · ${request.quantity} ${request.unit ?? "units"} — stock stays unchanged.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-note">Reason *</Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this usage was not approved"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !note.trim()}
          >
            {saving ? "Rejecting…" : "Reject request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
