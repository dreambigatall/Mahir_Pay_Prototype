"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FlaskConical,
  Loader2,
  Play,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import type { DiagnosticItem } from "@/lib/api/clinical";
import {
  enterDiagnosticResult,
  getDiagnosticOrder,
  listDiagnosticWorklist,
  startDiagnosticOrder,
  verifyDiagnosticResult,
  type WorklistDiagnosticOrder,
} from "@/lib/api/diagnostics";
import { getPresetForTest } from "@/lib/lab-presets";

type Draft = {
  resultValue: string;
  resultUnit: string;
  resultFlag: "normal" | "abnormal" | "critical";
  referenceRange: string;
  notes: string;
};

export default function LabOrderPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [order, setOrder] = useState<WorklistDiagnosticOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getDiagnosticOrder(requestId);
      setOrder(response.item);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The laboratory order could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(() => {
    if (!order) return { saved: 0, verified: 0, total: 0 };
    const total = order.items.length;
    const enteredStatuses = new Set(["result_ready", "verified", "reviewed"]);
    const verifiedStatuses = new Set(["verified", "reviewed"]);
    const saved = order.items.filter((item) => enteredStatuses.has(item.status)).length;
    const verified = order.items.filter((item) => verifiedStatuses.has(item.status)).length;
    return { saved, verified, total };
  }, [order]);

  async function start() {
    if (!order) return;
    setStarting(true);
    setError("");
    try {
      const response = await startDiagnosticOrder(order.id);
      setOrder(response.item);
      toast.success("Laboratory work started");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The order could not be started.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <OrderSkeleton />;
  if (error && !order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <BackLink />
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-5 text-sm text-danger-text">
          <p className="font-medium">Laboratory order unavailable</p>
          <p className="mt-1">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (!order) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackLink />

      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">{order.patient_name}</h1>
            <OrderStatus status={order.status} />
            {order.urgency === "urgent" ? <Chip variant="warning">Urgent / STAT</Chip> : <Chip variant="neutral">Routine</Chip>}
          </div>
          <p className="mt-2 text-sm text-fg-secondary">
            {order.visit_number} · {order.items.length} {order.items.length === 1 ? "test" : "tests"} · Ordered{" "}
            {formatDateTime(order.ordered_at)}
          </p>
        </div>
        {order.status === "requested" ? (
          <Button type="button" className="min-h-11 gap-2" disabled={starting} onClick={() => void start()}>
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {starting ? "Starting…" : "Start laboratory work"}
          </Button>
        ) : null}
      </header>

      <section className="rounded-xl border border-border bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Progress</p>
            <p className="mt-1 text-sm text-fg-secondary">
              {progress.verified}/{progress.total} verified · {progress.saved}/{progress.total} results entered
            </p>
          </div>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-surface-1 sm:w-48">
            <div
              className="h-full rounded-full bg-clinical-fill transition-all"
              style={{ width: `${progress.total ? (progress.verified / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>

      {order.clinical_notes ? (
        <section className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-1/70 p-3.5 text-[13px]">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-clinical-fill" aria-hidden="true" />
          <div>
            <span className="font-semibold text-foreground">Clinical indication: </span>
            <span className="text-fg-secondary">{order.clinical_notes}</span>
          </div>
        </section>
      ) : null}

      {order.status === "requested" ? (
        <div className="rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-4 text-sm text-warning-text">
          <p className="font-medium">Start this order before entering results</p>
          <p className="mt-1">Starting assigns the active laboratory queue entry to you and records the service start time.</p>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {order.items.map((item) => (
          <ResultCard
            key={item.id}
            item={item}
            urgency={order.urgency}
            disabled={order.status === "requested"}
            onOrderChanged={setOrder}
          />
        ))}
      </div>

      {order.status === "verified" || order.status === "reviewed" ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-success-fill/30 bg-success-fill/10 p-4 text-sm text-success-text"
        >
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {order.status === "reviewed" ? "Results acknowledged by doctor" : "All results verified"}
            </p>
            <p className="mt-1">
              {order.status === "reviewed"
                ? "This requisition is complete. The doctor has reviewed the verified results."
                : "The laboratory queue is complete and the patient has been returned to the doctor queue for result review."}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({
  item,
  urgency,
  disabled,
  onOrderChanged,
}: {
  item: DiagnosticItem;
  urgency: "routine" | "urgent";
  disabled: boolean;
  onOrderChanged: (order: WorklistDiagnosticOrder) => void;
}) {
  const preset = getPresetForTest(item.item_name);
  const [draft, setDraft] = useState<Draft>(() => ({
    resultValue: item.result?.result_value ?? "",
    resultUnit: item.result?.result_unit ?? preset?.defaultUnit ?? "",
    resultFlag: item.result?.result_flag ?? "normal",
    referenceRange: item.result?.reference_range ?? preset?.referenceRange ?? "",
    notes: item.result?.notes ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const verified = item.status === "verified" || item.status === "reviewed";

  function applyPreset(value: string, flag: "normal" | "abnormal") {
    setDraft((current) => ({
      ...current,
      resultValue: value,
      resultFlag: flag === "abnormal" ? "abnormal" : "normal",
      resultUnit: current.resultUnit || preset?.defaultUnit || "",
      referenceRange: current.referenceRange || preset?.referenceRange || "",
    }));
  }

  async function save() {
    if (!draft.resultValue.trim()) {
      setError("Observed result value is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await enterDiagnosticResult(item.id, {
        resultValue: draft.resultValue.trim(),
        resultUnit: draft.resultUnit.trim() || undefined,
        resultFlag: draft.resultFlag,
        referenceRange: draft.referenceRange.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      });
      onOrderChanged(response.item);
      toast.success(`${item.item_name} result saved`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The result could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface-2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold">{item.item_name}</h2>
            {(draft.referenceRange || preset?.referenceRange) ? (
              <span className="rounded border border-border bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                Ref: {draft.referenceRange || preset?.referenceRange}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs capitalize text-fg-muted">{item.item_type.replace("_", " ")}</p>
        </div>
        <ItemStatus status={item.status} flag={item.result?.result_flag ?? draft.resultFlag} />
      </div>

      {preset && !verified && !disabled ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-medium text-fg-muted">
            <Sparkles className="size-3 text-warning-fill" aria-hidden="true" />
            Quick presets:
          </span>
          {preset.presets.map((entry) => (
            <button
              key={entry.label}
              type="button"
              onClick={() => applyPreset(entry.value, entry.flag)}
              className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[12px] font-medium text-fg-secondary transition-colors hover:border-border-strong hover:text-foreground"
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          id={`${item.id}-value`}
          label="Observed result value *"
          value={draft.resultValue}
          onChange={(value) => setDraft((current) => ({ ...current, resultValue: value }))}
          disabled={disabled || verified}
          placeholder="e.g. 5.4 or Negative"
        />
        <Field
          id={`${item.id}-unit`}
          label="Measurement unit"
          value={draft.resultUnit}
          onChange={(value) => setDraft((current) => ({ ...current, resultUnit: value }))}
          disabled={disabled || verified}
          placeholder="g/dL, mmol/L, %…"
        />
        <Field
          id={`${item.id}-reference`}
          label="Reference range"
          value={draft.referenceRange}
          onChange={(value) => setDraft((current) => ({ ...current, referenceRange: value }))}
          disabled={disabled || verified}
          placeholder="e.g. 3.5–5.5"
        />
      </div>

      <div className="mt-4 grid gap-1.5">
        <Label className="text-[13px] font-normal text-fg-secondary">Clinical flag interpretation</Label>
        <RadioGroup
          value={draft.resultFlag}
          disabled={disabled || verified}
          onValueChange={(value) => setDraft((current) => ({ ...current, resultFlag: value as Draft["resultFlag"] }))}
          className="flex flex-wrap gap-3"
        >
          <label
            htmlFor={`${item.id}-normal`}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] hover:border-border-strong"
          >
            <RadioGroupItem value="normal" id={`${item.id}-normal`} />
            <span className="font-medium text-foreground">Normal</span>
          </label>
          <label
            htmlFor={`${item.id}-abnormal`}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-warning-fill/30 bg-warning-fill/10 px-3 py-1.5 text-[13px] text-warning-text hover:border-warning-fill"
          >
            <RadioGroupItem value="abnormal" id={`${item.id}-abnormal`} />
            <span className="font-semibold">Abnormal</span>
          </label>
          <label
            htmlFor={`${item.id}-critical`}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-danger-fill/30 bg-danger-fill/10 px-3 py-1.5 text-[13px] text-danger-text hover:border-danger-fill"
          >
            <RadioGroupItem value="critical" id={`${item.id}-critical`} />
            <span className="font-semibold">Critical</span>
          </label>
        </RadioGroup>
      </div>

      <div className="mt-4">
        <Label htmlFor={`${item.id}-notes`} className="text-[13px] font-normal text-fg-secondary">
          Technician remarks & commentary
        </Label>
        <Textarea
          id={`${item.id}-notes`}
          className="mt-1 bg-background text-[13px]"
          rows={2}
          value={draft.notes}
          disabled={disabled || verified}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Specimen notes, morphology, or other findings"
        />
      </div>

      {error ? (
        <p id={`${item.id}-error`} role="alert" className="mt-3 text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!verified ? (
          <Button type="button" variant="outline" className="min-h-10 gap-2" disabled={disabled || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {saving ? "Saving…" : "Save result"}
          </Button>
        ) : null}
        {item.status === "result_ready" ? (
          <Button type="button" className="min-h-10 gap-2" onClick={() => setVerifyOpen(true)}>
            <FileCheck2 className="size-4" aria-hidden="true" />
            Verify result
          </Button>
        ) : null}
      </div>

      <VerifyDialog open={verifyOpen} onOpenChange={setVerifyOpen} item={item} urgency={urgency} onVerified={onOrderChanged} />
    </section>
  );
}

function VerifyDialog({
  open,
  onOpenChange,
  item,
  urgency,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DiagnosticItem;
  urgency: "routine" | "urgent";
  onVerified: (order: WorklistDiagnosticOrder) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    setSubmitting(true);
    setError("");
    try {
      const response = await verifyDiagnosticResult(item.id);
      onVerified(response.item);
      onOpenChange(false);
      toast.success(`${item.item_name} verified`, {
        description:
          response.item.status === "verified"
            ? "All results are complete; the patient returned to the doctor queue."
            : "Verification recorded.",
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The result could not be verified.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify this result?</DialogTitle>
          <DialogDescription>
            Verification locks this result against normal editing. Confirm the value, unit, flag, and reference range are correct.
          </DialogDescription>
        </DialogHeader>
        {urgency === "urgent" ? (
          <div className="rounded-lg border border-warning-fill/30 bg-warning-fill/10 p-3 text-sm text-warning-text">
            This order was marked urgent. Double-check before verifying.
          </div>
        ) : null}
        {item.result?.result_flag === "critical" ? (
          <div role="alert" className="flex gap-2 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            This result is marked critical. Verify only after confirming the value.
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Continue editing
          </Button>
          <Button type="button" disabled={submitting} className="gap-2" onClick={() => void verify()}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileCheck2 className="size-4" aria-hidden="true" />}
            {submitting ? "Verifying…" : "Verify result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[13px] font-normal text-fg-secondary">
        {label}
      </Label>
      <Input
        id={id}
        className="mt-1 min-h-11 bg-background font-mono text-[14px] tabular-nums"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/lab" className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-foreground">
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to lab board
    </Link>
  );
}

function OrderStatus({ status }: { status: string }) {
  const tone =
    status === "verified"
      ? "bg-success-fill/10 text-success-text"
      : status === "result_ready"
        ? "bg-warning-fill/10 text-warning-text"
        : status === "in_progress"
          ? "bg-clinical-fill/10 text-clinical-text"
          : "bg-surface-1 text-fg-secondary";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tone}`}>{status.replace("_", " ")}</span>;
}

function ItemStatus({ status, flag }: { status: string; flag?: string | null }) {
  const danger = flag === "critical" || flag === "abnormal";
  const verified = status === "verified" || status === "reviewed";
  return (
    <span
      className={
        danger
          ? "rounded-full bg-danger-fill/10 px-2.5 py-1 text-xs font-semibold capitalize text-danger-text"
          : verified
            ? "rounded-full bg-success-fill/10 px-2.5 py-1 text-xs font-semibold capitalize text-success-text"
            : "rounded-full bg-surface-1 px-2.5 py-1 text-xs font-medium capitalize text-fg-secondary"
      }
    >
      {flag && status !== "in_progress" ? `${flag} · ` : ""}
      {status.replace("_", " ")}
    </span>
  );
}

function OrderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
