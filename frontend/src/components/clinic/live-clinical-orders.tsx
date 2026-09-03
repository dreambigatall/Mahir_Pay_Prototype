"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pill, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import {
  createPrescription,
  getVisitPrescriptions,
  listCatalog,
  type CatalogItem,
  type Prescription,
} from "@/lib/api/clinical";

export function LiveClinicalOrders({
  visitId,
  encounterId,
  readOnly,
}: {
  visitId: string;
  encounterId: string;
  readOnly: boolean;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [drugs, medicines] = await Promise.all([listCatalog("drug"), getVisitPrescriptions(visitId)]);
      setCatalog(drugs.items);
      setPrescriptions(medicines.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Clinical orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" className="min-h-10 gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          Refresh
        </Button>
      </div>
      {error ? (
        <div role="alert" className="rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="flex min-h-24 items-center justify-center text-sm text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
          Loading…
        </div>
      ) : (
        <PrescriptionPanel
          encounterId={encounterId}
          catalog={catalog.filter((item) => item.item_type === "drug")}
          prescriptions={prescriptions}
          readOnly={readOnly}
          onChanged={load}
        />
      )}
    </section>
  );
}

function PrescriptionPanel({
  encounterId,
  catalog,
  prescriptions,
  readOnly,
  onChanged,
}: {
  encounterId: string;
  catalog: CatalogItem[];
  prescriptions: Prescription[];
  readOnly: boolean;
  onChanged: () => Promise<void>;
}) {
  const [drugId, setDrugId] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedDrug = useMemo(() => catalog.find((item) => item.id === drugId), [catalog, drugId]);

  async function prescribe() {
    if (!drugId || !dosage.trim() || !frequency.trim() || !duration.trim() || Number(quantity) <= 0) {
      setError("Medication, dosage, frequency, duration, and a positive quantity are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createPrescription({
        encounterId,
        items: [
          {
            catalogItemId: drugId,
            dosage: dosage.trim(),
            frequency: frequency.trim(),
            duration: duration.trim(),
            instructions: instructions.trim() || undefined,
            quantity: Number(quantity),
          },
        ],
      });
      setDrugId("");
      setDosage("");
      setFrequency("");
      setDuration("");
      setQuantity("1");
      setInstructions("");
      toast.success("Medication prescribed", { description: selectedDrug?.name });
      await onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The prescription could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Pill className="size-4 text-warning-fill" aria-hidden="true" />
        Medication
      </h4>
      {!readOnly ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3">
          <div>
            <Label htmlFor="prescription-drug">Medication *</Label>
            <Select value={drugId} onValueChange={setDrugId}>
              <SelectTrigger id="prescription-drug" className="mt-1 min-h-10">
                <SelectValue placeholder={catalog.length ? "Select medication" : "No active medication catalog"} />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                    {item.unit ? ` · ${item.unit}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="rx-dose" label="Dosage *" value={dosage} onChange={setDosage} placeholder="e.g. 500 mg" />
            <Field id="rx-frequency" label="Frequency *" value={frequency} onChange={setFrequency} placeholder="e.g. twice daily" />
            <Field id="rx-duration" label="Duration *" value={duration} onChange={setDuration} placeholder="e.g. 5 days" />
            <Field id="rx-quantity" label="Quantity *" value={quantity} onChange={setQuantity} placeholder="1" type="number" />
          </div>
          <Field id="rx-instructions" label="Instructions" value={instructions} onChange={setInstructions} placeholder="e.g. take after food" />
          {error ? <p role="alert" className="text-xs text-danger-text">{error}</p> : null}
          <Button type="button" size="sm" className="min-h-10" disabled={submitting || !catalog.length} onClick={() => void prescribe()}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Prescribing…" : "Add prescription"}
          </Button>
        </div>
      ) : null}
      {prescriptions.length ? (
        <div className="mt-3 space-y-2">
          {prescriptions.flatMap((rx) =>
            rx.items.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{item.drug_name}</p>
                  <span className="text-xs capitalize text-fg-muted">{rx.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-1 text-fg-secondary">
                  {item.dosage} · {item.frequency} · {item.duration}
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  Quantity {item.quantity_prescribed}
                  {item.instructions ? ` · ${item.instructions}` : ""}
                </p>
              </article>
            )),
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">No medication has been prescribed for this visit.</p>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1 min-h-10"
        type={type}
        min={type === "number" ? "0.001" : undefined}
        step={type === "number" ? "0.001" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
