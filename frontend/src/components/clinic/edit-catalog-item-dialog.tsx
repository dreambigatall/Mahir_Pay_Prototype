"use client";

import { useState } from "react";
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
import { ApiError } from "@/lib/api/client";
import { updateCatalogItem, type CatalogItem } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";

export function EditCatalogItemDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: CatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [unit, setUnit] = useState(item.unit ?? "");
  const [reorderLevel, setReorderLevel] = useState(item.reorder_level ?? "");
  const [submitting, setSubmitting] = useState(false);

  const trackedStock = (item.item_type === "drug" || item.item_type === "supply") && item.track_inventory;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(price);
    if (!name.trim() || Number.isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid item name and price.");
      return;
    }

    let reorder: number | undefined;
    if (trackedStock) {
      reorder = reorderLevel.trim() ? Number(reorderLevel) : 0;
      if (Number.isNaN(reorder) || reorder < 0) {
        toast.error("Enter a valid reorder level.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await updateCatalogItem(item.id, {
        name: name.trim(),
        price: amount,
        ...(trackedStock
          ? {
              unit: unit.trim() || null,
              reorderLevel: reorder,
            }
          : {}),
      });
      announceCoreDataChanged();
      onSaved?.();
      toast.success("Catalog item updated", {
        description: `"${name.trim()}" is now set to ${formatMoney(amount)}.`,
      });
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The catalog item could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setName(item.name);
          setPrice(item.price);
          setUnit(item.unit ?? "");
          setReorderLevel(item.reorder_level ?? "");
        }
      }}
    >
      <DialogContent className="p-6 sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Edit catalog item</DialogTitle>
          <DialogDescription>
            Update pricing or name for {item.name}. Category and code cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 pt-1" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-item-name" className="text-[13px] font-medium text-foreground">
              Item name *
            </Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 bg-background text-[14px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-item-price" className="text-[13px] font-medium text-foreground">
              {item.item_type === "supply" ? "Unit cost (GHS)" : "Price (GHS) *"}
            </Label>
            <Input
              id="edit-item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="h-10 bg-background font-mono text-[14px] tabular-nums"
              required
            />
          </div>

          {trackedStock ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-surface-1 p-4">
              <p className="text-[12px] font-medium text-fg-secondary">
                {item.item_type === "supply" ? "Clinic supply stock" : "Medication inventory"}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-item-unit" className="text-[12px] font-medium text-fg-secondary">
                    Unit
                  </Label>
                  <Input
                    id="edit-item-unit"
                    value={unit}
                    onChange={(event) => setUnit(event.target.value)}
                    placeholder="e.g. tablet"
                    className="h-9 bg-background text-[13px]"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[12px] font-medium text-fg-secondary">On hand</Label>
                  <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 font-mono text-[13px] tabular-nums">
                    {item.quantity_on_hand ?? "0"}
                    {item.unit ? ` ${item.unit}` : ""}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-reorder-level" className="text-[12px] font-medium text-fg-secondary">
                    Reorder level
                  </Label>
                  <Input
                    id="edit-reorder-level"
                    type="number"
                    min="0"
                    step="1"
                    value={reorderLevel}
                    onChange={(event) => setReorderLevel(event.target.value)}
                    className="h-9 bg-background font-mono text-[13px] tabular-nums"
                  />
                </div>
              </div>
              <p className="text-[11px] text-fg-muted">
                {item.item_type === "supply"
                  ? "Receive and record usage from Admin → Inventory → Clinic supplies. This item is not billed to patients."
                  : "Receive batches and adjust stock from Admin → Inventory. Dispensing after payment reduces on-hand quantity automatically."}
              </p>
            </div>
          ) : null}

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
