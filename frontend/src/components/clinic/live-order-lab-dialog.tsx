"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  FlaskConical,
  Lightbulb,
  Loader2,
  Minus,
  Package,
  ScanLine,
  Search,
  Send,
  Star,
  TestTube,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDiscardGuard } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { createDiagnosticOrder, type CatalogItem, type LabPanel } from "@/lib/api/clinical";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type Tab = "lab" | "imaging";
type Test = { id: string; name: string; price: number; imaging: boolean };
type BasketRow = { kind: "panel" | "test"; id: string; name: string; price: number; testCount?: number };
type PackageTip = { panel: LabPanel; pickedCount: number; pickedTotal: number };

const QUICK_NOTES = ["Fasting sample", "On antibiotics", "Pregnant", "Repeat test", "Call me with results"];
const USUAL_LIMIT = 8;

/**
 * Doctor-facing lab order: tap tests to add them to a running order on the right,
 * like a shopping list. Designed for quick, low-typing use in a busy clinic.
 */
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
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("lab");
  const [selected, setSelected] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<"routine" | "urgent">("routine");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [usualIds, setUsualIds] = useState<string[]>([]);

  const pending = pendingCatalogItemIds;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Every orderable single test: catalog tests plus tests that only exist inside packages.
  const tests = useMemo(() => {
    const byId = new Map<string, Test>();
    for (const item of catalog) {
      if (!item.active || (item.item_type !== "lab_test" && item.item_type !== "radiology")) continue;
      byId.set(item.id, { id: item.id, name: item.name, price: Number(item.price), imaging: item.item_type === "radiology" });
    }
    for (const panel of panels) {
      for (const member of panel.members) {
        if (!byId.has(member.id)) {
          byId.set(member.id, { id: member.id, name: member.name, price: Number(member.price), imaging: member.item_type === "radiology" });
        }
      }
    }
    return byId;
  }, [catalog, panels]);

  const inPackage = useMemo(() => new Set(panels.flatMap((panel) => panel.members.map((member) => member.id))), [panels]);
  const labTests = useMemo(() => [...tests.values()].filter((test) => !test.imaging && !inPackage.has(test.id)).sort(byName), [tests, inPackage]);
  const imagingTests = useMemo(() => [...tests.values()].filter((test) => test.imaging && !inPackage.has(test.id)).sort(byName), [tests, inPackage]);
  const panelById = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels]);

  // ---------- selection ----------
  function orderableMembers(panel: LabPanel) {
    return panel.members.filter((member) => !pending.has(member.id));
  }

  function panelState(panel: LabPanel): "none" | "some" | "all" | "pending" {
    const orderable = orderableMembers(panel);
    if (orderable.length === 0) return "pending";
    const picked = orderable.filter((member) => selectedSet.has(member.id)).length;
    return picked === 0 ? "none" : picked === orderable.length ? "all" : "some";
  }

  function togglePanel(panel: LabPanel) {
    const state = panelState(panel);
    if (state === "pending") return;
    setSelected((current) => {
      const next = new Set(current);
      if (state === "all") panel.members.forEach((member) => next.delete(member.id));
      else orderableMembers(panel).forEach((member) => next.add(member.id));
      return [...next];
    });
  }

  function toggleTest(id: string) {
    if (pending.has(id)) return;
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function toggleUsual(id: string) {
    const panel = panelById.get(id);
    if (panel) togglePanel(panel);
    else toggleTest(id);
  }

  // ---------- the order ("basket") ----------
  const { rows, tips, dispatchIds } = useMemo(() => {
    const basket: BasketRow[] = [];
    const packageTips: PackageTip[] = [];
    const ids: string[] = [];
    const consumed = new Set<string>();

    for (const panel of panels) {
      const orderable = panel.members.filter((member) => !pending.has(member.id));
      const picked = orderable.filter((member) => selectedSet.has(member.id));
      if (!picked.length) continue;
      const whole = orderable.length === panel.members.length && picked.length === orderable.length;
      if (whole) {
        basket.push({ kind: "panel", id: panel.id, name: panel.name, price: Number(panel.price), testCount: panel.members.length });
        ids.push(panel.id);
        panel.members.forEach((member) => consumed.add(member.id));
      } else if (orderable.length === panel.members.length) {
        const pickedTotal = picked.reduce((sum, member) => sum + Number(member.price), 0);
        // Suggest the package only when it is no more expensive than the tests already picked.
        if (picked.length >= 2 && Number(panel.price) <= pickedTotal) {
          packageTips.push({ panel, pickedCount: picked.length, pickedTotal });
        }
      }
    }

    for (const id of selected) {
      if (consumed.has(id)) continue;
      const test = tests.get(id);
      if (!test) continue;
      basket.push({ kind: "test", id, name: test.name, price: test.price });
      ids.push(id);
      consumed.add(id);
    }

    return { rows: basket, tips: packageTips, dispatchIds: [...new Set(ids)] };
  }, [panels, pending, selected, selectedSet, tests]);

  const total = rows.reduce((sum, row) => sum + row.price, 0);
  const testCount = rows.reduce((sum, row) => sum + (row.testCount ?? 1), 0);

  function removeRow(row: BasketRow) {
    if (row.kind === "panel") {
      const panel = panelById.get(row.id);
      if (panel) setSelected((current) => current.filter((id) => !panel.members.some((member) => member.id === id)));
    } else {
      setSelected((current) => current.filter((id) => id !== row.id));
    }
  }

  function toggleNote(phrase: string) {
    setNotes((current) => {
      const parts = current.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
      const next = parts.includes(phrase) ? parts.filter((part) => part !== phrase) : [...parts, phrase];
      return next.join("; ");
    });
  }

  // ---------- open / close ----------
  function reset() {
    setSelected([]);
    setUrgency("routine");
    setNotes("");
    setSearch("");
    setTab("lab");
  }

  const guard = useDiscardGuard((selected.length > 0 || notes.trim() !== "") && !submitting, () => {
    setOpen(false);
    reset();
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setUsualIds(readUsual(user?.id));
      setOpen(true);
    } else {
      guard.requestClose();
    }
  }

  async function send() {
    if (!dispatchIds.length) return;
    setSubmitting(true);
    try {
      await createDiagnosticOrder({ encounterId, catalogItemIds: dispatchIds, urgency, clinicalNotes: notes.trim() || undefined });
      rememberUsual(user?.id, dispatchIds);
      toast.success(`${testCount} ${testCount === 1 ? "test" : "tests"} sent to the lab`, {
        description: urgency === "urgent" ? "Marked urgent — the lab will do these first." : "Results will appear here when they are ready.",
      });
      reset();
      setOpen(false);
      await onOrdered();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "The order could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- what to show on the left ----------
  const query = search.trim().toLowerCase();
  const searchPanels = query
    ? panels.filter((panel) => panel.name.toLowerCase().includes(query) || panel.members.some((member) => member.name.toLowerCase().includes(query)))
    : [];
  const searchTests = query ? [...labTests, ...imagingTests].filter((test) => test.name.toLowerCase().includes(query)).sort(byName) : [];

  const usual = usualIds
    .map((id) => {
      const panel = panelById.get(id);
      if (panel) return { id, name: panel.name, isPanel: true, active: panelState(panel) === "all", blocked: panelState(panel) === "pending" };
      const test = tests.get(id);
      if (test) return { id, name: test.name, isPanel: false, active: selectedSet.has(id), blocked: pending.has(id) };
      return null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, USUAL_LIMIT);

  const tabs: Array<{ id: Tab; label: string; icon: LucideIcon; count: number }> = [
    { id: "lab" as const, label: "Lab tests", icon: TestTube, count: panels.length + labTests.length },
    { id: "imaging" as const, label: "Imaging", icon: ScanLine, count: imagingTests.length },
  ].filter((entry) => entry.count > 0);
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : tabs[0]?.id ?? "lab";
  const hasCatalog = tests.size > 0 || panels.length > 0;

  /** Enter in the search box: add the first single test, else the first matching test inside a package, else the package. */
  function pickFirstResult() {
    const test = searchTests.find((entry) => !pending.has(entry.id));
    const member = searchPanels.flatMap((panel) => panel.members).find((entry) => entry.name.toLowerCase().includes(query) && !pending.has(entry.id));
    const panel = searchPanels.find((entry) => entry.name.toLowerCase().includes(query) && panelState(entry) !== "pending");
    if (test) toggleTest(test.id);
    else if (member) toggleTest(member.id);
    else if (panel) togglePanel(panel);
    setSearch("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" disabled={disabled}>
            <FlaskConical className="size-3.5" aria-hidden="true" />
            Order lab / imaging
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-[min(780px,94vh)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/70 px-6 py-4 pr-14">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <FlaskConical className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-heading text-lg">Order lab tests</DialogTitle>
            <DialogDescription className="text-[13px]">Tick the tests you need. Open a package to choose tests inside it.</DialogDescription>
          </div>
        </div>

        {!hasCatalog ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <FlaskConical className="size-8 text-fg-muted" aria-hidden="true" />
            <p className="font-medium">No lab tests are set up yet</p>
            <p className="max-w-sm text-sm text-fg-muted">Ask the clinic administrator to add tests and prices in the catalog.</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
            {/* ---------- Left: find tests ---------- */}
            <div className="flex min-h-0 flex-col bg-muted/30 lg:overflow-hidden">
              <div className="space-y-3 px-6 pt-5 pb-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && query) {
                        event.preventDefault();
                        pickFirstResult();
                      }
                    }}
                    placeholder="Search a test — e.g. malaria, blood sugar, x-ray"
                    aria-label="Search lab tests"
                    className="h-10 bg-background pr-9 pl-9 text-[14px]"
                  />
                  {search ? (
                    <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:text-foreground" aria-label="Clear search">
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {!query && usual.length ? (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-fg-secondary uppercase">
                      <Star className="size-3.5 text-warning-fill" aria-hidden="true" />
                      Your usual tests
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {usual.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          disabled={entry.blocked}
                          aria-pressed={entry.active}
                          onClick={() => toggleUsual(entry.id)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            entry.active
                              ? "border-primary bg-primary text-primary-foreground shadow-xs"
                              : "border-border bg-background text-foreground hover:border-primary/50",
                          )}
                        >
                          {entry.active ? <Check className="size-3.5" aria-hidden="true" /> : entry.isPanel ? <Package className="size-3.5 text-fg-muted" aria-hidden="true" /> : null}
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!query && tabs.length > 1 ? (
                  <div role="tablist" aria-label="Test type" className="flex gap-1 rounded-lg bg-background p-1 shadow-xs">
                    {tabs.map(({ id, label, icon: Icon, count }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === id}
                        onClick={() => setTab(id)}
                        className={cn(
                          "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors",
                          activeTab === id ? "bg-primary/12 text-primary" : "text-fg-secondary hover:bg-surface-1 hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        {label}
                        <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-fg-muted">{count}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 px-6 pb-6 lg:overflow-y-auto">
                {query ? (
                  searchPanels.length || searchTests.length ? (
                    <div className="space-y-3">
                      <TestList>
                        {searchPanels.map((panel) => (
                          <PackageRow key={`search-${panel.id}`} panel={panel} state={panelState(panel)} selected={selectedSet} pending={pending} highlight={query} onTogglePanel={() => togglePanel(panel)} onToggleTest={toggleTest} />
                        ))}
                        {searchTests.map((test) => (
                          <TestRow key={test.id} test={test} selected={selectedSet.has(test.id)} pending={pending.has(test.id)} onToggle={() => toggleTest(test.id)} />
                        ))}
                      </TestList>
                      <p className="text-center text-xs text-fg-muted">Tip: press Enter to add the first match.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-10 text-center">
                      <Search className="size-6 text-fg-muted" aria-hidden="true" />
                      <p className="text-sm font-medium">No test called “{search.trim()}”</p>
                      <p className="text-xs text-fg-muted">Try a shorter word, e.g. “sugar” instead of “blood sugar test”.</p>
                    </div>
                  )
                ) : activeTab === "imaging" ? (
                  <TestList>
                    {imagingTests.map((test) => (
                      <TestRow key={test.id} test={test} selected={selectedSet.has(test.id)} pending={pending.has(test.id)} onToggle={() => toggleTest(test.id)} />
                    ))}
                  </TestList>
                ) : (
                  <TestList>
                    {panels.map((panel) => (
                      <PackageRow key={panel.id} panel={panel} state={panelState(panel)} selected={selectedSet} pending={pending} onTogglePanel={() => togglePanel(panel)} onToggleTest={toggleTest} />
                    ))}
                    {labTests.map((test) => (
                      <TestRow key={test.id} test={test} selected={selectedSet.has(test.id)} pending={pending.has(test.id)} onToggle={() => toggleTest(test.id)} />
                    ))}
                  </TestList>
                )}
              </div>
            </div>

            {/* ---------- Right: this order ---------- */}
            <aside className="flex min-h-0 flex-col border-t border-border/70 bg-background lg:border-t-0 lg:border-l" aria-label="This order">
              <div className="min-h-0 flex-1 space-y-4 px-5 py-5 lg:overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">This order</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-fg-secondary tabular-nums">
                    {testCount} {testCount === 1 ? "test" : "tests"}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-primary">
                      <TestTube className="size-5" aria-hidden="true" />
                    </span>
                    <p className="text-[13px] font-medium">Nothing added yet</p>
                    <p className="text-xs text-fg-muted">Tap tests on the left to add them here.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                    {rows.map((row) => (
                      <li key={`${row.kind}-${row.id}`} className="flex items-center gap-2.5 px-3 py-2">
                        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", row.kind === "panel" ? "bg-clinical-fill/10 text-clinical-fill" : "bg-primary/10 text-primary")}>
                          {row.kind === "panel" ? <Package className="size-3.5" aria-hidden="true" /> : <TestTube className="size-3.5" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium" title={row.name}>{row.name}</span>
                          {row.testCount ? <span className="block text-[11px] text-fg-muted">Package · {row.testCount} tests</span> : null}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-secondary">{formatMoney(row.price)}</span>
                        <button type="button" onClick={() => removeRow(row)} className="shrink-0 rounded p-1 text-fg-muted transition-colors hover:bg-danger-fill/10 hover:text-danger-text" aria-label={`Remove ${row.name}`}>
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {tips.map((tip) => (
                  <div key={tip.panel.id} className="rounded-xl border border-warning-fill/40 bg-warning-bg/50 p-3 text-[12px]">
                    <p className="flex items-start gap-1.5 font-medium text-warning-text">
                      <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        The <strong>{tip.panel.name}</strong> package has all {tip.panel.members.length} tests for {formatMoney(Number(tip.panel.price))}
                        {Number(tip.panel.price) < tip.pickedTotal
                          ? ` — ${formatMoney(tip.pickedTotal - Number(tip.panel.price))} less than the ${tip.pickedCount} you picked.`
                          : ` — the same price as the ${tip.pickedCount} you picked.`}
                      </span>
                    </p>
                    <Button type="button" size="sm" variant="outline" className="mt-2 h-7 w-full bg-background text-xs" onClick={() => togglePanel(tip.panel)}>
                      Switch to the package
                    </Button>
                  </div>
                ))}

                <SegmentedControl
                  id="lab-urgency"
                  label="How soon?"
                  value={urgency}
                  onChange={setUrgency}
                  options={[
                    { value: "routine", label: "Routine" },
                    { value: "urgent", label: "Urgent", tone: "danger" },
                  ]}
                />
                <p className="-mt-2 text-[11px] text-fg-muted">
                  {urgency === "urgent" ? "The lab will do these before routine tests." : "Done in the order they arrive."}
                </p>

                <div className="grid gap-1.5">
                  <label htmlFor="lab-notes" className="text-[13px] font-medium">Note for the lab <span className="font-normal text-fg-muted">(optional)</span></label>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_NOTES.map((phrase) => {
                      const active = notes.split(/;\s*/).includes(phrase);
                      return (
                        <button
                          key={phrase}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleNote(phrase)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                            active ? "border-primary bg-primary/10 text-primary" : "border-border text-fg-secondary hover:border-primary/40",
                          )}
                        >
                          {active ? "✓ " : "+ "}
                          {phrase}
                        </button>
                      );
                    })}
                  </div>
                  <Textarea
                    id="lab-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="e.g. Fever for 3 days, suspect malaria"
                    rows={2}
                    className="text-[13px]"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border/70 bg-background px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-fg-secondary">Estimated cost</span>
                  <span className="font-mono text-xl font-bold tabular-nums">{formatMoney(total)}</span>
                </div>
                <Button type="button" className="h-10 w-full gap-2" disabled={submitting || rows.length === 0} onClick={() => void send()}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                  {submitting
                    ? "Sending…"
                    : rows.length === 0
                      ? "Add tests to send"
                      : `Send ${testCount} ${testCount === 1 ? "test" : "tests"} to lab`}
                </Button>
                <Button type="button" variant="ghost" className="w-full" disabled={submitting} onClick={guard.requestClose}>
                  Cancel
                </Button>
              </div>
            </aside>
          </div>
        )}
        {guard.prompt}
      </DialogContent>
    </Dialog>
  );
}

function TestList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background">{children}</div>;
}

/** Visual tri-state box: ticked, partly ticked (−), or empty. */
function TickBox({ state, disabled = false }: { state: "on" | "some" | "off"; disabled?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        state === "off" ? "border-border bg-background" : "border-primary bg-primary text-primary-foreground",
        disabled && "opacity-50",
      )}
      aria-hidden="true"
    >
      {state === "on" ? <Check className="size-3" strokeWidth={3} /> : state === "some" ? <Minus className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function TestRow({
  test,
  selected,
  pending,
  indent = false,
  highlight = false,
  onToggle,
}: {
  test: { id: string; name: string; price: number };
  selected: boolean;
  pending: boolean;
  indent?: boolean;
  highlight?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected || pending}
      disabled={pending}
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 py-2.5 pr-4 text-left transition-colors focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed",
        indent ? "pl-12" : "pl-4",
        selected ? "bg-primary/5" : "hover:bg-accent/60",
        highlight && !selected && "bg-warning-bg/40",
      )}
    >
      <TickBox state={selected || pending ? "on" : "off"} disabled={pending} />
      <span className={cn("min-w-0 flex-1 truncate text-[13px]", pending ? "text-fg-muted" : "text-foreground", !indent && "font-medium")}>{test.name}</span>
      {pending ? (
        <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-text">Already sent today</span>
      ) : (
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-muted">{formatMoney(test.price)}</span>
      )}
    </button>
  );
}

function PackageRow({
  panel,
  state,
  selected,
  pending,
  highlight,
  onTogglePanel,
  onToggleTest,
}: {
  panel: LabPanel;
  state: "none" | "some" | "all" | "pending";
  selected: Set<string>;
  pending: Set<string>;
  highlight?: string;
  onTogglePanel: () => void;
  onToggleTest: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(Boolean(highlight));
  const pickedCount = panel.members.filter((member) => selected.has(member.id)).length;
  const sentCount = panel.members.filter((member) => pending.has(member.id)).length;
  const remaining = panel.members.length - sentCount;

  const subtitle =
    state === "pending"
      ? "All tests already sent today"
      : sentCount > 0
        ? state === "all"
          ? `${remaining} remaining tests chosen · ${sentCount} already sent today`
          : `${panel.members.length} tests · ${sentCount} already sent today`
        : state === "some"
          ? `${pickedCount} of ${panel.members.length} tests chosen`
          : `${panel.members.length} tests`;

  return (
    <div className={cn(state === "all" && "bg-primary/5")}>
      <div className="flex items-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={state === "all" || state === "pending" ? true : state === "some" ? "mixed" : false}
          aria-label={`Select all tests in ${panel.name}`}
          disabled={state === "pending"}
          onClick={onTogglePanel}
          className="flex self-stretch items-center py-3 pr-2 pl-4 focus-visible:outline-none disabled:cursor-not-allowed"
        >
          <TickBox state={state === "all" || state === "pending" ? "on" : state === "some" ? "some" : "off"} disabled={state === "pending"} />
        </button>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-4 pl-1 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
        >
          <ChevronRight className={cn("size-4 shrink-0 text-fg-muted transition-transform", expanded && "rotate-90")} aria-hidden="true" />
          <Package className="size-4 shrink-0 text-clinical-fill" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-foreground">{panel.name}</span>
            <span className={cn("block text-[11px]", state === "some" || state === "all" ? "text-primary" : "text-fg-muted")}>{subtitle}</span>
          </span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-secondary">{formatMoney(Number(panel.price))}</span>
        </button>
      </div>
      {expanded ? (
        <div className="border-t border-border/50 bg-muted/20">
          {panel.members.map((member) => (
            <TestRow
              key={member.id}
              indent
              test={{ id: member.id, name: member.name, price: Number(member.price) }}
              selected={selected.has(member.id)}
              pending={pending.has(member.id)}
              highlight={highlight ? member.name.toLowerCase().includes(highlight) : false}
              onToggle={() => onToggleTest(member.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name);
}

// "Your usual tests" is a per-doctor convenience kept in this browser only.
function usualKey(userId: string | undefined) {
  return `mahir:usual-labs:${userId ?? "anon"}`;
}

function readUsual(userId: string | undefined): string[] {
  try {
    const counts = JSON.parse(window.localStorage.getItem(usualKey(userId)) ?? "{}") as Record<string, number>;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  } catch {
    return [];
  }
}

function rememberUsual(userId: string | undefined, ids: string[]) {
  try {
    const key = usualKey(userId);
    const counts = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, number>;
    for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
    window.localStorage.setItem(key, JSON.stringify(counts));
  } catch {
    /* storage unavailable — the list simply stays empty */
  }
}
