"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CalendarClock, CheckCircle2, CreditCard, Landmark, Loader2, Plus, Printer, Receipt, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog, useDiscardGuard } from "@/components/ui/confirm-dialog";
import { FormErrorSummary, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { authorizeInvoiceCredit, collectInvoicePayment, getChargeSuggestions, getInvoiceByVisit, issueInvoice, type BackendInvoice, type SuggestedCharge } from "@/lib/api/billing";
import { getVisitPrescriptions, listCatalog, type CatalogItem, type Prescription } from "@/lib/api/clinical";
import { getPatient, getVisit } from "@/lib/api/encounters";
import type { BackendPatient } from "@/lib/api/patients";
import type { BackendVisit } from "@/lib/api/workflow";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFormErrors, type FieldRules } from "@/lib/use-form-errors";

type SettlementMode = "full" | "partial" | "credit";
type PayMethod = "cash" | "card" | "mobile_money" | "bank_transfer";

type ChargeDraft = { catalogItemId: string; description: string; quantity: number; unitPrice: number; itemType: string };

export function LiveInvoiceWorkspace({ visitId }: { visitId: string }) {
  const [visit, setVisit] = useState<BackendVisit | null>(null);
  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [invoice, setInvoice] = useState<BackendInvoice | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [charges, setCharges] = useState<ChargeDraft[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const visitResponse = await getVisit(visitId);
      const [patientResponse, invoiceResult, rxResult] = await Promise.all([
        getPatient(visitResponse.item.patient_id),
        getInvoiceByVisit(visitId).catch((caught) => {
          if (caught instanceof ApiError && caught.status === 404) return null;
          throw caught;
        }),
        getVisitPrescriptions(visitId).catch(() => ({ items: [] as Prescription[] })),
      ]);
      setVisit(visitResponse.item);
      setPatient(patientResponse.item);
      setInvoice(invoiceResult?.item ?? null);
      setPrescriptions(rxResult.items);
      if (!invoiceResult) {
        const [suggestions, ...catalogResponses] = await Promise.all([
          getChargeSuggestions(visitId),
          listCatalog("consultation"),
          listCatalog("lab_test"),
          listCatalog("radiology"),
          listCatalog("drug"),
          listCatalog("procedure"),
        ]);
        setCatalog(catalogResponses.flatMap((response) => response.items));
        setCharges(toDrafts(suggestions.items));
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The billing record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => { void load(); }, [load]);

  const subtotal = charges.reduce((sum, charge) => sum + charge.quantity * charge.unitPrice, 0);

  function addCharge() {
    const item = catalog.find((entry) => entry.id === selectedCatalogId);
    if (!item || charges.some((charge) => charge.catalogItemId === item.id)) return;
    setCharges((current) => [...current, { catalogItemId: item.id, description: item.name, quantity: 1, unitPrice: Number(item.price), itemType: item.item_type }]);
    setSelectedCatalogId("");
  }

  function requestIssue() {
    if (!charges.length) {
      setError("Add at least one charge before issuing the invoice.");
      return;
    }
    if (charges.some((charge) => !Number.isFinite(charge.quantity) || charge.quantity <= 0)) {
      setError("Every quantity must be greater than zero.");
      return;
    }
    setError("");
    setConfirmIssue(true);
  }

  async function issue() {
    setIssuing(true);
    setError("");
    try {
      const response = await issueInvoice(
        visitId,
        charges.map((charge) => ({ catalogItemId: charge.catalogItemId, quantity: charge.quantity, description: charge.description })),
      );
      setInvoice(response.item);
      setConfirmIssue(false);
      toast.success("Invoice issued", { description: response.item.invoice_number });
    } catch (caught) {
      setConfirmIssue(false);
      setError(caught instanceof ApiError ? caught.message : "The invoice could not be issued.");
    } finally {
      setIssuing(false);
    }
  }

  if (loading) return <InvoiceSkeleton />;
  if (error && (!visit || !patient)) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div>
      </div>
    );
  }
  if (!visit || !patient) return null;

  return (
    <div className="w-full space-y-5">
      <BackLink />
      <header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{invoice?.invoice_number ?? "Create invoice"}</h1>
          <p className="mt-2 text-sm text-fg-secondary">{fullName(patient)} · {visit.visit_number} · {patient.medical_record_number}</p>
        </div>
        {invoice ? <InvoiceStatus invoice={invoice} /> : <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Draft charges</span>}
      </header>
      {error ? <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div> : null}
      <PrescriptionBillingSummary prescriptions={prescriptions} />
      {invoice ? (
        <IssuedInvoice
          invoice={invoice}
          onChanged={(next) => {
            setInvoice(next);
            void getVisitPrescriptions(visitId).then((result) => setPrescriptions(result.items)).catch(() => undefined);
          }}
        />
      ) : (
        <InvoiceBuilder
          catalog={catalog}
          charges={charges}
          subtotal={subtotal}
          selectedCatalogId={selectedCatalogId}
          setSelectedCatalogId={setSelectedCatalogId}
          addCharge={addCharge}
          updateQuantity={(id, quantity) => setCharges((current) => current.map((charge) => (charge.catalogItemId === id ? { ...charge, quantity } : charge)))}
          removeCharge={(id) => setCharges((current) => current.filter((charge) => charge.catalogItemId !== id))}
          issue={requestIssue}
          issuing={issuing}
        />
      )}
      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title="Issue this invoice?"
        description={`${charges.length} charge${charges.length === 1 ? "" : "s"} totalling ${formatMoney(subtotal)} for ${fullName(patient)}. Once issued, charges are locked and cannot be edited.`}
        confirmLabel={`Issue ${formatMoney(subtotal)} invoice`}
        cancelLabel="Keep editing"
        onConfirm={issue}
      />
    </div>
  );
}

