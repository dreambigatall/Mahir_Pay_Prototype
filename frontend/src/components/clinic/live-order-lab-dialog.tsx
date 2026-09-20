"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FlaskConical, Layers, Loader2, Search, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createDiagnosticOrder, type CatalogItem, type LabPanel, type PanelMember } from "@/lib/api/clinical";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type PanelSelection = "none" | "partial" | "full";

function panelMatchesSearch(panel: LabPanel, query: string) {
  if (!query) return true;
  if (panel.name.toLowerCase().includes(query)) return true;
  return panel.members.some((member) => member.name.toLowerCase().includes(query));
}

function getPanelSelection(panel: LabPanel, selected: Set<string>, pending: Set<string>): PanelSelection {
  const orderable = panel.members.filter((member) => !pending.has(member.id));
  if (orderable.length === 0) return "full";
  const picked = orderable.filter((member) => selected.has(member.id)).length;
  if (picked === 0) return "none";
  if (picked === orderable.length) return "full";
  return "partial";
}

function buildDispatchIds(panels: LabPanel[], selected: string[], pending: Set<string>) {
  const selectedSet = new Set(selected);
  const dispatchIds: string[] = [];
  const consumed = new Set<string>();

  for (const panel of panels) {
    const pickedMembers = panel.members.filter((member) => selectedSet.has(member.id));
    if (!pickedMembers.length) continue;

    const orderable = panel.members.filter((member) => !pending.has(member.id));
    const fullPanel =
      orderable.length > 0 &&
      orderable.length === panel.members.length &&
      orderable.every((member) => selectedSet.has(member.id));

    if (fullPanel) {
      dispatchIds.push(panel.id);
      panel.members.forEach((member) => consumed.add(member.id));
    } else {
      pickedMembers.forEach((member) => {
        if (!consumed.has(member.id)) dispatchIds.push(member.id);
      });
      panel.members.forEach((member) => consumed.add(member.id));
    }
  }

  for (const id of selected) {
    if (!consumed.has(id)) dispatchIds.push(id);
  }

  return [...new Set(dispatchIds)];
}

function estimateTotal(
  panels: LabPanel[],
  standaloneTests: CatalogItem[],
  selected: string[],
  pending: Set<string>,
) {
  const selectedSet = new Set(selected);
  let total = 0;
  const counted = new Set<string>();

  for (const panel of panels) {
    const orderable = panel.members.filter((member) => !pending.has(member.id));
    const picked = orderable.filter((member) => selectedSet.has(member.id));
    if (!picked.length) continue;

    if (orderable.length > 0 && picked.length === orderable.length && orderable.length === panel.members.length) {
      total += Number(panel.price);
      picked.forEach((member) => counted.add(member.id));
    } else {
      picked.forEach((member) => {
        total += Number(member.price);
        counted.add(member.id);
      });
    }
  }

  for (const test of standaloneTests) {
    if (selectedSet.has(test.id) && !counted.has(test.id)) {
      total += Number(test.price);
    }
  }

  return total;
}

