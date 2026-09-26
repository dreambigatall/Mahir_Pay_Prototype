"use client";

import { Hash, ListChecks, Plus, Sparkles, Trash2, Type, type LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  draftFromSetup,
  sameSetup,
  setupFromDraft,
  suggestSetup,
  summarizeSetup,
  type ResultFlag,
  type SetupDraft,
  type SetupType,
} from "@/lib/lab-result-setup";
import { cn } from "@/lib/utils";

const TYPES: Array<{ id: SetupType; label: string; hint: string; icon: LucideIcon }> = [
  { id: "number", label: "Number", hint: "e.g. Hb, blood sugar", icon: Hash },
  { id: "choice", label: "Choice", hint: "e.g. Negative / Positive", icon: ListChecks },
  { id: "text", label: "Written", hint: "e.g. stool, urine microscopy", icon: Type },
];

const FLAGS: Array<{ id: ResultFlag; label: string; tone: string }> = [
  { id: "normal", label: "Normal", tone: "bg-success-fill text-white" },
  { id: "abnormal", label: "Abnormal", tone: "bg-warning-fill text-white" },
  { id: "critical", label: "Critical", tone: "bg-danger-fill text-white" },
];

/**
 * "How does the lab record this result?" — used in the add/edit catalog dialogs for lab tests.
 * Works on a string draft; the dialog converts it with `setupFromDraft` when saving.
 */