function InvoiceBuilder({
  catalog,
  charges,
  subtotal,
  selectedCatalogId,
  setSelectedCatalogId,
  addCharge,
  updateQuantity,
  removeCharge,
  issue,
  issuing,
}: {
  catalog: CatalogItem[];
  charges: ChargeDraft[];
  subtotal: number;
  selectedCatalogId: string;
  setSelectedCatalogId: (id: string) => void;
  addCharge: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeCharge: (id: string) => void;
  issue: () => void;
  issuing: boolean;
}) {
  const available = catalog.filter((item) => !charges.some((charge) => charge.catalogItemId === item.id));

  return (
    <section className="rounded-xl border border-border bg-surface-2 p-5">
      <div>
        <h2 className="font-heading text-lg font-semibold">Review clinical charges</h2>
        <p className="mt-1 text-sm text-fg-muted">Suggested from the consultation, lab tests, and prescriptions. Check each line before issuing.</p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
          <SelectTrigger className="min-h-11 flex-1" aria-label="Add a catalog item"><SelectValue placeholder="Add another service or item" /></SelectTrigger>
          <SelectContent>
            {available.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.name} · {formatMoney(Number(item.price))}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!selectedCatalogId} onClick={addCharge}>
          <Plus className="size-4" aria-hidden="true" />
          Add charge
        </Button>
      </div>

      {charges.length ? (
        <div className="mt-5 space-y-3">
          {charges.map((charge) => (
            <div key={charge.catalogItemId} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_100px_120px_40px] sm:items-end">
              <div>
                <p className="font-medium">{charge.description}</p>
                <p className="mt-1 text-xs capitalize text-fg-muted">{charge.itemType.replace("_", " ")} · {formatMoney(charge.unitPrice)} each</p>
              </div>
              <div>
                <Label htmlFor={`quantity-${charge.catalogItemId}`}>Quantity</Label>
                <Input
                  id={`quantity-${charge.catalogItemId}`}
                  type="number"
                  min="0.001"
                  step="0.001"
                  className="mt-1 min-h-10"
                  aria-invalid={!(charge.quantity > 0) || undefined}
                  value={charge.quantity}
                  onChange={(event) => updateQuantity(charge.catalogItemId, Number(event.target.value))}
                />
              </div>
              <div className="sm:pb-2">
                <p className="text-xs text-fg-muted">Line total</p>
                <p className="mt-1 font-mono font-semibold tabular-nums">{formatMoney(charge.quantity * charge.unitPrice)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10 text-fg-muted hover:text-danger-text" aria-label={`Remove ${charge.description}`} onClick={() => removeCharge(charge.catalogItemId)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted">No suggested charges were found. Add items from the clinic catalog.</div>
      )}

      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-fg-muted">Invoice total</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{formatMoney(subtotal)}</p>
        </div>
        <Button type="button" className="min-h-11 gap-2" disabled={issuing || !charges.length} onClick={issue}>
          {issuing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Receipt className="size-4" aria-hidden="true" />}
          {issuing ? "Issuing…" : "Issue invoice"}
        </Button>
      </div>
    </section>
  );
}

function IssuedInvoice({ invoice, onChanged }: { invoice: BackendInvoice; onChanged: (invoice: BackendInvoice) => void }) {
  const onCredit = Boolean(invoice.on_credit);
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h2 className="font-heading text-base font-semibold">Itemized charges</h2>
          <Button type="button" variant="outline" size="sm" className="min-h-10 gap-2" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />Print
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {invoice.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="font-medium">{line.description}</p>
                <p className="mt-1 text-xs text-fg-muted">{line.quantity} × {formatMoney(Number(line.unit_price))}</p>
              </div>
              <p className="shrink-0 font-mono font-medium tabular-nums">{formatMoney(Number(line.line_total))}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <MoneyRow label="Subtotal" amount={invoice.subtotal} />
          {Number(invoice.discount_amount) > 0 ? <MoneyRow label="Discount" amount={`-${invoice.discount_amount}`} /> : null}
          <MoneyRow label="Total" amount={invoice.total} strong />
          <MoneyRow label="Paid" amount={invoice.amount_paid} />
          <MoneyRow label="Balance due" amount={invoice.balance_due} strong />
          {onCredit && invoice.due_at ? (
            <div className="flex items-center justify-between text-sm text-fg-secondary">
              <span>Credit due</span>
              <span className="font-mono tabular-nums">{formatDate(invoice.due_at)}</span>
            </div>
          ) : null}
        </div>
      </section>

      {onCredit && invoice.status !== "paid" ? (
        <div role="status" className="rounded-xl border border-info-fill/30 bg-info-fill/10 p-4 text-sm text-info-text">
          <p className="font-semibold">Released on credit</p>
          <p className="mt-1">
            Medicine can go to pharmacy. Outstanding balance {formatMoney(Number(invoice.balance_due))}
            {invoice.due_at ? ` is due by ${formatDate(invoice.due_at)}.` : "."}
          </p>
        </div>
      ) : null}

      {invoice.status !== "paid" ? (
        <PaymentPanel invoice={invoice} onChanged={onChanged} />
      ) : (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success-fill/30 bg-success-fill/10 p-4 text-sm text-success-text">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Invoice paid in full</p>
            <p className="mt-1">Tracked medicines are deducted when stock allows. If anything remains, pharmacy can still finish the handoff.</p>
          </div>
        </div>
      )}

      {invoice.payments.length ? (
        <section className="rounded-xl border border-border bg-surface-2 p-5">
          <h2 className="font-heading text-base font-semibold">Payment history</h2>
          <div className="mt-3 space-y-3">
            {invoice.payments.map((payment) => (
              <div key={payment.id} className="flex items-start justify-between gap-4 border-t border-border/60 pt-3 first:border-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium">{payment.receipt_number}</p>
                  <p className="mt-1 text-xs capitalize text-fg-muted">
                    {payment.method.replace("_", " ")} · {formatDateTime(payment.paid_at)}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums">{formatMoney(Number(payment.amount))}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

type PaymentForm = {
  mode: SettlementMode;
  method: PayMethod;
  amount: string;
  reference: string;
  dueAt: string;
  note: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  amount: "Amount paying now",
  reference: "Transaction reference",
  dueAt: "Pay by date",
};

const METHOD_LABELS: Record<PayMethod, string> = { cash: "Cash", card: "Card", mobile_money: "Mobile money", bank_transfer: "Bank transfer" };

function PaymentPanel({ invoice, onChanged }: { invoice: BackendInvoice; onChanged: (invoice: BackendInvoice) => void }) {
  const balance = Number(invoice.balance_due);
  const alreadyOnCredit = Boolean(invoice.on_credit);
  const initial = useMemo<PaymentForm>(() => ({
    mode: "full",
    method: "cash",
    amount: "",
    reference: "",
    dueAt: defaultDueDate(),
    note: "",
  }), []);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<PaymentForm>(initial);
  const [submitting, setSubmitting] = useState(false);

  const payingNow = values.mode === "full" ? balance : values.mode === "partial" ? Number(values.amount) || 0 : 0;
  const leftToPay = Math.max(0, balance - payingNow);

  const paymentRules = useMemo<FieldRules<PaymentForm>>(() => ({
    amount: (value, form) => {
      if (form.mode !== "partial") return undefined;
      const amount = Number(value);
      if (!String(value).trim()) return "Enter how much the patient is paying now";
      if (!Number.isFinite(amount) || amount <= 0) return "Amount must be more than zero";
      return amount >= balance ? `That is the full amount — choose "Pay in full" instead` : undefined;
    },
    reference: (value, form) =>
      form.mode !== "credit" && form.method !== "cash" && !String(value).trim()
        ? `Enter the ${METHOD_LABELS[form.method].toLowerCase()} reference`
        : undefined,
    dueAt: (value, form) => {
      if (form.mode !== "credit") return undefined;
      if (!value) return "Choose the date they will pay by";
      return String(value) < todayInputDate() ? "The date cannot be in the past" : undefined;
    },
  }), [balance]);

  const form = useFormErrors(values, paymentRules);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = (next: Partial<PaymentForm>) => setValues((current) => ({ ...current, ...next }));

  function close() {
    setOpen(false);
    setValues(initial);
    form.reset();
  }

  const guard = useDiscardGuard(dirty && !submitting, close);

  async function submit() {
    if (!form.validateAll()) return;
    setSubmitting(true);
    try {
      if (values.mode === "credit") {
        const response = await authorizeInvoiceCredit(invoice.id, { dueAt: values.dueAt, note: values.note.trim() || undefined });
        onChanged(response.item);
        toast.success("Saved as pay later", {
          description: `${formatMoney(balance)} to be paid by ${formatDate(values.dueAt)}. Medicine can go to pharmacy.`,
        });
      } else {
        const response = await collectInvoicePayment(invoice.id, {
          amount: payingNow,
          method: values.method,
          reference: values.reference.trim() || undefined,
        });
        onChanged(response.item);
        toast.success(values.mode === "full" ? "Paid in full" : "Part payment saved", {
          description: values.mode === "full"
            ? `${formatMoney(payingNow)} received. Medicine can go to pharmacy.`
            : `${formatMoney(payingNow)} received. ${formatMoney(leftToPay)} still to pay.`,
        });
      }
      close();
    } catch (caught) {
      form.applyApiError(caught, "The payment could not be saved. Nothing was charged — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const options: Array<{ id: SettlementMode; title: string; line: string; icon: typeof Banknote; amount: string | null }> = [
    { id: "full", title: "Pay in full", line: "Pays everything now · medicine is released", icon: CheckCircle2, amount: formatMoney(balance) },
    { id: "partial", title: "Part payment", line: "Pays some now, the rest later · medicine waits until paid", icon: Receipt, amount: null },
    ...(!alreadyOnCredit
      ? [{ id: "credit" as const, title: "Pay later", line: "Pays nothing now · medicine is released", icon: CalendarClock, amount: null }]
      : []),
  ];

  const summary = values.mode === "full"
    ? `Receive ${formatMoney(balance)} by ${METHOD_LABELS[values.method].toLowerCase()}. The invoice is cleared.`
    : values.mode === "partial"
      ? payingNow > 0
        ? `Receive ${formatMoney(payingNow)} by ${METHOD_LABELS[values.method].toLowerCase()}. ${formatMoney(leftToPay)} is still to pay.`
        : "Enter the amount they are paying now."
      : `Nothing is paid now. ${formatMoney(balance)} is due by ${values.dueAt ? formatDate(values.dueAt) : "the chosen date"}.`;

  const submitLabel = values.mode === "credit"
    ? "Save as pay later"
    : values.mode === "full"
      ? `Confirm ${formatMoney(balance)} paid`
      : payingNow > 0 ? `Confirm ${formatMoney(payingNow)} paid` : "Confirm payment";

  return (
    <section className="rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-warning-text">
            {alreadyOnCredit ? "Collect the remaining balance" : "Take payment"}
          </h2>
          <p className="mt-1 text-sm text-warning-text">
            To pay: <strong>{formatMoney(balance)}</strong>
            {alreadyOnCredit && invoice.due_at ? ` · due ${formatDate(invoice.due_at)}` : ""}
          </p>
        </div>
        <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : guard.requestClose())}>
          <SheetTrigger asChild>
            <Button type="button" className="min-h-11 gap-2">
              <Banknote className="size-4" aria-hidden="true" />
              {alreadyOnCredit ? "Collect balance" : "Take payment"}
            </Button>
          </SheetTrigger>
          <SheetContent size="panel">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle className="text-lg font-semibold">Take payment</SheetTitle>
              <SheetDescription>{invoice.invoice_number}</SheetDescription>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">{formatMoney(balance)}</p>
              <p className="text-xs text-fg-muted">{alreadyOnCredit ? "Still to pay on this invoice" : "Total to pay"}</p>
            </SheetHeader>

            <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <FormErrorSummary
                  message={form.formError || undefined}
                  items={form.formError ? [] : form.visibleErrors}
                  labels={PAYMENT_LABELS}
                  idFor={(name) => `payment-${name}`}
                />

                {/* 1. How */}
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-[13px] font-semibold">How will they pay?</legend>
                  {options.map(({ id, title, line, icon: Icon, amount }) => {
                    const active = values.mode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { set({ mode: id }); form.reset(); }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", active ? "border-primary" : "border-border")} aria-hidden="true">
                          {active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                        </span>
                        <Icon className={cn("size-5 shrink-0", active ? "text-primary" : "text-fg-muted")} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground">{title}</span>
                          <span className="block text-xs text-fg-muted">{line}</span>
                        </span>
                        {amount ? <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{amount}</span> : null}
                      </button>
                    );
                  })}
                </fieldset>

                {/* 2. Details for the chosen way */}
                {values.mode === "credit" ? (
                  <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                    <FormField id="payment-dueAt" label="Pay by date" required error={form.errorFor("dueAt")}>
                      <Input type="date" min={todayInputDate()} value={values.dueAt} onChange={(event) => set({ dueAt: event.target.value })} onBlur={() => form.touch("dueAt")} />
                    </FormField>
                    <FormField id="payment-note" label="Note" hint="Optional — e.g. “Will pay on Friday”.">
                      <Input value={values.note} onChange={(event) => set({ note: event.target.value })} />
                    </FormField>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                    {values.mode === "partial" ? (
                      <FormField
                        id="payment-amount"
                        label="Amount paying now"
                        required
                        error={form.errorFor("amount")}
                        hint={payingNow > 0 && payingNow < balance ? `${formatMoney(leftToPay)} will still be left to pay.` : `Less than ${formatMoney(balance)}.`}
                      >
                        <Input
                          inputMode="decimal"
                          autoFocus
                          value={values.amount}
                          onChange={(event) => set({ amount: event.target.value.replace(/[^\d.]/g, "") })}
                          onBlur={() => form.touch("amount")}
                          placeholder="0.00"
                          className="h-10 font-mono text-base"
                        />
                      </FormField>
                    ) : null}

                    <SegmentedControl
                      id="payment-method"
                      label="Paid with"
                      value={values.method}
                      onChange={(method) => set({ method, reference: "" })}
                      options={[
                        { value: "cash", label: <><Banknote aria-hidden="true" />Cash</> },
                        { value: "mobile_money", label: <><Smartphone aria-hidden="true" />MoMo</> },
                        { value: "card", label: <><CreditCard aria-hidden="true" />Card</> },
                        { value: "bank_transfer", label: <><Landmark aria-hidden="true" />Bank</> },
                      ]}
                    />

                    {values.method !== "cash" ? (
                      <FormField id="payment-reference" label="Transaction reference" required error={form.errorFor("reference")} hint="From the MoMo message, card slip, or bank receipt.">
                        <Input value={values.reference} onChange={(event) => set({ reference: event.target.value })} onBlur={() => form.touch("reference")} />
                      </FormField>
                    ) : null}
                  </div>
                )}

                {/* 3. What will happen */}
                <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] text-fg-secondary" aria-live="polite">{summary}</p>
              </div>

              <div className="flex flex-col-reverse gap-2.5 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="min-h-11" disabled={submitting} onClick={guard.requestClose}>Cancel</Button>
                <Button type="submit" className="min-h-11 gap-2" disabled={submitting || balance <= 0}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                  {submitting ? "Saving…" : submitLabel}
                </Button>
              </div>
            </form>
            {guard.prompt}
          </SheetContent>
        </Sheet>
      </div>
    </section>
  );
}

function PrescriptionBillingSummary({ prescriptions }: { prescriptions: Prescription[] }) {
  if (!prescriptions.length) return null;
  const pending = prescriptions.filter((rx) => rx.status === "awaiting_payment");
  const drugs = prescriptions.flatMap((rx) => rx.items.map((item) => item.drug_name));
  return (
    <section className="rounded-xl border border-border bg-surface-2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">Prescriptions on this visit</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {pending.length
              ? `${pending.length} prescription${pending.length === 1 ? "" : "s"} still need full payment or credit approval before pharmacy can dispense.`
              : "Payment or credit already cleared for pharmacy handoff."}
          </p>
        </div>
        {pending.length ? (
          <span className="rounded-full bg-warning-fill/10 px-2.5 py-1 text-xs font-semibold text-warning-text">Rx pending payment</span>
        ) : (
          <span className="rounded-full bg-success-fill/10 px-2.5 py-1 text-xs font-semibold text-success-text">Rx paid / released</span>
        )}
      </div>
      <p className="mt-3 text-sm text-fg-secondary">{drugs.join(", ")}</p>
    </section>
  );
}

function MoneyRow({ label, amount, strong = false }: { label: string; amount: string; strong?: boolean }) {
  const numeric = Number(amount);
  return (
    <div className={strong ? "flex items-center justify-between font-semibold" : "flex items-center justify-between text-sm text-fg-secondary"}>
      <span>{label}</span>
      <span className="font-mono tabular-nums">
        {amount.startsWith("-") ? `-${formatMoney(Math.abs(numeric))}` : formatMoney(numeric)}
      </span>
    </div>
  );
}

function InvoiceStatus({ invoice }: { invoice: BackendInvoice }) {
  if (invoice.status === "paid") {
    return <span className="rounded-full bg-success-fill/10 px-2.5 py-1 text-xs font-semibold text-success-text">paid</span>;
  }
  if (invoice.on_credit) {
    return <span className="rounded-full bg-info-fill/10 px-2.5 py-1 text-xs font-semibold text-info-text">on credit</span>;
  }
  return <span className="rounded-full bg-warning-fill/10 px-2.5 py-1 text-xs font-semibold capitalize text-warning-text">{invoice.status.replace("_", " ")}</span>;
}

function BackLink() { return <Button asChild variant="ghost" className="-ml-3 min-h-10"><Link href="/receptionist/billing"><ArrowLeft className="size-4" aria-hidden="true" />Back to billing worklist</Link></Button>; }
function InvoiceSkeleton() { return <div className="w-full space-y-5"><Skeleton className="h-10 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>; }
function fullName(patient: BackendPatient) { return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" "); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)); }
function todayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function defaultDueDate() {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
}
function toDrafts(items: SuggestedCharge[]): ChargeDraft[] {
  const combined = new Map<string, ChargeDraft>();
  for (const item of items) {
    const current = combined.get(item.catalog_item_id);
    if (current) current.quantity += Number(item.quantity);
    else combined.set(item.catalog_item_id, { catalogItemId: item.catalog_item_id, description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unit_price), itemType: item.item_type });
  }
  return [...combined.values()];
}


