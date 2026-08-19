"use client";

import { useState, type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { DoctorLabResults } from "@/components/clinic/doctor-lab-results";
import { DoctorVisitActions } from "@/components/clinic/doctor-visit-actions";
import { PageHeader } from "@/components/clinic/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff, patientHistory } from "@/lib/mock-data";
import type { LabRequest, Patient, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visitBadge } from "@/lib/visit-status";

export default function DoctorVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { visits, labRequests, ready } = useClinic();
  const visit = visits.find((item) => item.id === visitId);

  if (!ready) return <div className="min-h-[40vh]" />;
  if (!visit) notFound();

  const patient = getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) notFound();

  const badge = visitBadge(visit.status);
  const history = patientHistory(patient.id).filter((item) => item.id !== visit.id);
  const labs = labRequests.filter((item) => item.visitId === visit.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${patient.name} — Visit`}
        description={`${patient.patientId} · ${ageFromDob(patient.dateOfBirth)}${patient.gender} · ${doctor?.name ?? ""}`}
        action={<DoctorVisitActions visitId={visit.id} doctorId={visit.doctorId} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <ConsultationPanel visit={visit} patient={patient} badge={badge} />
          <LabResultsPanel visit={visit} requests={labs} />
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="text-[15px] font-medium">History</h3>
            <div className="mt-3 space-y-3">
              {history.length === 0 ? (
                <p className="text-[13px] text-fg-muted">No previous visits.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id}>
                    <p className="text-[13px] font-medium">{item.reason}</p>
                    <p className="font-mono text-[12px] text-fg-muted">
                      {item.id.toUpperCase()} · {item.createdAt.slice(0, 10)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function VisitSection({
  title,
  badge,
  defaultOpen,
  summary,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen: boolean;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-5">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-fg-muted transition-transform duration-150 ease-out",
            open ? "rotate-0" : "-rotate-90",
          )}
          strokeWidth={1.75}
        />
        <h2 className="text-[18px] font-semibold">{title}</h2>
        {badge ? <span className="ml-auto">{badge}</span> : null}
      </button>
      {open ? <div className="mt-4">{children}</div> : summary}
    </div>
  );
}

function ConsultationPanel({
  visit,
  patient,
  badge,
}: {
  visit: Visit;
  patient: Patient;
  badge: ReturnType<typeof visitBadge>;
}) {
  const defaultOpen =
    visit.status === "registered" || visit.status === "in-consultation";

  return (
    <VisitSection
      title="Consultation"
      defaultOpen={defaultOpen}
      badge={<StatusBadge role={badge.role}>{badge.label}</StatusBadge>}
      summary={
        <div className="mt-2 space-y-1">
          {patient.allergies.length > 0 ? (
            <p className="text-[13px] text-danger-text">
              Allergies: {patient.allergies.join(", ")}
            </p>
          ) : null}
          <p className="text-[13px] text-fg-secondary">{visit.reason}</p>
        </div>
      }
    >
      {patient.allergies.length > 0 ? (
        <p className="mb-4 text-[13px] text-danger-text">
          Allergies: {patient.allergies.join(", ")}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Blood pressure" id="bp" placeholder="120/80" />
        <Field label="Temperature" id="temp" placeholder="36.8 °C" />
        <Field label="Pulse" id="pulse" placeholder="72" />
        <Field label="Weight" id="weight" placeholder="68 kg" />
        <Field label="Height" id="height" placeholder="165 cm" />
        <Field label="SpO2" id="spo2" placeholder="98%" />
      </div>
      <div className="mt-4 grid gap-1.5">
        <Label htmlFor="complaint" className="font-normal">
          Chief complaint
        </Label>
        <Input id="complaint" defaultValue={visit.reason} />
      </div>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="notes" className="font-normal">
          Examination notes
        </Label>
        <Textarea id="notes" placeholder="Findings, diagnosis, plan…" />
      </div>
    </VisitSection>
  );
}

function LabResultsPanel({
  visit,
  requests,
}: {
  visit: Visit;
  requests: LabRequest[];
}) {
  const readyCount = requests.filter(
    (request) => request.status === "result-ready" && request.resultValue,
  ).length;
  const defaultOpen =
    visit.status === "awaiting-lab" ||
    visit.status === "lab-complete" ||
    readyCount > 0;

  const summary =
    requests.length === 0
      ? "No lab requests yet"
      : readyCount === requests.length
        ? `${requests.length} ${requests.length === 1 ? "result" : "results"} ready`
        : `${readyCount} of ${requests.length} results ready`;

  return (
    <VisitSection
      title="Lab results"
      defaultOpen={defaultOpen}
      badge={
        requests.length > 0 ? (
          <StatusBadge role={readyCount === requests.length ? "success" : "warning"}>
            {readyCount === requests.length ? "Ready" : "Awaiting"}
          </StatusBadge>
        ) : undefined
      }
      summary={<p className="mt-2 text-[13px] text-fg-secondary">{summary}</p>}
    >
      <DoctorLabResults requests={requests} />
      <p className="mt-3 text-[13px] text-fg-muted">
        Prescriptions will appear here from the clinic drug list.
      </p>
    </VisitSection>
  );
}

function Field({
  label,
  id,
  placeholder,
}: {
  label: string;
  id: string;
  placeholder: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Input id={id} placeholder={placeholder} className="tabular-nums" />
    </div>
  );
}
