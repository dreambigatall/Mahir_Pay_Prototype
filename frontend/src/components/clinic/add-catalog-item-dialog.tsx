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
import { FormField, FormGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
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
  icon: typeof FlaskConical;
  placeholder: string;
}[] = [
  {
    type: "lab_test",
    label: "Lab test",
    icon: FlaskConical,
    placeholder: "e.g. Thyroid Panel (TSH, FT4)",
  },
  {
    type: "drug",
    label: "Medication",
    icon: Pill,
    placeholder: "e.g. Amoxicillin 500mg capsules",
  },
  {
    type: "consultation",
    label: "Consultation",
    icon: Stethoscope,
    placeholder: "e.g. Specialist Follow-up review",
  },
  {
    type: "radiology",
    label: "Radiology",
    icon: FlaskConical,
    placeholder: "e.g. Chest X-ray (PA view)",
  },
  {
    type: "procedure",
    label: "Injection / vaccine",
    icon: Syringe,
    placeholder: "e.g. Rabies vaccine (daily dose)",
  },
];

const FORM_ID = "add-catalog-item-form";

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
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-1">
          <DialogTitle>Add to service catalog</DialogTitle>
          <DialogDescription>
            Configure a billed service or medication. Clinic supplies are added from Admin → Inventory.
          </DialogDescription>
        </DialogHeader>

        <form id={FORM_ID} className="min-h-0 flex-1 overflow-y-auto px-6 py-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-5">
            <FormGroup eyebrow="Category">
              <RadioGroup
                value={type}
                onValueChange={(value) => {
                  const next = value as AddableCatalogType;
                  setType(next);
                  setTrackInventory(next === "drug");
                }}
                className="flex flex-wrap gap-2"
              >
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = type === opt.type;
                  return (
                    <label
                      key={opt.type}
                      htmlFor={`type-${opt.type}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface-2 text-fg-secondary hover:border-border-strong",
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      {opt.label}
                      <RadioGroupItem value={opt.type} id={`type-${opt.type}`} className="sr-only" />
                    </label>
                  );
                })}
              </RadioGroup>
            </FormGroup>

            <FormGroup eyebrow="Basic details">
              <FormField id="catalog-item-name" label="Item or service name" required>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={currentOption.placeholder}
                  required
                  autoFocus
                  className="h-10 bg-background text-[14px]"
                />
              </FormField>

              <FormField id="catalog-item-price" label="Standard price (GHS)" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0.00"
                  className="h-10 bg-background font-mono text-[14px] tabular-nums"
                  required
                />
              </FormField>
            </FormGroup>

            {isDrug ? (
              <FormGroup eyebrow="Inventory tracking" hint="Only medications can track stock counts">
                <label htmlFor="track-inventory" className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    id="track-inventory"
                    checked={trackInventory}
                    onCheckedChange={(checked) => setTrackInventory(checked === true)}
                  />
                  <span className="grid gap-1">
                    <span className="text-[13px] font-medium text-foreground">Track medication inventory</span>
                    <span className="text-[12px] text-fg-muted">
                      Enables stock counts on Admin → Inventory and batch receiving. Dispense after payment reduces stock.
                    </span>
                  </span>
                </label>

                {trackInventory ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField id="catalog-item-unit" label="Unit">
                      <Input
                        value={unit}
                        onChange={(event) => setUnit(event.target.value)}
                        placeholder="e.g. tablet"
                        className="h-9 bg-background text-[13px]"
                      />
                    </FormField>
                    <FormField id="catalog-opening-qty" label="Opening stock">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={openingQuantity}
                        onChange={(event) => setOpeningQuantity(event.target.value)}
                        placeholder="0"
                        className="h-9 bg-background font-mono text-[13px] tabular-nums"
                      />
                    </FormField>
                    <FormField id="catalog-reorder-level" label="Reorder level">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={reorderLevel}
                        onChange={(event) => setReorderLevel(event.target.value)}
                        placeholder="10"
                        className="h-9 bg-background font-mono text-[13px] tabular-nums"
                      />
                    </FormField>
                  </div>
                ) : null}
              </FormGroup>
            ) : null}
          </div>
        </form>

        <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4">
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
          <Button type="submit" form={FORM_ID} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Saving…" : "Save to catalog"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
