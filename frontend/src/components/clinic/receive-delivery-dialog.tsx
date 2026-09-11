"use client";

import { useEffect, useState } from "react";
import { Loader2, PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { receiveInventoryLines } from "@/lib/api/inventory-batches";
import {
  listInventoryLocations,
  type InventoryLocation,
} from "@/lib/api/inventory";

type Line = {
  catalogItemId: string;
  batchNumber: string;
  packQuantity: string;
  unitsPerPack: string;
  expiryDate: string;
  unitCost: string;
};
const emptyLine = (): Line => ({
  catalogItemId: "",
  batchNumber: "",
  packQuantity: "",
  unitsPerPack: "1",
  expiryDate: "",
  unitCost: "",
});

export function ReceiveDeliveryDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void Promise.all([
      listCatalog("drug"),
      listCatalog("supply"),
      listInventoryLocations(controller.signal),
    ]).then(([drugs, supplies, places]) => {
      setItems(
        drugs.items
          .filter((item) => item.track_inventory)
          .concat(supplies.items),
      );
      setLocations(places.items);
    });
    return () => controller.abort();
  }, [open]);
  const valid = Boolean(
    supplier.trim() &&
    reference.trim() &&
    locationId &&
    lines.length &&
    lines.every(
      (line) =>
        line.catalogItemId &&
        line.batchNumber.trim() &&
        Number(line.packQuantity) > 0 &&
        Number(line.unitsPerPack) > 0,
    ),
  );
  function update(index: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }
  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      await receiveInventoryLines({
        supplierName: supplier.trim(),
        purchaseReference: reference.trim(),
        locationId,
        lines: lines.map((line) => ({
          catalogItemId: line.catalogItemId,
          batchNumber: line.batchNumber.trim(),
          packQuantity: Number(line.packQuantity),
          unitsPerPack: Number(line.unitsPerPack),
          expiryDate: line.expiryDate || undefined,
          unitCost: line.unitCost ? Number(line.unitCost) : undefined,
        })),
      });
      toast.success("Delivery received", {
        description: `${lines.length} stock line${lines.length === 1 ? "" : "s"} added.`,
      });
      setOpen(false);
      setSupplier("");
      setReference("");
      setLocationId("");
      setLines([emptyLine()]);
      onSaved?.();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Delivery could not be received.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <PackagePlus className="size-4" />
          Receive delivery
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Receive delivery</DialogTitle>
          <DialogDescription>
            Record one supplier delivery with several medicine or supply lines.
            Packs are converted to the item’s base unit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="delivery-supplier">Supplier *</Label>
            <Input
              id="delivery-supplier"
              className="mt-1 min-h-11"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="delivery-reference">
              Delivery note / invoice *
            </Label>
            <Input
              id="delivery-reference"
              className="mt-1 min-h-11"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
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
        </div>
        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-surface-1 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Line {index + 1}</p>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Label>Item *</Label>
                  <Select
                    value={line.catalogItemId}
                    onValueChange={(value) =>
                      update(index, { catalogItemId: value })
                    }
                  >
                    <SelectTrigger className="mt-1 min-h-11">
                      <SelectValue placeholder="Medicine or supply" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {item.item_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field label="Batch *">
                  <Input
                    value={line.batchNumber}
                    onChange={(event) =>
                      update(index, { batchNumber: event.target.value })
                    }
                  />
                </Field>
                <Field label="Packs *">
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.packQuantity}
                    onChange={(event) =>
                      update(index, { packQuantity: event.target.value })
                    }
                  />
                </Field>
                <Field label="Units / pack *">
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.unitsPerPack}
                    onChange={(event) =>
                      update(index, { unitsPerPack: event.target.value })
                    }
                  />
                </Field>
                <Field label="Expiry">
                  <Input
                    type="date"
                    value={line.expiryDate}
                    onChange={(event) =>
                      update(index, { expiryDate: event.target.value })
                    }
                  />
                </Field>
                <Field label="Cost / base unit">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) =>
                      update(index, { unitCost: event.target.value })
                    }
                  />
                </Field>
                <div className="flex items-end pb-2 text-sm text-fg-muted">
                  Total:{" "}
                  {Number(line.packQuantity || 0) *
                    Number(line.unitsPerPack || 0)}{" "}
                  base units
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          <Plus className="size-4" />
          Add delivery line
        </Button>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!valid || saving}
            onClick={() => void save()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Receiving…" : "Receive delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 [&_input]:min-h-11">{children}</div>
    </div>
  );
}
