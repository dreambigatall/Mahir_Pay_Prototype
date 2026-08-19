"use client";

import { useState } from "react";
import { FlaskConical, Pill, Plus, Stethoscope } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";
import type { CatalogType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeOptions: {
  type: CatalogType;
  label: string;
  description: string;
  icon: typeof FlaskConical;
  placeholder: string;
}[] = [
  {
    type: "lab_test",
    label: "Lab test",
    description: "Appears on the doctor’s order form and lab technician board",
    icon: FlaskConical,
    placeholder: "e.g. Thyroid panel (TSH, FT4)",
  },
  {
    type: "drug",
    label: "Medication",
    description: "Available for prescription line items and dispensary billing",
    icon: Pill,
    placeholder: "e.g. Amoxicillin 500mg caps",
  },
  {
    type: "consultation",
    label: "Consultation / Service",
    description: "Base consultation fees, reviews, and clinical procedures",
    icon: Stethoscope,
    placeholder: "e.g. Specialist follow-up",
  },
];

export function AddCatalogItemDialog({
  defaultType = "lab_test",
  trigger,
}: {
  defaultType?: CatalogType;
  trigger?: React.ReactNode;
}) {
  const { addCatalogItem } = useClinic();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CatalogType>(defaultType);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const currentOption = typeOptions.find((opt) => opt.type === type) ?? typeOptions[0];

  function reset() {
    setName("");
    setPrice("");
    setType(defaultType);
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
          <Button className="gap-1.5">
            <Plus className="size-4" />
            Add catalog item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to service catalog</DialogTitle>
          <DialogDescription>
            Configure a new item, test, or medication with standard clinic pricing.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(price);
            if (!name.trim() || Number.isNaN(amount) || amount < 0) {
              toast.error("Please provide a valid name and price.");
              return;
            }

            addCatalogItem({
              type,
              name: name.trim(),
              price: amount,
            });

            toast.success(`${currentOption.label} added`, {
              description: `"${name.trim()}" priced at ${formatMoney(amount)} is now active.`,
            });

            setOpen(false);
            reset();
          }}
        >
          {/* Category selection */}
          <div className="grid gap-2">
            <Label className="text-[13px] font-medium text-fg-secondary">
              Category
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(val) => setType(val as CatalogType)}
              className="grid gap-2 sm:grid-cols-3"
            >
              {typeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = type === opt.type;
                return (
                  <label
                    key={opt.type}
                    htmlFor={`type-${opt.type}`}
                    className={cn(
                      "flex cursor-pointer flex-col justify-between rounded-xl border p-3 transition-colors",
                      isSelected
                        ? "border-foreground/40 bg-surface-1 shadow-sm"
                        : "border-border bg-surface-2 hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className={cn(
                          "size-4",
                          isSelected ? "text-foreground" : "text-fg-muted",
                        )}
                        strokeWidth={1.75}
                      />
                      <RadioGroupItem
                        value={opt.type}
                        id={`type-${opt.type}`}
                        className="sr-only"
                      />
                    </div>
                    <div className="mt-3">
                      <p className="text-[13px] font-medium">{opt.label}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
            <p className="text-[12px] text-fg-muted">{currentOption.description}</p>
          </div>

          {/* Item Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="catalog-item-name" className="text-[13px] font-normal">
              Item name
            </Label>
            <Input
              id="catalog-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={currentOption.placeholder}
              required
              autoFocus
            />
          </div>

          {/* Price */}
          <div className="grid gap-1.5">
            <Label htmlFor="catalog-item-price" className="text-[13px] font-normal">
              Price (GHS)
            </Label>
            <Input
              id="catalog-item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Save item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
