"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Lock,
  MessageSquarePlus,
  Printer,
  Send,
  TestTube,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import type { DiagnosticItem } from "@/lib/api/clinical";
import {
  enterDiagnosticResult,
  getDiagnosticOrder,
  startDiagnosticOrder,
  verifyDiagnosticResult,
  type WorklistDiagnosticOrder,
} from "@/lib/api/diagnostics";
import {
  describeRange,
  evaluateNumber,
  parseNumber,
  parseResultSetup,
  type ResultFlag,
  type ResultSetup,
} from "@/lib/lab-result-setup";
import { cn } from "@/lib/utils";

const QUICK_NOTES = ["Haemolysed sample", "Repeat needed", "Not enough sample", "Lipaemic sample"];
const ENTERED = new Set(["result_ready", "verified", "reviewed"]);
const LOCKED = new Set(["verified", "reviewed"]);

type SavePayload = { value: string; flag: ResultFlag; notes: string };

/** Lab worksheet: take sample → enter results (auto-saved) → check & send to doctor. */
export default function LabOrderPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [order, setOrder] = useState<WorklistDiagnosticOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOrder((await getDiagnosticOrder(requestId)).item);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "This lab request could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => (order?.items ?? []).filter((item) => item.status !== "cancelled"), [order]);
  const entered = items.filter((item) => ENTERED.has(item.status)).length;
  const verified = items.filter((item) => LOCKED.has(item.status)).length;
  const done = items.length > 0 && verified === items.length;
  const notStarted = order?.status === "requested";
  const step = notStarted ? 1 : done ? 4 : entered === items.length ? 3 : 2;

  async function start() {
    if (!order) return;
    setStarting(true);
    setError("");
    try {
      setOrder((await startDiagnosticOrder(order.id)).item);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not start this request. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const saveItem = useCallback(async (item: DiagnosticItem, setup: ResultSetup | null, payload: SavePayload) => {
    const response = await enterDiagnosticResult(item.id, {
      resultValue: payload.value,
      resultUnit: setup?.type === "number" ? setup.unit : undefined,
      resultFlag: payload.flag,
      referenceRange: referenceText(setup),
      notes: payload.notes.trim() || undefined,
    });
    setOrder(response.item);
  }, []);

  if (loading) return <PageSkeleton />;
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-5 text-sm text-danger-text">
          <p className="font-medium">Lab request unavailable</p>
          <p className="mt-1">{error || "This request was not found."}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void load()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <BackLink />

      {/* Who and why */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{order.patient_name}</h1>
          {order.urgency === "urgent" ? (
            <span className="rounded-full bg-danger-fill px-2.5 py-0.5 text-xs font-semibold text-white">Urgent — do first</span>
          ) : null}
        </div>
        <p className="text-sm text-fg-secondary">
          {order.visit_number} · {items.length} {items.length === 1 ? "test" : "tests"} · Ordered {formatTime(order.ordered_at)}
        </p>
        {order.clinical_notes ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-[13px]">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>
              <span className="font-semibold text-foreground">Doctor&apos;s note: </span>
              <span className="text-fg-secondary">{order.clinical_notes}</span>
            </p>
          </div>
        ) : null}
      </header>

      <Steps step={step} />

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div>
      ) : null}

      {notStarted ? (
        <section className="rounded-2xl border border-border bg-surface-2 p-6 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <TestTube className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-3 font-heading text-lg font-semibold">Take the sample</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-secondary">Collect the sample for these tests, then start. The results sheet opens straight away.</p>
          <ul className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-1.5">
            {items.map((item) => (
              <li key={item.id} className="rounded-full border border-border bg-background px-3 py-1 text-[13px]">{item.item_name}</li>
            ))}
          </ul>
          <Button type="button" className="mt-5 h-10 gap-2 px-6" disabled={starting} onClick={() => void start()}>
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            {starting ? "Starting…" : "Sample taken — start"}
          </Button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface-2" aria-label="Results">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <h2 className="text-sm font-semibold">Results</h2>
            <p className="text-xs text-fg-muted">Saved automatically · Enter moves to the next test</p>
          </div>
          <ol className="divide-y divide-border/60">
            {items.map((item, index) => (
              <ResultRow key={item.id} item={item} index={index} onSave={saveItem} />
            ))}
          </ol>
        </section>
      )}

      {done ? (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-xl border border-success-fill/30 bg-success-fill/10 p-4 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{order.status === "reviewed" ? "The doctor has seen these results" : "Results sent to the doctor"}</p>
            <p className="mt-0.5">The patient is back in the doctor&apos;s queue.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-background" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print results
          </Button>
        </div>
      ) : null}

      {/* Sticky action bar */}
      {!notStarted && !done ? (
        <div className="sticky bottom-0 z-10 -mx-6 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{entered} of {items.length} results entered</p>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${items.length ? (entered / items.length) * 100 : 0}%` }} />
              </div>
            </div>
            <Button type="button" className="h-10 gap-2" disabled={entered < items.length} onClick={() => setReviewOpen(true)}>
              <Send className="size-4" aria-hidden="true" />
              {entered < items.length ? `Enter ${items.length - entered} more to send` : "Check & send to doctor"}
            </Button>
          </div>
        </div>
      ) : null}

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} order={order} items={items} onChanged={setOrder} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One test row
// ---------------------------------------------------------------------------