export function ResultSetupEditor({
  testName,
  draft,
  onChange,
  error,
}: {
  testName: string;
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
  error?: string | null;
}) {
  const set = (next: Partial<SetupDraft>) => onChange({ ...draft, ...next });
  const suggestion = suggestSetup(testName);
  const current = setupFromDraft(draft).setup;
  const showSuggestion = suggestion && !sameSetup(suggestion, current);

  return (
    <div className="space-y-4">
      {showSuggestion ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px]">
          <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-fg-secondary">
            Suggested for <strong className="text-foreground">{testName.trim()}</strong>: {summarizeSetup(suggestion)}
          </span>
          <button
            type="button"
            onClick={() => onChange(draftFromSetup(suggestion))}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Use this
          </button>
        </div>
      ) : null}

      <div role="radiogroup" aria-label="Result type" className="grid grid-cols-3 gap-2">
        {TYPES.map(({ id, label, hint, icon: Icon }) => {
          const active = draft.type === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ type: id })}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/40",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-[13px] font-semibold", active ? "text-primary" : "text-foreground")}>
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </span>
              <span className="text-[11px] leading-tight text-fg-muted">{hint}</span>
            </button>
          );
        })}
      </div>

      {draft.type === "number" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:grid-cols-[110px_1fr_auto_1fr]">
            <div className="col-span-3 grid gap-1.5 sm:col-span-1">
              <Label htmlFor="setup-unit" className="text-[13px] font-medium">Unit</Label>
              <Input id="setup-unit" value={draft.unit} onChange={(event) => set({ unit: event.target.value })} placeholder="g/dL" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="setup-low" className="text-[13px] font-medium">Normal from</Label>
              <Input id="setup-low" inputMode="decimal" value={draft.low} onChange={(event) => set({ low: event.target.value })} placeholder="12" className="font-mono" />
            </div>
            <span className="pb-2 text-[13px] text-fg-muted">to</span>
            <div className="grid gap-1.5">
              <Label htmlFor="setup-high" className="text-[13px] font-medium">&nbsp;</Label>
              <Input id="setup-high" aria-label="Normal to" inputMode="decimal" value={draft.high} onChange={(event) => set({ high: event.target.value })} placeholder="16" className="font-mono" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-[12px] font-medium text-foreground">
              Critical limits <span className="font-normal text-fg-muted">(optional · the lab is told to alert the doctor)</span>
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="setup-critical-low" className="text-[12px] text-fg-secondary">Critical below</Label>
                <Input id="setup-critical-low" inputMode="decimal" value={draft.criticalLow} onChange={(event) => set({ criticalLow: event.target.value })} placeholder="7" className="font-mono" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="setup-critical-high" className="text-[12px] text-fg-secondary">Critical above</Label>
                <Input id="setup-critical-high" inputMode="decimal" value={draft.criticalHigh} onChange={(event) => set({ criticalHigh: event.target.value })} placeholder="20" className="font-mono" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {draft.type === "choice" ? (
        <div className="space-y-2">
          <p className="text-[12px] text-fg-muted">The answers the lab can tap, and whether each one is normal.</p>
          {draft.choices.map((choice, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                aria-label={`Answer ${index + 1}`}
                value={choice.label}
                onChange={(event) => set({ choices: draft.choices.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)) })}
                placeholder={index === 0 ? "e.g. Negative" : "e.g. Positive"}
                className="flex-1"
              />
              <div role="radiogroup" aria-label={`How to flag answer ${index + 1}`} className="flex h-8 shrink-0 gap-0.5 rounded-lg border border-input bg-background p-0.5">
                {FLAGS.map((flag) => (
                  <button
                    key={flag.id}
                    type="button"
                    role="radio"
                    aria-checked={choice.flag === flag.id}
                    onClick={() => set({ choices: draft.choices.map((entry, i) => (i === index ? { ...entry, flag: flag.id } : entry)) })}
                    className={cn("rounded-md px-2 text-[11px] font-medium transition-colors", choice.flag === flag.id ? flag.tone : "text-fg-muted hover:bg-surface-1")}
                  >
                    {flag.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={draft.choices.length <= 2}
                onClick={() => set({ choices: draft.choices.filter((_, i) => i !== index) })}
                className="shrink-0 rounded p-1.5 text-fg-muted transition-colors hover:bg-danger-fill/10 hover:text-danger-text disabled:opacity-30"
                aria-label={`Remove answer ${index + 1}`}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {draft.choices.length < 12 ? (
            <button
              type="button"
              onClick={() => set({ choices: [...draft.choices, { label: "", flag: "abnormal" }] })}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add answer
            </button>
          ) : null}
        </div>
      ) : null}

      {draft.type === "text" ? (
        <p className="rounded-lg bg-muted/40 px-3 py-2.5 text-[12px] text-fg-secondary">
          The lab writes the result in words — good for microscopy, stool, or reports with many parts.
        </p>
      ) : null}

      <SetupPreview draft={draft} />

      {error ? <p role="alert" className="text-[12px] font-medium text-danger-text">{error}</p> : null}
    </div>
  );
}

/** Shows the admin exactly what the lab technician will see. */
function SetupPreview({ draft }: { draft: SetupDraft }) {
  const { setup } = setupFromDraft(draft);
  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-fg-muted uppercase">The lab will see</p>
      {!setup || setup.type === "text" ? (
        <div className="h-8 rounded-lg border border-input bg-background px-2.5 text-[13px] leading-8 text-fg-muted">Type the result…</div>
      ) : setup.type === "choice" ? (
        <div className="flex flex-wrap gap-1.5">
          {setup.choices.map((choice) => (
            <span
              key={choice.label}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[12px] font-medium",
                choice.flag === "normal" ? "border-success-fill/40 text-success-text" : choice.flag === "critical" ? "border-danger-fill/40 text-danger-text" : "border-warning-fill/50 text-warning-text",
              )}
            >
              {choice.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-32 items-center justify-between rounded-lg border border-input bg-background px-2.5 text-[13px] text-fg-muted">
            <span>0.0</span>
            <span className="text-[11px]">{setup.unit}</span>
          </div>
          {setup.low !== undefined || setup.high !== undefined ? (
            <span className="text-[12px] text-fg-secondary">
              Normal: {setup.low ?? "—"} – {setup.high ?? "—"} {setup.unit}
            </span>
          ) : (
            <span className="text-[12px] text-fg-muted">No normal range — the lab sets the flag by hand.</span>
          )}
        </div>
      )}
    </div>
  );
}
