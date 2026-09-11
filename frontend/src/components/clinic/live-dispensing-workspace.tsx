"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { listCatalog, type CatalogItem } from "@/lib/api/clinical";
import { dispensePrescription, getPharmacyPrescription, type PharmacyPrescription } from "@/lib/api/pharmacy";

export function LiveDispensingWorkspace({ prescriptionId }: { prescriptionId: string }) {
  const [prescription, setPrescription] = useState<PharmacyPrescription | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rxResponse, drugs] = await Promise.all([getPharmacyPrescription(prescriptionId), listCatalog("drug")]);
      const found = rxResponse.item;
      setPrescription(found); setCatalog(drugs.items);
      setQuantities(Object.fromEntries(found.items.map((item) => {
        const remaining = Math.max(0, Number(item.quantity_prescribed) - Number(item.quantity_dispensed));
        const drug = drugs.items.find((entry) => entry.id === item.catalog_item_id);
        const available = drug?.track_inventory ? Number(drug.quantity_on_hand ?? 0) : remaining;
        return [item.id, String(Math.min(remaining, Math.max(0, available)))];
      })));
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "The prescription could not be loaded."); setPrescription(null); }
    finally { setLoading(false); }
  }, [prescriptionId]);

  useEffect(() => { void load(); }, [load]);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const validation = useMemo(() => {
    if (!prescription) return { items: [], errors: [] as string[] };
    const errors: string[] = [];
    const items = prescription.items.flatMap((item) => {
      const raw = quantities[item.id] ?? "0"; const quantity = Number(raw);
      if (!Number.isFinite(quantity) || quantity < 0) { errors.push(`${item.drug_name}: enter a valid non-negative quantity.`); return []; }
      if (quantity === 0) return [];
      const remaining = Number(item.quantity_prescribed) - Number(item.quantity_dispensed);
      if (quantity > remaining) errors.push(`${item.drug_name}: only ${remaining} remains on the prescription.`);
      const drug = catalogById.get(item.catalog_item_id);
      if (drug?.track_inventory && quantity > Number(drug.quantity_on_hand ?? 0)) errors.push(`${item.drug_name}: only ${Number(drug.quantity_on_hand ?? 0)} is in stock.`);
      return [{ prescriptionItemId: item.id, quantity }];
    });
    if (!items.length) errors.push("Enter a quantity for at least one medicine.");
    return { items, errors };
  }, [catalogById, prescription, quantities]);

  async function submit() {
    if (!prescription || validation.errors.length) return;
    setSubmitting(true); setError("");
    try {
      const result = await dispensePrescription(prescription.id, validation.items, notes.trim() || undefined);
      setConfirming(false); setPrescription(result.item);
      toast.success(result.item.status === "dispensed" ? "Prescription fully dispensed" : "Partial dispense recorded", { description: "Stock and the patient record were updated." });
      if (result.item.status !== "dispensed") await load();
    } catch (caught) { setConfirming(false); setError(caught instanceof ApiError ? caught.message : "Dispensing could not be completed."); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center text-sm text-fg-muted"><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />Loading prescription…</div>;
  if (!prescription) return <div className="space-y-4 rounded-xl border border-dashed border-border p-10 text-center"><PackageCheck className="mx-auto size-8 text-fg-muted" aria-hidden="true" /><div><p className="font-medium">Prescription not found</p><p className="mt-1 text-sm text-fg-muted">{error || "It may already be fully dispensed or cancelled."}</p></div><Button asChild variant="outline"><Link href="/pharmacy">Return to pharmacy</Link></Button></div>;
  if (prescription.status === "dispensed") return <div className="space-y-4 rounded-xl border border-success-fill/30 bg-success-fill/10 p-8 text-center"><CheckCircle2 className="mx-auto size-10 text-success-text" aria-hidden="true" /><div><p className="font-semibold">Prescription fully dispensed</p><p className="mt-1 text-sm text-fg-secondary">The pharmacy queue and eligible visit were completed.</p></div><Button asChild><Link href="/pharmacy">Back to worklist</Link></Button></div>;

  const awaitingPayment = prescription.status === "awaiting_payment";

  return <div className="space-y-5">
    <Button asChild variant="ghost" className="min-h-10"><Link href="/pharmacy"><ArrowLeft className="size-4" aria-hidden="true" />Back to worklist</Link></Button>
    <section className="rounded-xl border border-border bg-surface-2 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold">{prescription.patient_name}</h2><p className="mt-1 text-sm text-fg-muted">{prescription.visit_number} · Prescribed by {prescription.prescriber_name}</p></div><span className="rounded-full bg-warning-fill/10 px-3 py-1 text-xs font-semibold capitalize text-warning-text">{prescription.status.replaceAll("_", " ")}</span></div>{prescription.notes ? <p className="mt-4 rounded-lg bg-background p-3 text-sm text-fg-secondary">Prescriber note: {prescription.notes}</p> : null}</section>
    {awaitingPayment ? <div role="status" className="rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-4 text-sm text-warning-text"><p className="font-semibold">Waiting for reception payment</p><p className="mt-1">You can review the medicines now. Dispense unlocks only after the invoice is paid in full.</p></div> : null}
    {error ? <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div> : null}
    <section className="space-y-3"><div><h2 className="font-heading text-lg font-semibold">{awaitingPayment ? "Medicines prescribed" : "Medicines to dispense"}</h2><p className="text-sm text-fg-muted">{awaitingPayment ? "Read-only preview until payment is collected." : "Set a quantity to zero to leave it for a later partial dispense."}</p></div>{prescription.items.map((item) => {
      const remaining = Math.max(0, Number(item.quantity_prescribed) - Number(item.quantity_dispensed)); const drug = catalogById.get(item.catalog_item_id); const tracked = Boolean(drug?.track_inventory); const stock = Number(drug?.quantity_on_hand ?? 0);
      return <article key={item.id} className="rounded-xl border border-border bg-surface-2 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.drug_name}</h3><p className="mt-1 text-sm text-fg-secondary">{item.dosage} · {item.frequency} · {item.duration}</p>{item.instructions ? <p className="mt-1 text-xs text-fg-muted">{item.instructions}</p> : null}</div><div className="text-right text-xs text-fg-muted"><p>Prescribed <strong className="font-mono text-foreground">{Number(item.quantity_prescribed)}</strong></p><p>Already dispensed <strong className="font-mono text-foreground">{Number(item.quantity_dispensed)}</strong></p></div></div><div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">{awaitingPayment ? null : <div><Label htmlFor={`quantity-${item.id}`}>Dispense now</Label><Input id={`quantity-${item.id}`} className="mt-1 min-h-11" type="number" min="0" max={remaining} step="0.001" value={quantities[item.id] ?? "0"} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></div>}<div className="rounded-lg bg-background p-3 text-sm"><p className="text-xs text-fg-muted">Availability</p><p className="mt-1 font-medium">{remaining} remaining · {tracked ? `${stock} in stock` : "Inventory not tracked"}</p>{tracked && stock < remaining ? <p className="mt-1 flex items-center gap-1 text-xs text-warning-text"><TriangleAlert className="size-3.5" aria-hidden="true" />{awaitingPayment ? "Stock may be short when payment clears" : "Partial dispense may be required"}</p> : null}</div></div></article>;
    })}</section>
    {awaitingPayment ? null : <>
    <section className="rounded-xl border border-border bg-surface-2 p-5"><Label htmlFor="dispense-notes">Dispensing notes</Label><Textarea id="dispense-notes" className="mt-1" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Substitution, counselling, or partial supply note (optional)" />{validation.errors.length ? <div role="alert" className="mt-3 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">{validation.errors.map((message) => <p key={message}>{message}</p>)}</div> : null}<Button type="button" className="mt-4 min-h-11 gap-2" disabled={Boolean(validation.errors.length) || submitting} onClick={() => setConfirming(true)}><ShieldCheck className="size-4" aria-hidden="true" />Review and confirm dispense</Button></section>
    <Dialog open={confirming} onOpenChange={(open) => !submitting && setConfirming(open)}><DialogContent><DialogHeader><DialogTitle>Confirm medication dispense</DialogTitle><DialogDescription>Use this only for prescriptions still waiting after payment (for example short stock). Confirming records dispensing and reduces any remaining tracked inventory.</DialogDescription></DialogHeader><div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">{validation.items.map((request) => { const item = prescription.items.find((entry) => entry.id === request.prescriptionItemId)!; return <div key={item.id} className="flex justify-between gap-4"><span>{item.drug_name}</span><strong className="font-mono tabular-nums">{request.quantity}</strong></div>; })}</div><DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={() => setConfirming(false)}>Cancel</Button><Button type="button" disabled={submitting} onClick={() => void submit()}>{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitting ? "Dispensing…" : "Confirm dispense"}</Button></DialogFooter></DialogContent></Dialog>
    </>}
  </div>;
}
