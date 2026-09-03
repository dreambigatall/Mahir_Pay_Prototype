"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { listCatalogItems, updateCatalogItem, type LabPanel } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";

export function EditLabPanelDialog({
  panel,
  open,
  onOpenChange,
  onSaved,
}: {
  panel: LabPanel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(panel.name);
  const [description, setDescription] = useState(panel.description ?? "");
  const [selected, setSelected] = useState<string[]>(panel.members.map((member) => member.id));
  const [tests, setTests] = useState<Array<{ id: string; name: string; item_type: string; price: string; active: boolean }>>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTests = useCallback(async () => {
    setLoadingTests(true);
    try {
      const [labs, imaging] = await Promise.all([
        listCatalogItems({ type: "lab_test", includeInactive: true }),
        listCatalogItems({ type: "radiology", includeInactive: true }),
      ]);
      setTests([...labs.items, ...imaging.items]);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Tests could not be loaded.");
    } finally {
      setLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setName(panel.name);
      setDescription(panel.description ?? "");
      setSelected(panel.members.map((member) => member.id));
      void loadTests();
    }
  }, [open, panel, loadTests]);

  const totalPrice = useMemo(
    () => tests.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Number(item.price), 0),
    [selected, tests],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !selected.length) {
      toast.error("Provide a panel name and at least one member test.");
      return;
    }

    setSubmitting(true);
    try {
      await updateCatalogItem(panel.id, {
        name: name.trim(),
        description: description.trim() || null,
        memberItemIds: selected,
      });
      announceCoreDataChanged();
      onSaved?.();
      toast.success("Lab panel updated", {
        description: `"${name.trim()}" · ${selected.length} test(s) · ${formatMoney(totalPrice)}`,
      });
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The lab panel could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6 sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Edit lab panel</DialogTitle>
          <DialogDescription>
            Update the panel name or member tests. Price recalculates automatically from active member prices.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 pt-1" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-panel-name">Panel name *</Label>
            <Input
              id="edit-panel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="h-10 bg-background"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="edit-panel-description">Description</Label>
            <Textarea
              id="edit-panel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Member tests *</Label>
              <span className="text-xs text-fg-muted">
                {selected.length} selected · {formatMoney(totalPrice)}
              </span>
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
              {loadingTests ? (
                <div className="flex min-h-24 items-center justify-center text-sm text-fg-muted">
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Loading tests…
                </div>
              ) : (
                tests.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-surface-1"
                  >
                    <Checkbox
                      checked={selected.includes(item.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className={`min-w-0 flex-1 text-sm ${item.active ? "" : "text-fg-muted line-through"}`}>
                      {item.name}
                    </span>
                    <span className="text-xs capitalize text-fg-muted">{item.item_type.replace("_", " ")}</span>
                    <span className="font-mono text-xs tabular-nums">{formatMoney(Number(item.price))}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
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