function ResultRow({
  item,
  index,
  onSave,
}: {
  item: DiagnosticItem;
  index: number;
  onSave: (item: DiagnosticItem, setup: ResultSetup | null, payload: SavePayload) => Promise<void>;
}) {
  const setup = useMemo(() => parseResultSetup(item.result_setup), [item.result_setup]);
  const locked = LOCKED.has(item.status);
  const saved = item.result;

  const [value, setValue] = useState(saved?.result_value ?? "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(saved?.notes));
  const [manualFlag, setManualFlag] = useState<ResultFlag | null>(() => initialManualFlag(setup, saved?.result_value ?? "", saved?.result_flag ?? null));
  const [changingFlag, setChangingFlag] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(saved ? "saved" : "idle");
  const [error, setError] = useState("");
  const lastSaved = useRef(saved ? JSON.stringify({ v: saved.result_value, f: saved.result_flag, n: saved.notes ?? "" }) : "");

  const numberSetup = setup?.type === "number" ? setup : null;
  const numeric = numberSetup ? parseNumber(value) : null;
  const hasRange = Boolean(numberSetup && (numberSetup.low !== undefined || numberSetup.high !== undefined || numberSetup.criticalLow !== undefined || numberSetup.criticalHigh !== undefined));
  const auto = numberSetup && numeric !== null && hasRange ? evaluateNumber(numeric, numberSetup) : null;
  const choiceFlag = setup?.type === "choice" ? setup.choices.find((choice) => choice.label === value)?.flag ?? null : null;
  const flag: ResultFlag = choiceFlag ?? manualFlag ?? auto?.flag ?? "normal";

  const persist = useCallback(async (next: { value: string; flag: ResultFlag; notes: string }) => {
    const text = next.value.trim();
    if (!text || locked) return;
    const key = JSON.stringify({ v: text, f: next.flag, n: next.notes.trim() });
    if (key === lastSaved.current) return;
    setState("saving");
    setError("");
    try {
      await onSave(item, setup, { value: text, flag: next.flag, notes: next.notes });
      lastSaved.current = key;
      setState("saved");
    } catch (caught) {
      setState("error");
      setError(caught instanceof ApiError ? caught.message : "Not saved — check the connection and try again.");
    }
  }, [item, locked, onSave, setup]);

  function focusNext() {
    const next = document.querySelector<HTMLElement>(`[data-entry="${index + 1}"]`);
    next?.focus();
  }

  const flagFor = (nextValue: string, nextManual: ResultFlag | null): ResultFlag => {
    if (setup?.type === "choice") return setup.choices.find((choice) => choice.label === nextValue)?.flag ?? "normal";
    const n = numberSetup ? parseNumber(nextValue) : null;
    const nextAuto = numberSetup && n !== null && hasRange ? evaluateNumber(n, numberSetup).flag : null;
    return nextManual ?? nextAuto ?? "normal";
  };

  const numberInvalid = numberSetup !== null && value.trim() !== "" && numeric === null;

  return (
    <li className={cn("px-5 py-4", flag === "critical" && value && "bg-danger-fill/5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{item.item_name}</p>
          {numberSetup && describeRange(numberSetup) ? (
            <p className="text-xs text-fg-muted">Normal: {describeRange(numberSetup)}</p>
          ) : null}
        </div>
        <RowStatus state={state} locked={locked} />
      </div>

      <div className="mt-3">
        {locked ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-lg font-semibold">{saved?.result_value}</span>
            {saved?.result_unit ? <span className="text-sm text-fg-muted">{saved.result_unit}</span> : null}
            <FlagChip flag={(saved?.result_flag as ResultFlag | null) ?? "normal"} />
            {saved?.notes ? <span className="text-xs text-fg-muted">· {saved.notes}</span> : null}
          </div>
        ) : setup?.type === "choice" ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${item.item_name} result`}>
            {setup.choices.map((choice, choiceIndex) => {
              const active = value === choice.label;
              return (
                <button
                  key={choice.label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-entry={choiceIndex === 0 ? index : undefined}
                  onClick={() => {
                    setValue(choice.label);
                    void persist({ value: choice.label, flag: choice.flag, notes });
                    focusNext();
                  }}
                  className={cn(
                    "h-10 min-w-24 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !active && "border-border bg-background text-foreground hover:border-primary/50",
                    active && choice.flag === "normal" && "border-success-fill bg-success-fill text-white",
                    active && choice.flag === "abnormal" && "border-warning-fill bg-warning-fill text-white",
                    active && choice.flag === "critical" && "border-danger-fill bg-danger-fill text-white",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn("relative", numberSetup ? "w-44" : "w-full")}>
                <Input
                  data-entry={index}
                  aria-label={`${item.item_name} result`}
                  aria-invalid={numberInvalid || undefined}
                  inputMode={numberSetup ? "decimal" : undefined}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onBlur={() => void persist({ value, flag: flagFor(value, manualFlag), notes })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void persist({ value, flag: flagFor(value, manualFlag), notes });
                      focusNext();
                    }
                  }}
                  placeholder={numberSetup ? "0.0" : "Type the result"}
                  className={cn("h-10 bg-background text-[15px]", numberSetup && "pr-16 font-mono font-semibold tabular-nums")}
                />
                {numberSetup?.unit ? (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-fg-muted">{numberSetup.unit}</span>
                ) : null}
              </div>
              {auto ? <FlagChip flag={auto.flag} direction={auto.direction} /> : null}
            </div>
            {numberInvalid ? <p className="text-xs text-danger-text">Enter a number, e.g. 5.4</p> : null}
            {numberSetup && numeric !== null ? <RangeBar value={numeric} setup={numberSetup} /> : null}

            {/* Flag: automatic when there is a range, otherwise chosen by the tech */}
            {auto && !changingFlag && manualFlag === null ? (
              <button type="button" onClick={() => setChangingFlag(true)} className="text-xs font-medium text-fg-muted underline-offset-2 hover:text-foreground hover:underline">
                Change flag
              </button>
            ) : (
              <FlagPicker
                value={flag}
                onChange={(next) => {
                  setManualFlag(next);
                  void persist({ value, flag: next, notes });
                }}
                onAuto={auto ? () => {
                  setManualFlag(null);
                  setChangingFlag(false);
                  void persist({ value, flag: auto.flag, notes });
                } : undefined}
              />
            )}
          </div>
        )}
      </div>

      {!locked && flag === "critical" && value.trim() ? (
        <p role="alert" className="mt-3 flex items-center gap-2 rounded-lg bg-danger-fill px-3 py-2 text-sm font-semibold text-white">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          Critical result — tell the doctor now.
        </p>
      ) : null}

      {!locked ? (
        noteOpen ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {QUICK_NOTES.map((phrase) => {
                const active = notes.split(/;\s*/).includes(phrase);
                return (
                  <button
                    key={phrase}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const parts = notes.split(/;\s*/).map((part) => part.trim()).filter(Boolean);
                      const next = (active ? parts.filter((part) => part !== phrase) : [...parts, phrase]).join("; ");
                      setNotes(next);
                      void persist({ value, flag, notes: next });
                    }}
                    className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", active ? "border-primary bg-primary/10 text-primary" : "border-border text-fg-secondary hover:border-primary/40")}
                  >
                    {active ? "✓ " : "+ "}
                    {phrase}
                  </button>
                );
              })}
            </div>
            <Input
              aria-label={`Note for ${item.item_name}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => void persist({ value, flag, notes })}
              placeholder="Note for the doctor (optional)"
              className="text-[13px]"
            />
          </div>
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-foreground">
            <MessageSquarePlus className="size-3.5" aria-hidden="true" />
            Add a note
          </button>
        )
      ) : null}

      {error ? <p role="alert" className="mt-2 text-xs font-medium text-danger-text">{error}</p> : null}
    </li>
  );
}

