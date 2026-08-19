"use client";

import { useState } from "react";
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
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";
import type { CatalogItem, CatalogType } from "@/lib/types";

export function EditCatalogItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: CatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateCatalogItem } = useClinic();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [type, setType] = useState<CatalogType>(item.type);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setName(item.name);
          setPrice(String(item.price));
          setType(item.type);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit catalog item</DialogTitle>
          <DialogDescription>
            Update pricing or details for {item.name}.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3.5 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(price);
            if (!name.trim() || Number.isNaN(amount) || amount < 0) {
              toast.error("Please enter a valid item name and price.");
              return;
            }

            updateCatalogItem(item.id, {
              name: name.trim(),
              price: amount,
              type,
            });

            toast.success("Item updated", {
              description: `"${name.trim()}" is now set to ${formatMoney(amount)}.`,
            });

            onOpenChange(false);
          }}
        >
          {/* Category selection */}
          <div className="grid gap-1.5">
            <Label className="text-[13px] font-normal">Category</Label>
            <Select
              value={type}
              onValueChange={(val) => setType(val as CatalogType)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab_test">Lab test</SelectItem>
                <SelectItem value="drug">Medication</SelectItem>
                <SelectItem value="consultation">Consultation / Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Item Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="edit-item-name" className="text-[13px] font-normal">
              Item name
            </Label>
            <Input
              id="edit-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Price */}
          <div className="grid gap-1.5">
            <Label htmlFor="edit-item-price" className="text-[13px] font-normal">
              Price (GHS)
            </Label>
            <Input
              id="edit-item-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="tabular-nums"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
