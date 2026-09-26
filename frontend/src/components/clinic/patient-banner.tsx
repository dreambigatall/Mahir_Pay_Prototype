import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";

import { PriorityBadge } from "@/components/clinic/priority-badge";
import type { BackendPatient } from "@/lib/api/patients";
import { ageFromDob } from "@/lib/format";

function patientName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}

const sexLabel: Record<BackendPatient["sex"], string> = { female: "Female", male: "Male", intersex: "Intersex", unknown: "Sex not recorded" };

/**
 * Sticky patient identity strip. Allergies are always visible so they can't be missed
 * while writing notes, ordering labs, or prescribing.
 */
export function PatientBanner({
  patient,
  visitNumber,
  priority,
  reason,
  backHref,
  backLabel,
  action,
}: {
  patient: BackendPatient;
  visitNumber: string;
  priority?: string;
  reason?: string;
  backHref: string;
  backLabel: string;
  action?: ReactNode;
}) {
  const allergies = patient.allergies;

  return (
    <div className="sticky -top-6 z-20 -mx-6 -mt-6 border-b border-border bg-background/95 px-6 pt-4 pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link href={backHref} className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-2xl font-bold tracking-tight text-foreground">{patientName(patient)}</h1>
            {priority ? <PriorityBadge priority={priority} /> : null}
          </div>
          <p className="mt-0.5 text-sm text-fg-secondary">
            <span className="font-mono">{patient.medical_record_number}</span>
            {" · "}{ageFromDob(patient.date_of_birth)} yrs · {sexLabel[patient.sex]}
            {patient.blood_group ? <> · Blood {patient.blood_group}</> : null}
            {" · "}<span className="font-mono">{visitNumber}</span>
            {reason ? <> · <span className="text-foreground">{reason}</span></> : null}
          </p>
        </div>
        {action}
      </div>
      {allergies.length ? (
        <div role="alert" className="mt-2.5 flex items-start gap-2 rounded-lg border border-danger-fill/40 bg-danger-fill/10 px-3 py-2 text-sm text-danger-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong>Allergies:</strong>{" "}
            {allergies.map((allergy, index) => (
              <span key={allergy.id}>
                {index > 0 ? ", " : null}
                <span className="font-semibold">{allergy.allergen}</span>
                {allergy.reaction || allergy.severity ? (
                  <span className="opacity-80"> ({[allergy.severity, allergy.reaction].filter(Boolean).join(", ")})</span>
                ) : null}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          No known allergies recorded
        </p>
      )}
    </div>
  );
}