function RowStatus({ state, locked }: { state: "idle" | "saving" | "saved" | "error"; locked: boolean }) {
  if (locked) return <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text"><Lock className="size-3.5" aria-hidden="true" />Sent</span>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-fg-muted"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Saving…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text"><Check className="size-3.5" aria-hidden="true" />Saved</span>;
  if (state === "error") return <span className="text-xs font-medium text-danger-text">Not saved</span>;
  return <span className="text-xs text-fg-muted">Waiting</span>;
}

function FlagChip({ flag, direction = null }: { flag: ResultFlag; direction?: "low" | "high" | null }) {
  const Icon = direction === "low" ? ArrowDown : direction === "high" ? ArrowUp : flag === "normal" ? Check : AlertTriangle;
  const label = flag === "normal" ? "Normal" : flag === "critical" ? `Critical${direction ? ` ${direction}` : ""}` : direction === "low" ? "Low" : direction === "high" ? "High" : "Abnormal";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        flag === "normal" && "bg-success-fill/12 text-success-text",
        flag === "abnormal" && "bg-warning-fill/15 text-warning-text",
        flag === "critical" && "bg-danger-fill text-white",
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function FlagPicker({ value, onChange, onAuto }: { value: ResultFlag; onChange: (flag: ResultFlag) => void; onAuto?: () => void }) {
  const options: Array<{ id: ResultFlag; label: string; tone: string }> = [
    { id: "normal", label: "Normal", tone: "bg-success-fill text-white" },
    { id: "abnormal", label: "Abnormal", tone: "bg-warning-fill text-white" },
    { id: "critical", label: "Critical", tone: "bg-danger-fill text-white" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Flag" className="flex h-8 gap-0.5 rounded-lg border border-input bg-background p-0.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => onChange(option.id)}
            className={cn("rounded-md px-2.5 text-xs font-medium transition-colors", value === option.id ? option.tone : "text-fg-secondary hover:bg-surface-1")}
          >
            {option.label}
          </button>
        ))}
      </div>
      {onAuto ? (
        <button type="button" onClick={onAuto} className="text-xs font-medium text-primary hover:underline">Use automatic</button>
      ) : null}
    </div>
  );
}