export function LiveOrderLabDialog({
  encounterId,
  catalog,
  panels,
  pendingCatalogItemIds,
  disabled,
  trigger,
  onOrdered,
}: {
  encounterId: string;
  catalog: CatalogItem[];
  panels: LabPanel[];
  pendingCatalogItemIds: Set<string>;
  disabled?: boolean;
  trigger?: ReactNode;
  onOrdered: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [urgency, setUrgency] = useState<"routine" | "urgent">("routine");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeTests = useMemo(
    () => catalog.filter((item) => item.active && (item.item_type === "lab_test" || item.item_type === "radiology")),
    [catalog],
  );

  const panelMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const panel of panels) {
      for (const member of panel.members) ids.add(member.id);
    }
    return ids;
  }, [panels]);

  const standaloneTests = useMemo(
    () => activeTests.filter((test) => !panelMemberIds.has(test.id)),
    [activeTests, panelMemberIds],
  );

  const searchQuery = search.trim().toLowerCase();

  const filteredPanels = useMemo(
    () => panels.filter((panel) => panelMatchesSearch(panel, searchQuery)),
    [panels, searchQuery],
  );

  const filteredStandalone = useMemo(() => {
    if (!searchQuery) return standaloneTests;
    return standaloneTests.filter((test) => test.name.toLowerCase().includes(searchQuery));
  }, [standaloneTests, searchQuery]);

  const selectedTotal = useMemo(
    () => estimateTotal(panels, standaloneTests, selected, pendingCatalogItemIds),
    [panels, standaloneTests, selected, pendingCatalogItemIds],
  );

  useEffect(() => {
    if (!searchQuery) return;
    setExpandedPanels((current) => {
      const next = new Set(current);
      for (const panel of panels) {
        if (panel.members.some((member) => member.name.toLowerCase().includes(searchQuery))) {
          next.add(panel.id);
        }
      }
      return next;
    });
  }, [searchQuery, panels]);

  function reset() {
    setSelected([]);
    setExpandedPanels(new Set());
    setUrgency("routine");
    setNotes("");
    setSearch("");
  }

  function togglePanel(panel: LabPanel, checked: boolean) {
    const orderable = panel.members.filter((member) => !pendingCatalogItemIds.has(member.id)).map((member) => member.id);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        orderable.forEach((id) => next.add(id));
      } else {
        panel.members.forEach((member) => next.delete(member.id));
      }
      return [...next];
    });
  }

  function toggleMember(memberId: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, memberId])] : current.filter((id) => id !== memberId),
    );
  }

  function toggleExpanded(panelId: string) {
    setExpandedPanels((current) => {
      const next = new Set(current);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }

  async function dispatch() {
    const ids = buildDispatchIds(panels, selected, pendingCatalogItemIds);
    if (!ids.length) {
      toast.error("Select at least one diagnostic test.");
      return;
    }

    setSubmitting(true);
    try {
      await createDiagnosticOrder({
        encounterId,
        catalogItemIds: ids,
        urgency,
        clinicalNotes: notes.trim() || undefined,
      });
      toast.success(
        ids.length === 1 ? "Laboratory order dispatched" : `${selected.length} diagnostic tests ordered`,
        { description: "The laboratory technician workbench has been updated." },
      );
      reset();
      setOpen(false);
      await onOrdered();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The laboratory order could not be dispatched.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasCatalog = activeTests.length > 0 || panels.length > 0;
  const hasResults = filteredPanels.length > 0 || filteredStandalone.length > 0;

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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" disabled={disabled}>
            <FlaskConical className="size-3.5" aria-hidden="true" />
            Order lab / imaging
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[min(820px,94vh)] w-full max-h-[94vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Order laboratory & imaging diagnostics</DialogTitle>
          <DialogDescription>
            Expand a panel to pick individual tests, or select standalone tests from the catalog.
          </DialogDescription>
        </DialogHeader>

        {!hasCatalog ? (
          <div className="px-6 py-12 text-center text-[13px] text-fg-muted">
            No active lab tests configured in clinic catalog. Ask Administrator to add items.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-4">
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search panels or tests (e.g. Stool, Malaria, FBC)…"
                className="h-10 bg-background pr-8 pl-9 text-[14px]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface-1/40 p-2">
              {!hasResults ? (
                <p className="py-8 text-center text-[13px] text-fg-muted">No panels or tests match &ldquo;{search}&rdquo;</p>
              ) : (
                <div className="space-y-1.5">
                  {filteredPanels.map((panel) => (
                    <PanelRow
                      key={panel.id}
                      panel={panel}
                      expanded={expandedPanels.has(panel.id)}
                      selection={getPanelSelection(panel, new Set(selected), pendingCatalogItemIds)}
                      pending={pendingCatalogItemIds}
                      selected={new Set(selected)}
                      onToggleExpand={() => toggleExpanded(panel.id)}
                      onTogglePanel={(checked) => togglePanel(panel, checked === true)}
                      onToggleMember={toggleMember}
                    />
                  ))}

                  {filteredStandalone.length > 0 && filteredPanels.length > 0 ? (
                    <div className="flex items-center gap-2 px-1 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-muted uppercase">
                      Individual tests
                    </div>
                  ) : null}

                  {filteredStandalone.map((test) => {
                    const already = pendingCatalogItemIds.has(test.id);
                    const checked = already || selected.includes(test.id);
                    return (
                      <TestRow
                        key={test.id}
                        name={test.name}
                        subtitle={already ? "Already pending in lab" : test.item_type.replace("_", " ")}
                        subtitleWarning={already}
                        price={Number(test.price)}
                        checked={checked}
                        disabled={already}
                        onCheckedChange={(value) =>
                          setSelected((current) =>
                            value === true ? [...current, test.id] : current.filter((id) => id !== test.id),
                          )
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid shrink-0 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-[12px] font-medium text-fg-secondary">Priority level</Label>
                <RadioGroup
                  value={urgency}
                  onValueChange={(value) => setUrgency(value as "routine" | "urgent")}
                  className="grid grid-cols-2 gap-2"
                >
                  <label
                    htmlFor="live-urgency-routine"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-[13px] transition-colors",
                      urgency === "routine"
                        ? "border-foreground/40 bg-surface-1 font-medium"
                        : "border-border bg-surface-2 text-fg-secondary",
                    )}
                  >
                    <RadioGroupItem value="routine" id="live-urgency-routine" />
                    <span>Routine</span>
                  </label>
                  <label
                    htmlFor="live-urgency-urgent"
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-[13px] transition-colors",
                      urgency === "urgent"
                        ? "border-danger-fill bg-danger-bg font-semibold text-danger-text"
                        : "border-border bg-surface-2 text-fg-secondary",
                    )}
                  >
                    <RadioGroupItem value="urgent" id="live-urgency-urgent" />
                    <span>Urgent (STAT)</span>
                  </label>
                </RadioGroup>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[12px] font-medium text-fg-secondary">Estimated test total</Label>
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

            <div className="grid shrink-0 gap-1.5">
              <Label htmlFor="live-lab-notes" className="text-[12px] font-medium text-fg-secondary">
                Clinical indication & notes for technician
              </Label>
              <Textarea
                id="live-lab-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Specify clinical history, suspected pathology, or test priority…"
                rows={2}
                className="bg-surface-1/60 text-[13px]"
              />
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || selected.length === 0} className="gap-2" onClick={() => void dispatch()}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Dispatch order ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PanelRow({
  panel,
  expanded,
  selection,
  pending,
  selected,
  onToggleExpand,
  onTogglePanel,
  onToggleMember,
}: {
  panel: LabPanel;
  expanded: boolean;
  selection: PanelSelection;
  pending: Set<string>;
  selected: Set<string>;
  onToggleExpand: () => void;
  onTogglePanel: (checked: boolean | "indeterminate") => void;
  onToggleMember: (memberId: string, checked: boolean) => void;
}) {
  const allPending = panel.members.every((member) => pending.has(member.id));
  const pickedCount = panel.members.filter((member) => selected.has(member.id)).length;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        selection !== "none" ? "border-foreground/30 bg-surface-1 shadow-sm" : "border-border/70 bg-surface-2",
        allPending && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-1 hover:text-foreground"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${panel.name}` : `Expand ${panel.name}`}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <Checkbox
          checked={selection === "partial" ? "indeterminate" : selection === "full"}
          disabled={allPending}
          onCheckedChange={onTogglePanel}
        />

        <button type="button" onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 shrink-0 text-clinical-fill" aria-hidden="true" />
            <span className="truncate text-[14px] font-medium text-foreground">{panel.name}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {panel.members.length} tests
            {pickedCount > 0 ? ` · ${pickedCount} selected` : ""}
            {allPending ? " · Already pending in lab" : ""}
          </p>
        </button>

        <span className="shrink-0 font-mono text-[13px] font-medium tabular-nums text-fg-secondary">
          {formatMoney(Number(panel.price))}
        </span>
      </div>

      {expanded ? (
        <div className="space-y-1 border-t border-border/60 bg-surface-1/50 px-2 py-2 pl-11">
          {panel.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              pending={pending.has(member.id)}
              checked={pending.has(member.id) || selected.has(member.id)}
              onCheckedChange={(value) => onToggleMember(member.id, value === true)}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function MemberRow({
  member,
  pending,
  checked,
  onCheckedChange,
}: {
  member: PanelMember;
  pending: boolean;
  checked: boolean;
  onCheckedChange: (value: boolean | "indeterminate") => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-md border px-2.5 py-2 transition-colors",
        pending
          ? "cursor-not-allowed border-border/40 bg-surface-1/40 opacity-60"
          : checked
            ? "border-foreground/20 bg-surface-1"
            : "border-border/50 bg-surface-2/80 hover:border-border-strong",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Checkbox checked={checked} disabled={pending} onCheckedChange={onCheckedChange} />
        <div className="min-w-0">
          <span className="block truncate text-[13px] text-foreground">{member.name}</span>
          {pending ? (
            <span className="text-[11px] font-medium text-warning-text">Already pending in lab</span>
          ) : (
            <span className="text-[11px] capitalize text-fg-muted">{member.item_type.replace("_", " ")}</span>
          )}
        </div>
      </div>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-muted">{formatMoney(Number(member.price))}</span>
    </label>
  );
}

function TestRow({
  name,
  subtitle,
  subtitleWarning,
  price,
  checked,
  disabled,
  onCheckedChange,
}: {
  name: string;
  subtitle: string;
  subtitleWarning?: boolean;
  price: number;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (value: boolean | "indeterminate") => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors",
        disabled
          ? "cursor-not-allowed border-border/50 bg-surface-1/60 opacity-60"
          : checked
            ? "border-foreground/30 bg-surface-1 shadow-sm"
            : "border-border/70 bg-surface-2 hover:border-border-strong",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
        <div className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-foreground">{name}</span>
          <span className={cn("text-[11px] capitalize", subtitleWarning ? "font-medium text-warning-text" : "text-fg-muted")}>
            {subtitle}
          </span>
        </div>
      </div>
      <span className="shrink-0 font-mono text-[13px] font-medium tabular-nums text-fg-secondary">{formatMoney(price)}</span>
    </label>
  );
}
