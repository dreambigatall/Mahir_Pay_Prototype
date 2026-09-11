"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Loader2, PackagePlus } from "lucide-react";
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
import { createSupplies, createSupplyGroup, listSupplyGroups, type SupplyGroup } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";

type Mode = "category" | "item";

export function AddSupplyDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("category");

  function openMode(next: Mode) {
    setMode(next);
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 gap-2 px-4"
          onClick={() => openMode("category")}
        >
          <FolderPlus className="size-4" aria-hidden="true" />
          Add category
        </Button>
        <Button
          type="button"
          className="min-h-11 gap-2 px-4"
          onClick={() => openMode("item")}
        >
          <PackagePlus className="size-4" aria-hidden="true" />
          Add supply
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setMode("category");
        }}
      >
      <DialogContent className="p-6 sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "category" ? "Add category" : "Add supply"}</DialogTitle>
          <DialogDescription>
            {mode === "category"
              ? "Name a group such as Needles, Lab reagents, or Test kits."
              : "Pick a saved category, then enter the item, unit, and quantity."}
          </DialogDescription>
        </DialogHeader>
        {mode === "category" ? (
          <CategoryForm
            onDone={() => {
              setOpen(false);
              onSaved?.();
            }}
          />
        ) : (
          <SupplyItemForm
            onDone={() => {
              setOpen(false);
              onSaved?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

function CategoryForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a category name, for example Needles or Lab reagents.");
      return;
    }
    setSubmitting(true);
    try {
      await createSupplyGroup(name.trim());
      announceCoreDataChanged();
      toast.success("Category saved", { description: `"${name.trim()}" is ready. Use Add supply to put items in it.` });
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The category could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-1.5">
        <Label htmlFor="supply-category-name">Category name *</Label>
        <Input
          id="supply-category-name"
          className="min-h-11"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Needles, Lab reagents, Test kits"
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="min-h-11 gap-2">
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Saving…" : "Save category"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SupplyItemForm({ onDone }: { onDone: () => void }) {
  const [groups, setGroups] = useState<SupplyGroup[]>([]);
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reorderLevel,setReorderLevel]=useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void listSupplyGroups(controller.signal)
      .then((result) => setGroups(result.items))
      .catch(() => setGroups([]));
    return () => controller.abort();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const qty = quantity.trim() ? Number(quantity) : 0;
    const reorder=reorderLevel.trim()?Number(reorderLevel):0;
    if (!groupId) {
      toast.error("Choose a category first. Add one with Add category if the list is empty.");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter the supply name.");
      return;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if(!Number.isFinite(reorder)||reorder<0){toast.error("Enter a valid reorder point.");return;}
    setSubmitting(true);
    try {
      await createSupplies({
        groupId,
        items: [{ name: name.trim(), unit: unit.trim() || undefined, openingQuantity: qty, reorderLevel: reorder }],
      });
      announceCoreDataChanged();
      toast.success("Supply saved", { description: `${name.trim()} was added with ${qty || 0} ${unit.trim() || "units"}.` });
      onDone();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The supply could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!groups.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-fg-muted">
        No categories yet. Close this and use <span className="font-medium text-foreground">Add category</span> first.
      </p>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-1.5">
        <Label>Category *</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="min-h-11">
            <SelectValue placeholder="Choose Needles, reagents…" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="supply-item-name">Item name *</Label>
        <Input
          id="supply-item-name"
          className="min-h-11"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. 23G needle"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="supply-item-unit">Unit</Label>
          <Input
            id="supply-item-unit"
            className="min-h-11"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="piece, kit, vial"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="supply-item-qty">Quantity</Label>
          <Input
            id="supply-item-qty"
            className="min-h-11 font-mono"
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="supply-reorder-level">Reorder at</Label>
          <Input id="supply-reorder-level" className="min-h-11 font-mono" type="number" min="0" step="1" value={reorderLevel} onChange={(event)=>setReorderLevel(event.target.value)} placeholder="10" />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="min-h-11 gap-2">
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Saving…" : "Save supply"}
        </Button>
      </DialogFooter>
    </form>
  );
}