/** Low | normal | high bar with a marker where the value falls. */
function RangeBar({ value, setup }: { value: number; setup: Extract<ResultSetup, { type: "number" }> }) {
  if (setup.low === undefined || setup.high === undefined || setup.high <= setup.low) return null;
  const span = setup.high - setup.low;
  const min = setup.low - span / 2;
  const max = setup.high + span / 2;
  const position = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  return (
    <div className="w-72 max-w-full" aria-hidden="true">
      <div className="relative flex h-2 overflow-hidden rounded-full">
        <span className="w-1/4 bg-warning-fill/40" />
        <span className="w-1/2 bg-success-fill/40" />
        <span className="w-1/4 bg-warning-fill/40" />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow" style={{ left: `${position}%` }} />
      </div>
      <div className="mt-0.5 flex justify-between px-[22%] font-mono text-[10px] text-fg-muted">
        <span>{setup.low}</span>
        <span>{setup.high}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Check & send
// ---------------------------------------------------------------------------

function ReviewDialog({
  open,
  onOpenChange,
  order,
  items,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorklistDiagnosticOrder;
  items: DiagnosticItem[];
  onChanged: (order: WorklistDiagnosticOrder) => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const critical = items.filter((item) => item.result?.result_flag === "critical");
  const flagged = items.filter((item) => item.result?.result_flag === "abnormal");

  async function send() {
    setSending(true);
    setError("");
    let latest: WorklistDiagnosticOrder | null = null;
    try {
      // Verify each result that is ready; already-sent results are skipped.
      for (const item of items.filter((entry) => entry.status === "result_ready")) {
        latest = (await verifyDiagnosticResult(item.id)).item;
        onChanged(latest);
      }
      onOpenChange(false);
      toast.success("Results sent to the doctor", { description: `${order.patient_name} is back in the doctor's queue.` });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Some results could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) onOpenChange(next); }}>
      <DialogContent size="standard">
        <DialogHeader>
          <DialogTitle>Check before sending</DialogTitle>
          <DialogDescription>
            After sending, results are locked and {order.patient_name} goes back to the doctor.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
          {items.map((item) => (
            <li key={item.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2.5", item.result?.result_flag === "critical" && "bg-danger-fill/5")}>
              <span className="text-[13px] font-medium">{item.item_name}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold">
                  {item.result?.result_value}
                  {item.result?.result_unit ? <span className="ml-1 font-sans text-xs font-normal text-fg-muted">{item.result.result_unit}</span> : null}
                </span>
                <FlagChip flag={(item.result?.result_flag as ResultFlag | null) ?? "normal"} />
              </span>
            </li>
          ))}
        </ul>

        {critical.length ? (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger-fill/40 bg-danger-fill/10 p-3 text-sm text-danger-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {critical.length === 1 ? "1 result is critical." : `${critical.length} results are critical.`} Make sure the doctor has been told.
          </p>
        ) : flagged.length ? (
          <p className="text-[13px] text-warning-text">{flagged.length} {flagged.length === 1 ? "result is" : "results are"} outside the normal range.</p>
        ) : (
          <p className="text-[13px] text-success-text">All results are normal.</p>
        )}

        {error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>Go back</Button>
          <Button type="button" className="gap-2" disabled={sending} onClick={() => void send()}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            {sending ? "Sending…" : "Send to doctor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Steps({ step }: { step: number }) {
  const steps = ["Take sample", "Enter results", "Check & send"];
  return (
    <ol className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px]" aria-label="Progress">
      {steps.map((label, index) => {
        const number = index + 1;
        const complete = step > number;
        const current = step === number;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                complete && "bg-success-fill text-white",
                current && "bg-primary text-primary-foreground",
                !complete && !current && "bg-muted text-fg-muted",
              )}
              aria-hidden="true"
            >
              {complete ? <Check className="size-3.5" strokeWidth={3} /> : number}
            </span>
            <span className={cn("whitespace-nowrap font-medium", current || complete ? "text-foreground" : "text-fg-muted")}>
              {label}
              <span className="sr-only">{complete ? " (done)" : current ? " (current)" : ""}</span>
            </span>
            {index < steps.length - 1 ? <span className={cn("h-px flex-1", complete ? "bg-success-fill/60" : "bg-border")} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function BackLink() {
  return (
    <Link href="/lab" className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Lab board
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

/** Saved alongside each result so the doctor sees the range that applied at the time. */
function referenceText(setup: ResultSetup | null): string | undefined {
  if (!setup || setup.type === "text") return undefined;
  if (setup.type === "number") return describeRange(setup) || undefined;
  const normal = setup.choices.filter((choice) => choice.flag === "normal").map((choice) => choice.label);
  return normal.length ? normal.join(" / ") : undefined;
}

/** A saved flag that differs from the automatic one was chosen by hand — keep it. */
function initialManualFlag(setup: ResultSetup | null, value: string, savedFlag: string | null): ResultFlag | null {
  const flag = savedFlag === "normal" || savedFlag === "abnormal" || savedFlag === "critical" ? savedFlag : null;
  if (!flag || setup?.type === "choice") return null;
  if (setup?.type === "number") {
    const n = parseNumber(value);
    const hasRange = setup.low !== undefined || setup.high !== undefined || setup.criticalLow !== undefined || setup.criticalHigh !== undefined;
    if (n !== null && hasRange && evaluateNumber(n, setup).flag === flag) return null;
  }
  return flag;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
