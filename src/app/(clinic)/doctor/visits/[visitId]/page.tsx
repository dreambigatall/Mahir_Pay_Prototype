"use client";

import { useState, type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  FileText,
  FlaskConical,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { DoctorLabResults } from "@/components/clinic/doctor-lab-results";
import { DoctorPrescriptionPanel } from "@/components/clinic/doctor-prescription-panel";
import { DoctorVitalsCard } from "@/components/clinic/doctor-vitals-card";
import { DoctorVisitActions } from "@/components/clinic/doctor-visit-actions";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff, patientHistory } from "@/lib/mock-data";
import type { LabRequest, Patient, Visit, Prescription } from "@/lib/types";
import { cn } from "@/lib/utils";
import { visitBadge } from "@/lib/visit-status";

export default function DoctorVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { visits, labRequests, prescriptions, ready, updateVisitDiagnosis } = useClinic();
  const visit = visits.find((item) => item.id === visitId);

  if (!ready) return <div className="min-h-[40vh]" />;
  if (!visit) notFound();

  const patient = getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) notFound();

  const badge = visitBadge(visit.status);
  const history = patientHistory(patient.id).filter((item) => item.id !== visit.id);
  const labs = labRequests.filter((item) => item.visitId === visit.id);
  const visitPrescriptions = prescriptions.filter((item) => item.visitId === visit.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${patient.name} — Consultation`}
        description={`${patient.patientId} · ${ageFromDob(patient.dateOfBirth)} ${patient.gender === "F" ? "Female" : "Male"} · ${doctor?.name ?? "Assigned GP"}`}
        action={
          <DoctorVisitActions
            visitId={visit.id}
            doctorId={visit.doctorId}
            patientId={patient.id}
            patientName={patient.name}
          />
        }
      />

      {/* Critical Allergy Alert Banner */}
      {patient.allergies.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-danger-fill/30 bg-danger-bg p-3.5 text-danger-text">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">
              Known Drug Allergies: {patient.allergies.join(", ")}
            </p>
            <p className="text-[12px] opacity-90">
              Verify contraindications before prescribing medications or administering injectables.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main Clinical Consultation Column */}
        <div className="space-y-4">
          {/* Section 1: Triage & Vitals */}
          <DoctorVitalsCard />

          {/* Section 2: Clinical Examination & Diagnosis */}
          <ClinicalNotesSection visit={visit} updateDiagnosis={updateVisitDiagnosis} />

          {/* Section 3: Laboratory Diagnostic Orders & Results */}
          <LabResultsSection visit={visit} requests={labs} />

          {/* Section 4: Prescriptions & Pharmacy */}
          <PrescriptionSection visitId={visit.id} />
        </div>

        {/* Right Sidebar: Patient Profile & Visit History */}
        <aside className="space-y-4">
          {/* Patient Demographics Card */}
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 mb-3">
              <UserRound className="size-4 text-fg-muted" />
              <h3 className="text-[14px] font-semibold text-foreground">
                Patient summary
              </h3>
            </div>

            <div className="space-y-2.5 text-[13px]">
              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase">
                  Patient ID
                </span>
                <p className="font-mono font-medium text-foreground">{patient.patientId}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase">
                  Date of birth
                </span>
                <p className="text-foreground">
                  {patient.dateOfBirth} ({ageFromDob(patient.dateOfBirth)} yrs)
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase">
                  Phone
                </span>
                <p className="font-mono text-foreground">{patient.phone}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase">
                  Residential address
                </span>
                <p className="text-foreground">{patient.address || "Not specified"}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase">
                  Emergency contact
                </span>
                <p className="text-foreground">{patient.emergencyContact || "None recorded"}</p>
              </div>
            </div>
          </div>

          {/* Historical Visits Timeline */}
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="size-4 text-fg-muted" />
              <h3 className="text-[14px] font-semibold text-foreground">
                Past visits ({history.length})
              </h3>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-[12px] text-fg-muted">
                  No previous recorded visits for this patient.
                </p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-surface-1/60 p-2.5 text-[12px]"
                  >
                    <div className="flex items-center justify-between text-fg-muted font-mono text-[11px]">
                      <span>{item.id.toUpperCase()}</span>
                      <span>{item.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="mt-1 font-medium text-foreground text-[13px]">
                      {item.reason}
                    </p>
                    <span className="mt-1 inline-block text-[11px] text-fg-secondary">
                      Status: {item.status}
                    </span>
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

function SectionAccordion({
  title,
  icon: Icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: typeof Stethoscope;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-clinical-fill" />
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown
            className={cn(
              "size-4 text-fg-muted transition-transform duration-150 ease-out",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </div>
      </button>

      {open && <div className="mt-4 pt-1 border-t border-border/50">{children}</div>}
    </div>
  );
}

function ClinicalNotesSection({ visit, updateDiagnosis }: { visit: Visit; updateDiagnosis: (visitId: string, diagnosis: string) => void }) {
  const [complaint, setComplaint] = useState(visit.reason);
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || "");
  const [plan, setPlan] = useState("");

  return (
    <SectionAccordion
      title="Clinical notes & examination"
      icon={FileText}
      defaultOpen={true}
    >
      <div className="space-y-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor="chief-complaint" className="text-[13px] font-normal text-fg-secondary">
            Chief complaint & symptoms
          </Label>
          <Input
            id="chief-complaint"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Primary reason for visit, onset, severity…"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="exam-findings" className="text-[13px] font-normal text-fg-secondary">
            Physical examination findings
          </Label>
          <Textarea
            id="exam-findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="General appearance, chest auscultation, abdominal palpation, ENT findings…"
            rows={3}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="diagnosis" className="text-[13px] font-normal text-fg-secondary">
              Provisional diagnosis
            </Label>
            <Input
              id="diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute Upper Respiratory Infection"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="management-plan" className="text-[13px] font-normal text-fg-secondary">
              Care plan & follow-up
            </Label>
            <Input
              id="management-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="e.g. Rest, oral fluids, review in 3 days if fever persists"
            />
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button 
          type="button" 
          onClick={() => {
            updateDiagnosis(visit.id, diagnosis);
            toast.success("Consultation saved", { description: "Diagnosis updated on encounter." });
          }}
        >
          Save Consultation
        </Button>
      </div>
    </SectionAccordion>
  );
}

function LabResultsSection({
  visit,
  requests,
}: {
  visit: Visit;
  requests: LabRequest[];
}) {
  const readyCount = requests.filter(
    (request) => (request.status === "result-ready" || request.status === "reviewed") && request.resultValue,
  ).length;

  const allReady = requests.length > 0 && readyCount === requests.length;

  return (
    <SectionAccordion
      title="Laboratory orders & results"
      icon={FlaskConical}
      defaultOpen={requests.length > 0}
      badge={
        requests.length > 0 ? (
          <StatusBadge role={allReady ? "success" : "warning"}>
            {allReady ? "All results ready" : `${readyCount}/${requests.length} ready`}
          </StatusBadge>
        ) : (
          <span className="text-[12px] text-fg-muted">0 ordered</span>
        )
      }
    >
      <DoctorLabResults requests={requests} />
    </SectionAccordion>
  );
}

function PrescriptionSection({ visitId }: { visitId: string }) {
  return (
    <SectionAccordion
      title="Prescriptions & medications"
      icon={Pill}
      defaultOpen={true}
    >
      <DoctorPrescriptionPanel visitId={visitId} />
    </SectionAccordion>
  );
}
