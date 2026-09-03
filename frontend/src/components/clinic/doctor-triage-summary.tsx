import { Activity, AlertTriangle } from "lucide-react";

import type { TriageObservation } from "@/lib/api/clinical";

export function DoctorTriageSummary({ triage }: { triage: TriageObservation | null }) {
  if (!triage) return <section className="rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-warning-text"><AlertTriangle className="size-4" aria-hidden="true" />Triage observations</h2><p className="mt-2 text-sm text-warning-text">No triage observations were recorded for this visit.</p></section>;

  const bmi = triage.weight_kg && triage.height_cm ? Number(triage.weight_kg) / ((Number(triage.height_cm) / 100) ** 2) : null;
  const alerts = clinicalAlerts(triage);
  const values = [
    ["Blood pressure", triage.systolic_bp && triage.diastolic_bp ? `${triage.systolic_bp}/${triage.diastolic_bp} mmHg` : "Not recorded"],
    ["Temperature", triage.temperature_c ? `${triage.temperature_c} °C` : "Not recorded"],
    ["Pulse", triage.pulse_bpm ? `${triage.pulse_bpm} bpm` : "Not recorded"],
    ["SpO₂", triage.oxygen_saturation ? `${triage.oxygen_saturation}%` : "Not recorded"],
    ["Respiration", triage.respiratory_rate ? `${triage.respiratory_rate}/min` : "Not recorded"],
    ["Pain score", triage.pain_score === null ? "Not recorded" : `${triage.pain_score}/10`],
    ["Weight / height", [triage.weight_kg ? `${triage.weight_kg} kg` : null, triage.height_cm ? `${triage.height_cm} cm` : null].filter(Boolean).join(" · ") || "Not recorded"],
    ["BMI", bmi ? bmi.toFixed(1) : "Not available"],
  ];

  return <section className="rounded-xl border border-border bg-surface-2 p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-clinical-fill" aria-hidden="true" />Triage & vital signs</h2>{alerts.length ? <div role="alert" className="mt-3 space-y-1 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-xs font-medium text-danger-text">{alerts.map((alert) => <p key={alert}>{alert}</p>)}</div> : null}<dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">{values.map(([label, value]) => <div key={label}><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-1 font-medium tabular-nums">{value}</dd></div>)}</dl>{triage.notes ? <div className="mt-4 border-t border-border/60 pt-3"><p className="text-xs text-fg-muted">Triage notes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{triage.notes}</p></div> : null}<p className="mt-3 text-xs text-fg-muted">Recorded by {triage.recorded_by_name}</p></section>;
}

function clinicalAlerts(value: TriageObservation) {
  const alerts: string[] = [];
  const temp = Number(value.temperature_c);
  const oxygen = Number(value.oxygen_saturation);
  if (temp >= 38) alerts.push(`Fever: ${temp} °C`);
  if (temp > 0 && temp < 35.5) alerts.push(`Low temperature: ${temp} °C`);
  if (oxygen > 0 && oxygen <= 94) alerts.push(`Low oxygen saturation: ${oxygen}%`);
  if (value.systolic_bp && value.diastolic_bp && (value.systolic_bp >= 140 || value.diastolic_bp >= 90)) alerts.push(`Elevated blood pressure: ${value.systolic_bp}/${value.diastolic_bp}`);
  if (value.systolic_bp && value.diastolic_bp && (value.systolic_bp < 90 || value.diastolic_bp < 60)) alerts.push(`Low blood pressure: ${value.systolic_bp}/${value.diastolic_bp}`);
  return alerts;
}
