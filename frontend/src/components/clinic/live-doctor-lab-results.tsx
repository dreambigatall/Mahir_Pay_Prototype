"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ApiError } from "@/lib/api/client";
import {
  cancelDiagnosticOrder,
  cancelDiagnosticOrderItem,
  reviewDiagnosticOrder,
  type DiagnosticItem,
  type DiagnosticOrder,
} from "@/lib/api/clinical";
import { announceCoreDataChanged } from "@/lib/core-events";

type FlatItem = DiagnosticItem & { orderId: string; orderStatus: string };

function flattenItems(orders: DiagnosticOrder[]): FlatItem[] {
  return orders
    .filter((order) => order.status !== "cancelled")
    .flatMap((order) =>
      order.items
        .filter((item) => item.status !== "cancelled")
        .map((item) => ({
          ...item,
          orderId: order.id,
          orderStatus: order.status,
        })),
    );
}

export function LiveDoctorLabResults({
  orders,
  readOnly,
  onChanged,
}: {
  orders: DiagnosticOrder[];
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}) {
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  const items = flattenItems(activeOrders);

  if (!items.length) {
    return (
      <p className="text-[13px] text-fg-muted">
        No investigations requested yet. Use Order lab / imaging and pick from the catalog.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ResultItem key={item.id} item={item} readOnly={readOnly} onChanged={onChanged} />
      ))}
      {activeOrders
        .filter((order) => order.status === "verified" || order.status === "requested")
        .map((order) => (
          <OrderActionRow key={`order-${order.id}`} order={order} readOnly={readOnly} onChanged={onChanged} />
        ))}
    </div>
  );
}

function ResultItem({
  item,
  readOnly,
  onChanged,
}: {
  item: FlatItem;
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const canRemove = !readOnly && item.status === "requested" && item.orderStatus === "requested";
  const hasResult = Boolean(item.result?.result_value);
  const isReviewed = item.status === "reviewed" || item.orderStatus === "reviewed";

  if (!hasResult && !["result_ready", "verified", "reviewed"].includes(item.status)) {
    return (
      <div className="group -mx-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-1/50">
        <p className="min-w-0 flex-1 text-[14px] font-medium text-foreground">{item.item_name}</p>
        <div className="flex shrink-0 items-center gap-2">
          <Chip variant="warning">Awaiting lab</Chip>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0 text-fg-muted hover:text-danger-text"
              disabled={removing}
              aria-label={`Remove ${item.item_name}`}
              onClick={() => void removeItem(item, setRemoving, onChanged)}
            >
              {removing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const value = [item.result?.result_value, item.result?.result_unit].filter(Boolean).join(" ");
  const abnormal = item.result?.result_flag === "abnormal" || item.result?.result_flag === "critical";

  return (
    <div className="group -mx-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-1/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[14px] font-medium text-foreground">{item.item_name}</p>
          {value ? <p className="mt-0.5 font-mono text-[14px] tabular-nums text-fg-secondary">{value}</p> : null}
          {item.result?.reference_range ? (
            <p className="mt-1 text-[12px] text-fg-muted">Ref: {item.result.reference_range}</p>
          ) : null}
          {item.result?.notes ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-fg-secondary">{item.result.notes}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {hasResult ? (
            <Chip variant={abnormal ? "danger" : "success"}>{abnormal ? "Abnormal" : "Normal"}</Chip>
          ) : (
            <Chip variant="warning">Pending verify</Chip>
          )}
          {isReviewed ? <Chip variant="info">Reviewed</Chip> : null}
        </div>
      </div>
    </div>
  );
}

async function removeItem(item: FlatItem, setRemoving: (value: boolean) => void, onChanged: () => Promise<void>) {
  if (!window.confirm(`Remove "${item.item_name}" from this laboratory order?`)) return;

  setRemoving(true);
  try {
    await cancelDiagnosticOrderItem(item.id);
    toast.success("Test removed", { description: "You can re-order it from the catalog if needed." });
    announceCoreDataChanged();
    await onChanged();
  } catch (caught) {
    toast.error(caught instanceof ApiError ? caught.message : "The test could not be removed.");
  } finally {
    setRemoving(false);
  }
}

function OrderActionRow({
  order,
  readOnly,
  onChanged,
}: {
  order: DiagnosticOrder;
  readOnly?: boolean;
  onChanged: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const activeItems = order.items.filter((item) => item.status !== "cancelled");
  const canCancel =
    !readOnly &&
    order.status === "requested" &&
    activeItems.length > 0 &&
    activeItems.every((item) => item.status === "requested");

  if (order.status === "requested") {
    if (!canCancel) return null;
    return (
      <div className="rounded-lg border border-border/70 bg-surface-1/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-fg-secondary">
            Laboratory has not started this order yet. Remove individual tests with the trash icon, or cancel the whole order.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-[12px] text-danger-text hover:text-danger-text"
            disabled={cancelling}
            onClick={() => void cancelWholeOrder(order.id, setCancelling, onChanged)}
          >
            {cancelling ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
            Cancel entire order
          </Button>
        </div>
      </div>
    );
  }

  if (order.status !== "verified" || readOnly) return null;

  return (
    <div className="rounded-lg border border-success-fill/30 bg-success-fill/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-success-text">All results verified — acknowledge to return patient to consultation.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 text-[12px]"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await reviewDiagnosticOrder(order.id);
              toast.success("Results acknowledged");
              await onChanged();
            } catch (caught) {
              toast.error(caught instanceof ApiError ? caught.message : "Result review failed.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Acknowledging…" : "Acknowledge results"}
        </Button>
      </div>
    </div>
  );
}

async function cancelWholeOrder(orderId: string, setCancelling: (value: boolean) => void, onChanged: () => Promise<void>) {
  if (!window.confirm("Cancel this entire laboratory order before the lab starts work?")) return;

  setCancelling(true);
  try {
    await cancelDiagnosticOrder(orderId);
    toast.success("Laboratory order cancelled");
    announceCoreDataChanged();
    await onChanged();
  } catch (caught) {
    toast.error(caught instanceof ApiError ? caught.message : "The order could not be cancelled.");
  } finally {
    setCancelling(false);
  }
}
