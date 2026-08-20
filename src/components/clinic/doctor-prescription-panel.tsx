"use client";

import { useState } from "react";
import { Pill, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney } from "@/lib/format";

const frequencyOptions = [
  { value: "TDS", label: "TDS · 3 times a day" },
  { value: "BD", label: "BD · 2 times a day" },
  { value: "OD", label: "OD · Once daily" },
  { value: "QDS", label: "QDS · 4 times a day" },
  { value: "PRN", label: "PRN · As needed" },
  { value: "STAT", label: "STAT · Immediately once" },
];

export function DoctorPrescriptionPanel({ visitId }: { visitId: string }) {
  const { drugs, prescriptions, addPrescription, removePrescription } = useClinic();
  const visitPrescriptions = prescriptions.filter((rx) => rx.visitId === visitId);

  const [selectedDrugId, setSelectedDrugId] = useState<string>("");
  const [dosage, setDosage] = useState("1 tablet");
  const [frequency, setFrequency] = useState("TDS");
  const [duration, setDuration] = useState("5 days");
  const [instructions, setInstructions] = useState("After meals");

  function handleAdd() {
    const drug = drugs.find((d) => d.id === selectedDrugId);
    if (!drug) {
      toast.error("Please select a medication from the catalog.");
      return;
    }

    addPrescription({
      visitId,
      drugId: drug.id,
      drugName: drug.name,
      dosage: dosage.trim() || "1 dose",
      frequency,
      duration: duration.trim() || "5 days",
      instructions: instructions.trim(),
    });

    toast.success(`Prescribed ${drug.name}`, {
      description: `${dosage} ${frequency} for ${duration}.`,
    });

    setSelectedDrugId("");
    setInstructions("After meals");
  }

  return (
    <div className="space-y-4">
      {/* Prescription Add Form */}
      <div className="rounded-xl border border-border bg-surface-1/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Pill className="size-4 text-warning-fill" />
          <h4 className="text-[14px] font-semibold text-foreground">
            Prescribe medication
          </h4>
        </div>

        {drugs.length === 0 ? (
          <p className="text-[13px] text-fg-muted">
            No active medications in clinic catalog. Ask Admin to add drugs.
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-[12px] font-normal text-fg-secondary">
                Select medication from catalog
              </Label>
              <Select value={selectedDrugId} onValueChange={setSelectedDrugId}>
                <SelectTrigger className="h-9 w-full bg-surface-2 text-[13px]">
                  <SelectValue placeholder="Choose a drug…" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.map((drug) => (
                    <SelectItem key={drug.id} value={drug.id}>
                      <span className="font-medium">{drug.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-fg-muted">
                        ({formatMoney(drug.price)})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-1">
                <Label htmlFor="rx-dosage" className="text-[12px] font-normal text-fg-secondary">
                  Dosage
                </Label>
                <Input
                  id="rx-dosage"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g. 500mg or 1 tab"
                  className="h-9 bg-surface-2 text-[13px]"
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-[12px] font-normal text-fg-secondary">
                  Frequency
                </Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger className="h-9 bg-surface-2 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label htmlFor="rx-duration" className="text-[12px] font-normal text-fg-secondary">
                  Duration
                </Label>
                <Input
                  id="rx-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 5 days"
                  className="h-9 bg-surface-2 text-[13px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 grid gap-1">
                <Input
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Special instructions (e.g. Take with food, finish course)…"
                  className="h-9 bg-surface-2 text-[13px]"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                disabled={!selectedDrugId}
                className="gap-1.5 shrink-0"
              >
                <Plus className="size-3.5" />
                Add to prescription
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Active Prescriptions List */}
      <div>
        <p className="text-[13px] font-medium text-foreground mb-2">
          Prescription item list ({visitPrescriptions.length})
        </p>

        {visitPrescriptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-[13px] text-fg-muted">
            No medications prescribed for this visit yet.
          </div>
        ) : (
          <div className="space-y-2">
            {visitPrescriptions.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-foreground">
                      {rx.drugName}
                    </p>
                    <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[11px] text-fg-secondary border border-border">
                      {rx.dosage} · {rx.frequency} · {rx.duration}
                    </span>
                  </div>
                  {rx.instructions && (
                    <p className="text-[12px] text-fg-muted mt-0.5">
                      Instructions: {rx.instructions}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removePrescription(rx.id);
                    toast.success("Prescription item removed");
                  }}
                  className="size-8 text-fg-muted hover:text-danger-text shrink-0 ml-2"
                  aria-label={`Remove ${rx.drugName}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
