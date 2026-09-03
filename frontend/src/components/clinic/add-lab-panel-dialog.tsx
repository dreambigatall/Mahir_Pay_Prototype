"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, Layers, Loader2, Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createLabPanel, listCatalogItems, type CatalogItem } from "@/lib/api/catalog";
import { announceCoreDataChanged } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";

export function AddLabPanelDialog({
  trigger,
  onSaved,
}: {
  trigger?: React.ReactNode;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [tests, setTests] = useState<CatalogItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTests = useCallback(async () => {
    setLoadingTests(true);
    try {
      const [labs, imaging] = await Promise.all([
        listCatalogItems({ type: "lab_test" }),
        listCatalogItems({ type: "radiology" }),
      ]);
      setTests([...labs.items, ...imaging.items].filter((item) => item.active));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Tests could not be loaded.");
    } finally {
      setLoadingTests(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadTests();
  }, [open, loadTests]);

  const totalPrice = useMemo(
    () => tests.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + Number(item.price), 0),
    [selected, tests],
  );

  function reset() {
    setName("");
    setDescription("");
    setSelected([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !selected.length) {
      toast.error("Provide a panel name and select at least one test.");
      return;
    }

    setSubmitting(true);
    try {
      await createLabPanel({
        name: name.trim(),
        description: description.trim() || undefined,
        memberItemIds: selected,
      });
      announceCoreDataChanged();
      onSaved?.();
      toast.success("Lab panel created", {
        description: `"${name.trim()}" includes ${selected.length} test(s) · ${formatMoney(totalPrice)}`,
      });
      setOpen(false);
      reset();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The lab panel could not be saved.");
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
          <Button variant="outline" className="gap-1.5 shadow-sm">
            <Layers className="size-4" />
            Add lab panel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Create lab order set</DialogTitle>
          <DialogDescription>
            Bundle multiple lab or imaging tests into a one-click panel for doctors. Price is the sum of member tests.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 pt-1" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="panel-name">Panel name *</Label>
            <Input
              id="panel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Antenatal screening panel"
              required
              className="h-10 bg-background"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="panel-description">Description</Label>
            <Textarea
              id="panel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional clinical context for staff"
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
              ) : tests.length ? (
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
                    <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                    <span className="text-xs capitalize text-fg-muted">{item.item_type.replace("_", " ")}</span>
                    <span className="font-mono text-xs tabular-nums">{formatMoney(Number(item.price))}</span>
                  </label>
                ))
              ) : (
                <p className="p-3 text-sm text-fg-muted">
                  Add individual lab tests or radiology items to the catalog first.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !tests.length} className="gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" />}
              {submitting ? "Saving…" : "Save panel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
