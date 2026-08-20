"use client";

import { useMemo, useState } from "react";
import { Activity, AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type VitalsData = {
  bp: string;
  temp: string;
  pulse: string;
  spo2: string;
  weight: string;
  height: string;
};

export function DoctorVitalsCard({
  initialVitals = {
    bp: "120/80",
    temp: "37.2",
    pulse: "76",
    spo2: "98",
    weight: "68",
    height: "170",
  },
}: {
  initialVitals?: Partial<VitalsData>;
}) {
  const [vitals, setVitals] = useState<VitalsData>({
    bp: initialVitals.bp ?? "",
    temp: initialVitals.temp ?? "",
    pulse: initialVitals.pulse ?? "",
    spo2: initialVitals.spo2 ?? "",
    weight: initialVitals.weight ?? "",
    height: initialVitals.height ?? "",
  });

  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100;
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return null;
  }, [vitals.weight, vitals.height]);

  // Clinical risk thresholds
  const alerts = useMemo(() => {
    const list: string[] = [];
    const tempNum = parseFloat(vitals.temp);
    if (tempNum >= 38.0) list.push(`Fever (${vitals.temp}°C)`);
    else if (tempNum < 35.5 && tempNum > 0) list.push(`Hypothermia (${vitals.temp}°C)`);

    const spo2Num = parseFloat(vitals.spo2);
    if (spo2Num <= 94 && spo2Num > 0) list.push(`Low SpO2 (${vitals.spo2}%)`);

    const bpMatch = vitals.bp.match(/^(\d+)\/(\d+)$/);
    if (bpMatch) {
      const sys = parseInt(bpMatch[1], 10);
      const dia = parseInt(bpMatch[2], 10);
      if (sys >= 140 || dia >= 90) list.push(`Elevated BP (${vitals.bp})`);
      else if (sys < 90 || dia < 60) list.push(`Low BP (${vitals.bp})`);
    }

    return list;
  }, [vitals.temp, vitals.spo2, vitals.bp]);

  function updateField(key: keyof VitalsData, val: string) {
    setVitals((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-clinical-fill" />
          <h3 className="text-[15px] font-semibold text-foreground">
            Triage & vital signs
          </h3>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {alerts.map((alert) => (
              <span
                key={alert}
                className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2.5 py-0.5 text-[11px] font-medium text-danger-text"
              >
                <AlertCircle className="size-3" />
                {alert}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3.5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <VitalField
          label="Blood pressure"
          id="vitals-bp"
          unit="mmHg"
          placeholder="120/80"
          value={vitals.bp}
          onChange={(v) => updateField("bp", v)}
        />
        <VitalField
          label="Temperature"
          id="vitals-temp"
          unit="°C"
          placeholder="36.8"
          value={vitals.temp}
          onChange={(v) => updateField("temp", v)}
        />
        <VitalField
          label="Pulse rate"
          id="vitals-pulse"
          unit="bpm"
          placeholder="72"
          value={vitals.pulse}
          onChange={(v) => updateField("pulse", v)}
        />
        <VitalField
          label="SpO2"
          id="vitals-spo2"
          unit="%"
          placeholder="98"
          value={vitals.spo2}
          onChange={(v) => updateField("spo2", v)}
        />
        <VitalField
          label="Weight"
          id="vitals-weight"
          unit="kg"
          placeholder="68"
          value={vitals.weight}
          onChange={(v) => updateField("weight", v)}
        />
        <VitalField
          label="Height"
          id="vitals-height"
          unit="cm"
          placeholder="170"
          value={vitals.height}
          onChange={(v) => updateField("height", v)}
        />
      </div>

      {bmi && (
        <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2.5 text-[12px] text-fg-secondary">
          <span>
            Calculated BMI:{" "}
            <strong className="font-mono text-foreground">{bmi} kg/m²</strong>
          </span>
          <span className="text-fg-muted">·</span>
          <span>
            {parseFloat(bmi) < 18.5
              ? "Underweight"
              : parseFloat(bmi) <= 24.9
                ? "Normal weight"
                : parseFloat(bmi) <= 29.9
                  ? "Overweight"
                  : "Obese"}
          </span>
        </div>
      )}
    </div>
  );
}

function VitalField({
  label,
  id,
  unit,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  id: string;
  unit: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between text-[12px]">
        <Label htmlFor={id} className="font-normal text-fg-secondary">
          {label}
        </Label>
        <span className="font-mono text-[11px] text-fg-muted">{unit}</span>
      </div>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 font-mono text-[13px] tabular-nums"
      />
    </div>
  );
}
