"use client";

import { useMemo, useState } from "react";
import { AlertCircle, FlaskConical, Search, X } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";
import type { LabUrgency, CatalogItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderLabDialog({
  visitId,
  doctorId,
}: {
  visitId: string;
  doctorId: string;
}) {
  const { labTests, radiologyTests, labRequests, orderLabs } = useClinic();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<LabUrgency>("routine");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("lab");

  const activeTests = [...labTests, ...(radiologyTests || [])].filter((test) => test.active);

  const pendingIds = useMemo(
    () =>
      new Set(
        labRequests
          .filter(
            (request) =>
              request.visitId === visitId && request.status !== "result-ready" && request.status !== "reviewed",
          )
          .map((request) => request.catalogItemId),
      ),
    [labRequests, visitId],
  );

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeTests;
    return activeTests.filter((test) => test.name.toLowerCase().includes(q));
  }, [activeTests, search]);

  function reset() {
    setSelected([]);
    setUrgency("routine");
    setNotes("");
    setSearch("");
  }

  const selectedTotal = useMemo(() => {
    return activeTests
      .filter((t) => selected.includes(t.id))
      .reduce((sum, t) => sum + t.price, 0);
  }, [activeTests, selected]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <FlaskConical className="size-4" />
          Order lab / imaging
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(640px,90vh)] w-full sm:max-w-[620px] flex-col gap-4 overflow-hidden p-6">
        <DialogHeader>
          <DialogTitle>Order laboratory & imaging diagnostics</DialogTitle>
          <DialogDescription>
            Select diagnostic tests from the active clinic catalog and specify clinical indications.
          </DialogDescription>
        </DialogHeader>

        {activeTests.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-fg-muted">
            No active lab tests configured in clinic catalog. Ask Administrator to add items.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Search Filter Bar */}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search diagnostic tests (e.g. Malaria, FBC, Glucose)…"
                className="h-10 pl-9 pr-8 text-[14px] bg-surface-1/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Test Selection Checkbox List */}
            <div className="min-h-0 flex-1 rounded-xl border border-border bg-surface-1/40 p-2">
              <ScrollArea className="h-full pr-2">
                {filteredTests.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-fg-muted">
                    No tests match &ldquo;{search}&rdquo;
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTests.map((test) => {
                      const already = pendingIds.has(test.id);
                      const checked = already || selected.includes(test.id);
                      return (
                        <label
                          key={test.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors",
                            already
                              ? "border-border/50 bg-surface-1/60 opacity-60 cursor-not-allowed"
                              : checked
                                ? "border-foreground/30 bg-surface-1 shadow-sm"
                                : "border-border/70 bg-surface-2 hover:border-border-strong",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={checked}
                              disabled={already}
                              onCheckedChange={(value) => {
                                setSelected((current) =>
                                  value === true
                                    ? [...current, test.id]
                                    : current.filter((id) => id !== test.id),
                                );
                              }}
                            />
                            <div className="min-w-0">
                               <span className="text-[14px] font-medium text-foreground block truncate">
                                {test.name}
                              </span>
                              {already && (
                                <span className="text-[11px] font-medium text-warning-text">
                                  Already pending in lab
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="font-mono text-[13px] font-medium tabular-nums text-fg-secondary shrink-0">
                            {formatMoney(test.price)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Urgency & Notes */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Urgency Radio Selector */}
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-medium text-fg-secondary">
                  Priority level
                </Label>
                <RadioGroup
                  value={urgency}
                  onValueChange={(val) => setUrgency(val as LabUrgency)}
                  className="grid grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="urgency-routine"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-[13px] transition-colors",
                      urgency === "routine"
                        ? "border-foreground/40 bg-surface-1 font-medium"
                        : "border-border bg-surface-2 text-fg-secondary",
                    )}
                  >
                    <RadioGroupItem value="routine" id="urgency-routine" />
                    <span>Routine</span>
                  </label>

                  <label
                    htmlFor="urgency-urgent"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-[13px] transition-colors",
                      urgency === "urgent"
                        ? "border-danger-fill bg-danger-bg text-danger-text font-semibold"
                        : "border-border bg-surface-2 text-fg-secondary",
                    )}
                  >
                    <RadioGroupItem value="urgent" id="urgency-urgent" />
                    <span>Urgent (STAT)</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Selected Total Strip */}
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-medium text-fg-secondary">
                  Estimated test total
                </Label>
                <div className="flex h-9 items-center justify-between rounded-lg border border-border bg-surface-1 px-3">
                  <span className="text-[12px] text-fg-muted">
                    {selected.length} {selected.length === 1 ? "test" : "tests"} selected
                  </span>
                  <span className="font-mono text-[14px] font-bold tabular-nums text-foreground">
                    {formatMoney(selectedTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Clinical Notes Input */}
            <div className="grid gap-1.5">
              <Label htmlFor="lab-notes" className="text-[12px] font-medium text-fg-secondary">
                Clinical indication & notes for technician
              </Label>
              <Textarea
                id="lab-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Specify clinical history, suspected pathology, or test priority…"
                rows={2}
                className="bg-surface-1/60 text-[13px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-3">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={selected.length === 0}
            onClick={() => {
              const created = orderLabs({
                visitId,
                doctorId,
                catalogItemIds: selected,
                urgency,
                clinicalNotes: notes,
              });
              toast.success(
                created.length === 1
                  ? "Laboratory order dispatched"
                  : `${created.length} diagnostic tests ordered`,
                { description: "The laboratory technician workbench has been updated." },
              );
              setOpen(false);
              reset();
            }}
          >
            Dispatch order ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
