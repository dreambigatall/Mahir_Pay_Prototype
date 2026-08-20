"use client";

import { useState } from "react";
import { FlaskConical, Pill, Plus, Stethoscope, Syringe } from "lucide-react";
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
          <Button className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            Add catalog item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] p-6">
        <DialogHeader>
          <DialogTitle>Add to service catalog</DialogTitle>
          <DialogDescription>
            Configure a new diagnostic test, pharmacy drug, or consultation fee with standard clinic pricing.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5 pt-1"
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

            toast.success(`${currentOption.label} added to catalog`, {
              description: `"${name.trim()}" priced at ${formatMoney(amount)} is now active.`,
            });

            setOpen(false);
            reset();
          }}
        >
          {/* Category selection */}
          <div className="grid gap-2">
            <Label className="text-[13px] font-medium text-foreground">
              Select category *
            </Label>
            <RadioGroup
              value={type}
              onValueChange={(val) => setType(val as CatalogType)}
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
                        ? "border-foreground/40 bg-surface-1 shadow-sm font-semibold ring-1 ring-foreground/20"
                        : "border-border bg-surface-2 hover:border-border-strong text-fg-secondary",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className={cn(
                          "size-5",
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
                      <p className="text-[13px] text-foreground font-medium">{opt.label}</p>
                      <p className="text-[11px] text-fg-muted mt-0.5 leading-tight">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Item Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="catalog-item-name" className="text-[13px] font-medium text-foreground">
              Item or service name *
            </Label>
            <Input
              id="catalog-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={currentOption.placeholder}
              required
              autoFocus
              className="h-10 bg-surface-1/60 text-[14px]"
            />
          </div>

          {/* Price */}
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
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="h-10 bg-surface-1/60 text-[14px] font-mono tabular-nums"
              required
            />
          </div>

          <DialogFooter className="pt-3">
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
            <Button type="submit">Save to catalog</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
