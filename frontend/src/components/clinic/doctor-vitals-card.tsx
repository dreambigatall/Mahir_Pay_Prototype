"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import type { TriageObservation } from "@/lib/api/clinical";
import { saveVisitVitals } from "@/lib/api/workflow";
import { cn } from "@/lib/utils";

export type VitalsData = {
  bp: string;
  temp: string;
  pulse: string;
  spo2: string;
  weight: string;
  height: string;
};

export function triageToVitals(triage: TriageObservation | null | undefined): Partial<VitalsData> {
  if (!triage) return {};
  return {
    bp: triage.systolic_bp && triage.diastolic_bp ? `${triage.systolic_bp}/${triage.diastolic_bp}` : "",
    temp: triage.temperature_c ?? "",
    pulse: triage.pulse_bpm != null ? String(triage.pulse_bpm) : "",
    spo2: triage.oxygen_saturation ?? "",
    weight: triage.weight_kg ?? "",
    height: triage.height_cm ?? "",
  };
}

export function vitalsToPayload(vitals: VitalsData) {
  const payload: Record<string, number> = {};
  const bpMatch = vitals.bp.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (bpMatch) {
    payload.systolicBp = Number(bpMatch[1]);
    payload.diastolicBp = Number(bpMatch[2]);
  }
  if (vitals.temp.trim()) payload.temperatureC = Number(vitals.temp);
  if (vitals.pulse.trim()) payload.pulseBpm = Number(vitals.pulse);
  if (vitals.spo2.trim()) payload.oxygenSaturation = Number(vitals.spo2);
  if (vitals.weight.trim()) payload.weightKg = Number(vitals.weight);
  if (vitals.height.trim()) payload.heightCm = Number(vitals.height);
  return payload;
}

function splitBp(bp: string): [string, string] {
  const match = bp.match(/^(\d*)\s*\/\s*(\d*)$/);
  if (!match) return ["", ""];
  return [match[1] ?? "", match[2] ?? ""];
}

