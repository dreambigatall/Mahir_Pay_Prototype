"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CheckCircle2, CreditCard, Loader2, Plus, Printer, Receipt, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { authorizeInvoiceCredit, collectInvoicePayment, getChargeSuggestions, getInvoiceByVisit, issueInvoice, type BackendInvoice, type SuggestedCharge } from "@/lib/api/billing";
import { getVisitPrescriptions, listCatalog, type CatalogItem, type Prescription } from "@/lib/api/clinical";
import { getPatient, getVisit } from "@/lib/api/encounters";
import type { BackendPatient } from "@/lib/api/patients";
import type { BackendVisit } from "@/lib/api/workflow";
import { formatMoney } from "@/lib/format";

type SettlementMode = "full" | "partial" | "credit";
type PayMethod = "cash" | "card" | "mobile_money" | "bank_transfer";

type ChargeDraft = { catalogItemId: string; description: string; quantity: number; unitPrice: number; itemType: string };

export function LiveInvoiceWorkspace({ visitId }: { visitId: string }) {
  const [visit, setVisit] = useState<BackendVisit | null>(null); const [patient, setPatient] = useState<BackendPatient | null>(null); const [invoice, setInvoice] = useState<BackendInvoice | null>(null); const [catalog, setCatalog] = useState<CatalogItem[]>([]); const [charges, setCharges] = useState<ChargeDraft[]>([]); const [prescriptions, setPrescriptions] = useState<Prescription[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [issuing, setIssuing] = useState(false); const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const visitResponse = await getVisit(visitId); const [patientResponse, invoiceResult, rxResult] = await Promise.all([getPatient(visitResponse.item.patient_id), getInvoiceByVisit(visitId).catch((caught) => { if (caught instanceof ApiError && caught.status === 404) return null; throw caught; }), getVisitPrescriptions(visitId).catch(() => ({ items: [] as Prescription[] }))]); setVisit(visitResponse.item); setPatient(patientResponse.item); setInvoice(invoiceResult?.item ?? null); setPrescriptions(rxResult.items); if (!invoiceResult) { const [suggestions, ...catalogResponses] = await Promise.all([getChargeSuggestions(visitId), listCatalog("consultation"), listCatalog("lab_test"), listCatalog("radiology"), listCatalog("drug"), listCatalog("procedure")]); const items = catalogResponses.flatMap((response) => response.items); setCatalog(items); setCharges(toDrafts(suggestions.items)); } } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The billing record could not be loaded."); } finally { setLoading(false); } }, [visitId]);
  useEffect(() => { void load(); }, [load]);
  const subtotal = charges.reduce((sum, charge) => sum + charge.quantity * charge.unitPrice, 0);
  function addCharge() { const item = catalog.find((entry) => entry.id === selectedCatalogId); if (!item || charges.some((charge) => charge.catalogItemId === item.id)) return; setCharges((current) => [...current, { catalogItemId: item.id, description: item.name, quantity: 1, unitPrice: Number(item.price), itemType: item.item_type }]); setSelectedCatalogId(""); }
  async function issue() { if (!charges.length) { setError("Add at least one charge before issuing the invoice."); return; } if (charges.some((charge) => !Number.isFinite(charge.quantity) || charge.quantity <= 0)) { setError("Every invoice quantity must be greater than zero."); return; } setIssuing(true); setError(""); try { const response = await issueInvoice(visitId, charges.map((charge) => ({ catalogItemId: charge.catalogItemId, quantity: charge.quantity, description: charge.description }))); setInvoice(response.item); toast.success("Invoice issued", { description: response.item.invoice_number }); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The invoice could not be issued."); } finally { setIssuing(false); } }
  if (loading) return <InvoiceSkeleton />;
  if (error && (!visit || !patient)) return <div className="space-y-4"><BackLink /><div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div></div>;
  if (!visit || !patient) return null;
  return <div className="w-full space-y-5"><BackLink /><header className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="font-heading text-2xl font-bold tracking-tight">{invoice?.invoice_number ?? "Create invoice"}</h1><p className="mt-2 text-sm text-fg-secondary">{fullName(patient)} · {visit.visit_number} · {patient.medical_record_number}</p></div>{invoice ? <InvoiceStatus invoice={invoice} /> : <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Draft charges</span>}</header>{error ? <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div> : null}<PrescriptionBillingSummary prescriptions={prescriptions} />{invoice ? <IssuedInvoice invoice={invoice} onChanged={(next) => { setInvoice(next); void getVisitPrescriptions(visitId).then((result) => setPrescriptions(result.items)).catch(() => undefined); }} /> : <InvoiceBuilder catalog={catalog} charges={charges} subtotal={subtotal} selectedCatalogId={selectedCatalogId} setSelectedCatalogId={setSelectedCatalogId} addCharge={addCharge} updateQuantity={(id, quantity) => setCharges((current) => current.map((charge) => charge.catalogItemId === id ? { ...charge, quantity } : charge))} removeCharge={(id) => setCharges((current) => current.filter((charge) => charge.catalogItemId !== id))} issue={() => void issue()} issuing={issuing} />}</div>;
}

function InvoiceBuilder({ catalog, charges, subtotal, selectedCatalogId, setSelectedCatalogId, addCharge, updateQuantity, removeCharge, issue, issuing }: { catalog: CatalogItem[]; charges: ChargeDraft[]; subtotal: number; selectedCatalogId: string; setSelectedCatalogId: (id: string) => void; addCharge: () => void; updateQuantity: (id: string, quantity: number) => void; removeCharge: (id: string) => void; issue: () => void; issuing: boolean }) {
  const available = catalog.filter((item) => !charges.some((charge) => charge.catalogItemId === item.id));
  return <section className="rounded-xl border border-border bg-surface-2 p-5"><div><h2 className="font-heading text-lg font-semibold">Review clinical charges</h2><p className="mt-1 text-sm text-fg-muted">Suggested charges come from the consultation, diagnostics, and prescriptions. Confirm every line before issuing.</p></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}><SelectTrigger className="min-h-11 flex-1"><SelectValue placeholder="Add another catalog item" /></SelectTrigger><SelectContent>{available.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {formatMoney(Number(item.price))}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" className="min-h-11 gap-2" disabled={!selectedCatalogId} onClick={addCharge}><Plus className="size-4" aria-hidden="true" />Add charge</Button></div>{charges.length ? <div className="mt-5 space-y-3">{charges.map((charge) => <div key={charge.catalogItemId} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_100px_120px_40px] sm:items-end"><div><p className="font-medium">{charge.description}</p><p className="mt-1 text-xs capitalize text-fg-muted">{charge.itemType.replace("_", " ")} · {formatMoney(charge.unitPrice)} each</p></div><div><Label htmlFor={`quantity-${charge.catalogItemId}`}>Quantity</Label><Input id={`quantity-${charge.catalogItemId}`} type="number" min="0.001" step="0.001" className="mt-1 min-h-10" value={charge.quantity} onChange={(event) => updateQuantity(charge.catalogItemId, Number(event.target.value))} /></div><div className="sm:pb-2"><p className="text-xs text-fg-muted">Line total</p><p className="mt-1 font-mono font-semibold tabular-nums">{formatMoney(charge.quantity * charge.unitPrice)}</p></div><Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10 text-fg-muted hover:text-danger-text" aria-label={`Remove ${charge.description}`} onClick={() => removeCharge(charge.catalogItemId)}><Trash2 className="size-4" aria-hidden="true" /></Button></div>)}</div> : <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-center text-sm text-fg-muted">No suggested charges were found. Add items from the clinic catalog.</div>}<div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-fg-muted">Invoice total</p><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{formatMoney(subtotal)}</p></div><Button type="button" className="min-h-11 gap-2" disabled={issuing || !charges.length} onClick={issue}>{issuing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Receipt className="size-4" aria-hidden="true" />}{issuing ? "Issuing…" : "Issue invoice"}</Button></div></section>;
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
        <PaymentDialog invoice={invoice} onChanged={onChanged} />
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

function PaymentDialog({ invoice, onChanged }: { invoice: BackendInvoice; onChanged: (invoice: BackendInvoice) => void }) {
  const balance = Number(invoice.balance_due);
  const alreadyOnCredit = Boolean(invoice.on_credit);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SettlementMode>(alreadyOnCredit ? "partial" : "full");
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<PayMethod>("cash");
  const [reference, setReference] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueDate());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function resetForm(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    setMode(alreadyOnCredit ? "partial" : "full");
    setAmount(String(balance));
    setMethod("cash");
    setReference("");
    setDueAt(defaultDueDate());
    setNote("");
    setError("");
  }

  function applyMode(next: SettlementMode) {
    setMode(next);
    setError("");
    if (next === "full") setAmount(String(balance));
    if (next === "partial" && Number(amount) >= balance) setAmount(String(Math.max(0.01, Math.round((balance / 2) * 100) / 100)));
  }

  async function collect() {
    setSubmitting(true);
    setError("");
    try {
      if (mode === "credit") {
        if (!dueAt) {
          setError("Choose a due date for the credit balance.");
          setSubmitting(false);
          return;
        }
        const response = await authorizeInvoiceCredit(invoice.id, { dueAt, note: note.trim() || undefined });
        onChanged(response.item);
        setOpen(false);
        toast.success("Released on credit", {
          description: `${formatMoney(balance)} due by ${formatDate(dueAt)}. Medicine can go to pharmacy.`,
        });
        return;
      }

      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        setError("Enter a payment amount greater than zero.");
        setSubmitting(false);
        return;
      }
      if (mode === "full" && Math.abs(value - balance) > 0.001) {
        setError("Full payment must equal the outstanding balance.");
        setSubmitting(false);
        return;
      }
      if (mode === "partial" && value >= balance) {
        setError("Partial payment must be less than the outstanding balance. Use Pay in full instead.");
        setSubmitting(false);
        return;
      }
      if (value > balance) {
        setError("Payment cannot exceed the outstanding balance.");
        setSubmitting(false);
        return;
      }
      if (method !== "cash" && !reference.trim()) {
        setError("Enter a transaction or payment reference for non-cash payments.");
        setSubmitting(false);
        return;
      }

      const response = await collectInvoicePayment(invoice.id, {
        amount: value,
        method,
        reference: reference.trim() || undefined,
      });
      onChanged(response.item);
      setOpen(false);
      toast.success(mode === "full" ? "Invoice paid in full" : "Partial payment recorded", {
        description:
          mode === "full"
            ? `${formatMoney(value)} received. Medicine can go to pharmacy.`
            : `${formatMoney(value)} received. Medicine stays held until the balance is cleared.`,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The settlement could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-base font-semibold text-warning-text">
            {alreadyOnCredit ? "Collect remaining balance" : "Settle invoice"}
          </h2>
          <p className="mt-1 text-sm text-warning-text">
            Outstanding balance: <strong>{formatMoney(balance)}</strong>
            {alreadyOnCredit && invoice.due_at ? ` · due ${formatDate(invoice.due_at)}` : ""}
          </p>
        </div>
        <Dialog open={open} onOpenChange={resetForm}>
          <DialogTrigger asChild>
            <Button type="button" className="min-h-11 gap-2">
              <Banknote className="size-4" aria-hidden="true" />
              {alreadyOnCredit ? "Collect balance" : "Settle payment"}
            </Button>
          </DialogTrigger>
          <DialogContent className="gap-4 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Settle invoice</DialogTitle>
              <DialogDescription>
                Full and credit release medicine; partial holds it until paid.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Settlement mode</legend>
                <div className={`grid gap-2 ${alreadyOnCredit ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${mode === "full" ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                    <input type="radio" name="settlement-mode" className="mt-0.5 shrink-0" checked={mode === "full"} onChange={() => applyMode("full")} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Pay in full</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">Collect {formatMoney(balance)}. Meds released.</span>
                    </span>
                  </label>
                  <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${mode === "partial" ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                    <input type="radio" name="settlement-mode" className="mt-0.5 shrink-0" checked={mode === "partial"} onChange={() => applyMode("partial")} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">Partial</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">Pay some now. Meds held.</span>
                    </span>
                  </label>
                  {!alreadyOnCredit ? (
                    <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 ${mode === "credit" ? "border-primary bg-primary/5" : "border-border bg-background"}`}>
                      <input type="radio" name="settlement-mode" className="mt-0.5 shrink-0" checked={mode === "credit"} onChange={() => applyMode("credit")} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">On credit</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-fg-muted">Release now. Balance due later.</span>
                      </span>
                    </label>
                  ) : null}
                </div>
              </fieldset>

              {mode === "credit" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="credit-due-at">Due date *</Label>
                      <Input id="credit-due-at" type="date" min={todayInputDate()} className="mt-1 min-h-10" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="credit-note">Note (optional)</Label>
                      <Input id="credit-note" className="mt-1 min-h-10" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Pays Friday" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>Balance on credit</span>
                      <strong className="font-mono tabular-nums">{formatMoney(balance)}</strong>
                    </div>
                    <p className="mt-1 text-[11px] text-fg-muted">No money recorded now. Stock can still deduct when pharmacy fulfills.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="payment-amount">Amount received *</Label>
                      <Input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        max={balance}
                        step="0.01"
                        className="mt-1 min-h-10"
                        value={amount}
                        disabled={mode === "full"}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-method">Payment method *</Label>
                      <Select value={method} onValueChange={(value) => setMethod(value as PayMethod)}>
                        <SelectTrigger id="payment-method" className="mt-1 min-h-10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card / POS</SelectItem>
                          <SelectItem value="mobile_money">Mobile money</SelectItem>
                          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {method !== "cash" ? (
                    <div>
                      <Label htmlFor="payment-reference">Transaction reference *</Label>
                      <Input id="payment-reference" className="mt-1 min-h-10" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Provider or bank reference" />
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>Payment to record</span>
                      <strong className="font-mono tabular-nums">{formatMoney(Number(amount) || 0)}</strong>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-fg-secondary">
                      <span>Remaining afterward</span>
                      <span className="font-mono tabular-nums">{formatMoney(Math.max(0, balance - (Number(amount) || 0)))}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-fg-muted">
                      {mode === "full" ? "Medicine will be released after confirmation." : "Medicine stays held until the invoice is paid in full."}
                    </p>
                  </div>
                </>
              )}

              {error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" disabled={submitting} onClick={() => void collect()}>
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : mode === "credit" ? <CreditCard className="size-4" aria-hidden="true" /> : method === "mobile_money" ? <Smartphone className="size-4" aria-hidden="true" /> : <Banknote className="size-4" aria-hidden="true" />}
                {submitting ? "Saving…" : mode === "credit" ? "Release on credit" : "Confirm payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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


