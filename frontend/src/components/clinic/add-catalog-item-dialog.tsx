"use client";

import { useState } from "react";
import { FlaskConical, Loader2, Pill, Plus, Stethoscope, Syringe } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError } from "@/lib/api/client";
import { createCatalogItem, type CatalogItemType } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type AddableCatalogType = Exclude<CatalogItemType, "lab_panel" | "supply">;

const typeOptions: {
  type: AddableCatalogType;
  label: string;
  description: string;
  icon: typeof FlaskConical;
  placeholder: string;
}[] = [
  {
    type: "lab_test",
    label: "Lab test",
    description: "Appears in doctor’s orders & lab workbench",
    icon: FlaskConical,
    placeholder: "e.g. Thyroid Panel (TSH, FT4)",
  },
  {
    type: "drug",
    label: "Medication",
    description: "Available for doctor prescriptions & pharmacy",
    icon: Pill,
    placeholder: "e.g. Amoxicillin 500mg capsules",
  },
  {
    type: "consultation",
    label: "Consultation",
    description: "Base consultation & clinical procedure fees",
    icon: Stethoscope,
    placeholder: "e.g. Specialist Follow-up review",
  },
  {
    type: "radiology",
    label: "Radiology",
    description: "Imaging orders for doctor diagnostics",
    icon: FlaskConical,
    placeholder: "e.g. Chest X-ray (PA view)",
  },
  {
    type: "procedure",
    label: "Injection / vaccine",
    description: "Daily course items: vaccines, IM/IV injections",
    icon: Syringe,
    placeholder: "e.g. Rabies vaccine (daily dose)",
  },
];

export function AddCatalogItemDialog({
  defaultType = "lab_test",
  trigger,
  onSaved,
}: {
  defaultType?: CatalogItemType;
  trigger?: React.ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CatalogItemType>(defaultType);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [openingQuantity, setOpeningQuantity] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentOption = typeOptions.find((opt) => opt.type === type) ?? typeOptions[0];

  function reset() {
    setName("");
    setPrice("");
    setUnit("");
    setTrackInventory(true);
    setOpeningQuantity("");
    setReorderLevel("");
    setType(defaultType === "lab_panel" || defaultType === "supply" ? "lab_test" : defaultType);
  }

  const isDrug = type === "drug";
  const tracksStock = isDrug && trackInventory;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(price);
    if (!name.trim() || Number.isNaN(amount) || amount < 0) {
      toast.error("Please provide a valid name and price.");
      return;
    }
    if (type === "lab_panel" || type === "supply") {
      toast.error("Use the clinic supplies workspace to add internal stock.");
      return;
    }

    const opening = openingQuantity.trim() ? Number(openingQuantity) : 0;
    const reorder = reorderLevel.trim() ? Number(reorderLevel) : 0;
    if (tracksStock) {
      if (Number.isNaN(opening) || opening < 0 || Number.isNaN(reorder) || reorder < 0) {
        toast.error("Enter valid opening quantity and reorder level.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await createCatalogItem({
        itemType: type,
        name: name.trim(),
        price: amount,
        unit: tracksStock && unit.trim() ? unit.trim() : undefined,
        trackInventory: tracksStock,
        openingQuantity: tracksStock ? opening : 0,
        reorderLevel: tracksStock ? reorder : 0,
      });
      announceCoreDataChanged();
      onSaved?.();
      toast.success(`${currentOption.label} added`, {
        description: `"${name.trim()}" priced at ${formatMoney(amount)} is now active.`,
      });
      setOpen(false);
      reset();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The catalog item could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            Add catalog item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add to service catalog</DialogTitle>
          <DialogDescription>
            Configure a billed service or medication. Clinic supplies are added from Admin → Inventory.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5 pt-1" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-2">
            <Label className="text-[13px] font-medium text-foreground">Select category *</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => {
                const next = value as AddableCatalogType;
                setType(next);
                setTrackInventory(next === "drug");
              }}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = type === opt.type;
                return (
                  <label
                    key={opt.type}
                    htmlFor={`type-${opt.type}`}
                    className={cn(
                      "flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all",
                      isSelected
                        ? "border-foreground/40 bg-surface-1 font-semibold shadow-sm ring-1 ring-foreground/20"
                        : "border-border bg-surface-2 text-fg-secondary hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className={cn("size-5", isSelected ? "text-foreground" : "text-fg-muted")}
                        strokeWidth={1.75}
                      />
                      <RadioGroupItem value={opt.type} id={`type-${opt.type}`} className="sr-only" />
                    </div>
                    <div className="mt-3">
                      <p className="text-[13px] font-medium text-foreground">{opt.label}</p>
                      <p className="mt-0.5 text-[11px] leading-tight text-fg-muted">{opt.description}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="catalog-item-name" className="text-[13px] font-medium text-foreground">
              Item or service name *
            </Label>
            <Input
              id="catalog-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={currentOption.placeholder}
              required
              autoFocus
              className="h-10 bg-background text-[14px]"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="catalog-item-price" className="text-[13px] font-medium text-foreground">
              Standard price (GHS) *
            </Label>
            <Input
              id="catalog-item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
              className="h-10 bg-background font-mono text-[14px] tabular-nums"
              required
            />
          </div>

          {isDrug ? (
            <div className="space-y-4 rounded-xl border border-border/70 bg-surface-1 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="track-inventory"
                  checked={trackInventory}
                  onCheckedChange={(checked) => setTrackInventory(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="track-inventory" className="text-[13px] font-medium text-foreground">
                    Track medication inventory
                  </Label>
                  <p className="text-[11px] text-fg-muted">
                    Enables stock counts on Admin → Inventory and batch receiving. Dispense after payment reduces stock.
                  </p>
                </div>
              </div>

              {trackInventory ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5 sm:col-span-1">
                    <Label htmlFor="catalog-item-unit" className="text-[12px] font-medium text-fg-secondary">
                      Unit
                    </Label>
                    <Input
                      id="catalog-item-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      placeholder="e.g. tablet"
                      className="h-9 bg-background text-[13px]"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="catalog-opening-qty" className="text-[12px] font-medium text-fg-secondary">
                      Opening stock
                    </Label>
                    <Input
                      id="catalog-opening-qty"
                      type="number"
                      min="0"
                      step="1"
                      value={openingQuantity}
                      onChange={(event) => setOpeningQuantity(event.target.value)}
                      placeholder="0"
                      className="h-9 bg-background font-mono text-[13px] tabular-nums"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="catalog-reorder-level" className="text-[12px] font-medium text-fg-secondary">
                      Reorder level
                    </Label>
                    <Input
                      id="catalog-reorder-level"
                      type="number"
                      min="0"
                      step="1"
                      value={reorderLevel}
                      onChange={(event) => setReorderLevel(event.target.value)}
                      placeholder="10"
                      className="h-9 bg-background font-mono text-[13px] tabular-nums"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitting ? "Saving…" : "Save to catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