export function DoctorVitalsCard({
  visitId,
  triage,
  readOnly = false,
  onSaved,
}: {
  visitId: string;
  triage: TriageObservation | null;
  readOnly?: boolean;
  onSaved?: () => void | Promise<void>;
}) {
  const [vitals, setVitals] = useState<VitalsData>({
    bp: "",
    temp: "",
    pulse: "",
    spo2: "",
    weight: "",
    height: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const mapped = triageToVitals(triage);
    setVitals({
      bp: mapped.bp ?? "",
      temp: mapped.temp ?? "",
      pulse: mapped.pulse ?? "",
      spo2: mapped.spo2 ?? "",
      weight: mapped.weight ?? "",
      height: mapped.height ?? "",
    });
  }, [triage]);

  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100;
    if (w > 0 && h > 0) return (w / (h * h)).toFixed(1);
    return null;
  }, [vitals.weight, vitals.height]);

  const [bpSystolic, bpDiastolic] = useMemo(() => splitBp(vitals.bp), [vitals.bp]);

  const flags = useMemo(() => {
    const tempNum = parseFloat(vitals.temp);
    const feverish = tempNum >= 38.0;
    const hypothermic = tempNum < 35.5 && tempNum > 0;

    const spo2Num = parseFloat(vitals.spo2);
    const lowSpo2 = spo2Num <= 94 && spo2Num > 0;

    let bpAbnormal = false;
    if (bpSystolic && bpDiastolic) {
      const sys = parseInt(bpSystolic, 10);
      const dia = parseInt(bpDiastolic, 10);
      bpAbnormal = sys >= 140 || dia >= 90 || sys < 90 || dia < 60;
    }

    const alerts: string[] = [];
    if (feverish) alerts.push(`Fever (${vitals.temp}°C)`);
    else if (hypothermic) alerts.push(`Hypothermia (${vitals.temp}°C)`);
    if (lowSpo2) alerts.push(`Low SpO2 (${vitals.spo2}%)`);
    if (bpAbnormal) alerts.push(`Abnormal BP (${bpSystolic}/${bpDiastolic})`);

    return {
      temp: feverish || hypothermic,
      spo2: lowSpo2,
      bp: bpAbnormal,
      alerts,
    };
  }, [vitals.temp, vitals.spo2, bpSystolic, bpDiastolic]);

  function updateField(key: keyof VitalsData, val: string) {
    setVitals((prev) => ({ ...prev, [key]: val }));
  }

  function updateBp(part: "systolic" | "diastolic", value: string) {
    const digits = value.replace(/\D/g, "");
    const next = part === "systolic" ? `${digits}/${bpDiastolic}` : `${bpSystolic}/${digits}`;
    updateField("bp", next);
  }

  async function save() {
    const payload = vitalsToPayload(vitals);
    if (!Object.keys(payload).length) {
      setError("Enter at least one vital sign before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveVisitVitals(visitId, payload);
      toast.success("Vital signs saved");
      await onSaved?.();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Vital signs could not be saved.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="size-5 text-clinical-fill" aria-hidden="true" />
          <h2 className="text-base font-semibold tracking-tight">Triage & vital signs</h2>
        </div>
        {flags.alerts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {flags.alerts.map((alert) => (
              <span key={alert} className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-medium text-danger-text">
                <AlertCircle className="size-3" aria-hidden="true" />
                {alert}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <FormGroup eyebrow="Cardiopulmonary">
          <div className="grid grid-cols-2 gap-3">
            <BloodPressureField
              systolic={bpSystolic}
              diastolic={bpDiastolic}
              readOnly={readOnly}
              abnormal={flags.bp}
              onSystolicChange={(v) => updateBp("systolic", v)}
              onDiastolicChange={(v) => updateBp("diastolic", v)}
            />
            <VitalField label="Temperature" id="vitals-temp" unit="°C" placeholder="36.8" value={vitals.temp} readOnly={readOnly} abnormal={flags.temp} onChange={(v) => updateField("temp", v)} />
            <VitalField label="Pulse rate" id="vitals-pulse" unit="bpm" placeholder="72" value={vitals.pulse} readOnly={readOnly} onChange={(v) => updateField("pulse", v)} />
            <VitalField label="SpO2" id="vitals-spo2" unit="%" placeholder="98" value={vitals.spo2} readOnly={readOnly} abnormal={flags.spo2} onChange={(v) => updateField("spo2", v)} />
          </div>
        </FormGroup>

        <FormGroup eyebrow="Body">
          <div className="grid grid-cols-2 gap-3">
            <VitalField label="Weight" id="vitals-weight" unit="kg" placeholder="68" value={vitals.weight} readOnly={readOnly} onChange={(v) => updateField("weight", v)} />
            <VitalField label="Height" id="vitals-height" unit="cm" placeholder="170" value={vitals.height} readOnly={readOnly} onChange={(v) => updateField("height", v)} />
          </div>
          {bmi ? (
            <div className="flex items-center gap-3 text-[13px] text-fg-secondary">
              <span>Calculated BMI: <strong className="font-mono text-foreground">{bmi} kg/m²</strong></span>
              <span className="text-fg-muted">·</span>
              <span>
                {parseFloat(bmi) < 18.5 ? "Underweight" : parseFloat(bmi) <= 24.9 ? "Normal weight" : parseFloat(bmi) <= 29.9 ? "Overweight" : "Obese"}
              </span>
            </div>
          ) : null}
        </FormGroup>
      </div>

      {triage?.recorded_by_name ? (
        <p className="mt-4 text-xs text-fg-muted">Last recorded by {triage.recorded_by_name}</p>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-danger-text">{error}</p> : null}

      {!readOnly ? (
        <div className="mt-5 flex justify-end">
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Save vitals"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function VitalField({
  label,
  id,
  unit,
  placeholder,
  value,
  readOnly,
  abnormal,
  onChange,
}: {
  label: string;
  id: string;
  unit: string;
  placeholder: string;
  value: string;
  readOnly: boolean;
  abnormal?: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <Label htmlFor={id} className="font-medium text-foreground">
          {label}
          {abnormal ? <AlertCircle className="size-3 text-danger-text" aria-hidden="true" /> : null}
        </Label>
        <span className="font-mono text-[11px] text-fg-muted">{unit}</span>
      </div>
      <Input
        id={id}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={abnormal ? true : undefined}
        className={cn("h-9 bg-background font-mono text-[13px] tabular-nums", abnormal && "border-danger-fill/60 ring-1 ring-danger-bg")}
      />
    </div>
  );
}

function BloodPressureField({
  systolic,
  diastolic,
  readOnly,
  abnormal,
  onSystolicChange,
  onDiastolicChange,
}: {
  systolic: string;
  diastolic: string;
  readOnly: boolean;
  abnormal?: boolean;
  onSystolicChange: (val: string) => void;
  onDiastolicChange: (val: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <Label htmlFor="vitals-bp-systolic" className="font-medium text-foreground">
          Blood pressure
          {abnormal ? <AlertCircle className="size-3 text-danger-text" aria-hidden="true" /> : null}
        </Label>
        <span className="font-mono text-[11px] text-fg-muted">mmHg</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          id="vitals-bp-systolic"
          inputMode="numeric"
          value={systolic}
          readOnly={readOnly}
          onChange={(e) => onSystolicChange(e.target.value)}
          placeholder="120"
          aria-label="Systolic"
          aria-invalid={abnormal ? true : undefined}
          className={cn("h-9 bg-background text-center font-mono text-[13px] tabular-nums", abnormal && "border-danger-fill/60 ring-1 ring-danger-bg")}
        />
        <span className="shrink-0 text-fg-muted">/</span>
        <Input
          id="vitals-bp-diastolic"
          inputMode="numeric"
          value={diastolic}
          readOnly={readOnly}
          onChange={(e) => onDiastolicChange(e.target.value)}
          placeholder="80"
          aria-label="Diastolic"
          aria-invalid={abnormal ? true : undefined}
          className={cn("h-9 bg-background text-center font-mono text-[13px] tabular-nums", abnormal && "border-danger-fill/60 ring-1 ring-danger-bg")}
        />
      </div>
    </div>
  );
}
