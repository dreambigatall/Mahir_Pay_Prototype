"use client";

import { useState, type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
<<<<<<< HEAD
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
=======
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
>>>>>>> 236a1b0 (¨Color_Update¨)

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
<<<<<<< HEAD
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
=======
        title={`${patient.name} — Visit`}
        description={`${patient.patientId} · ${ageFromDob(patient.dateOfBirth)}${patient.gender} · ${doctor?.name ?? ""}`}
        action={<DoctorVisitActions visitId={visit.id} doctorId={visit.doctorId} patientId={patient.id} patientName={patient.name} />}
>>>>>>> 236a1b0 (¨Color_Update¨)
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
<<<<<<< HEAD
          {/* Section 1: Triage & Vitals */}
          <DoctorVitalsCard />

          {/* Section 2: Clinical Examination & Diagnosis */}
          <ClinicalNotesSection visit={visit} />

          {/* Section 3: Laboratory Diagnostic Orders & Results */}
          <LabResultsSection visit={visit} requests={labs} />

          {/* Section 4: Prescriptions & Pharmacy */}
          <PrescriptionSection visitId={visit.id} />
=======
          <ConsultationPanel visit={visit} patient={patient} badge={badge} updateDiagnosis={updateVisitDiagnosis} />
          <InvestigationsPanel visit={visit} requests={labs} />
          <PrescriptionsPanel visit={visit} prescriptions={visitPrescriptions} />
>>>>>>> 236a1b0 (¨Color_Update¨)
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

<<<<<<< HEAD
function ClinicalNotesSection({ visit }: { visit: Visit }) {
  const [complaint, setComplaint] = useState(visit.reason);
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [plan, setPlan] = useState("");
=======
function ConsultationPanel({
  visit,
  patient,
  badge,
  updateDiagnosis,
}: {
  visit: Visit;
  patient: Patient;
  badge: ReturnType<typeof visitBadge>;
  updateDiagnosis: (visitId: string, diagnosis: string) => void;
}) {
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || "");
  const [notes, setNotes] = useState("");

  const defaultOpen =
    visit.status === "registered" || visit.status === "in-consultation";
>>>>>>> 236a1b0 (¨Color_Update¨)

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
<<<<<<< HEAD
    </SectionAccordion>
  );
}

function LabResultsSection({
=======
      <div className="mt-4 grid gap-1.5">
        <Label htmlFor="complaint" className="font-normal">
          Chief complaint
        </Label>
        <Input id="complaint" defaultValue={visit.reason} />
      </div>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="diagnosis" className="font-normal">
          Diagnosis
        </Label>
        <Input 
          id="diagnosis" 
          placeholder="Enter formal diagnosis..." 
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="notes" className="font-normal">
          Examination notes
        </Label>
        <Textarea 
          id="notes" 
          placeholder="Findings, plan…" 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
    </VisitSection>
  );
}

function InvestigationsPanel({
>>>>>>> 236a1b0 (¨Color_Update¨)
  visit,
  requests,
}: {
  visit: Visit;
  requests: LabRequest[];
}) {
  const readyCount = requests.filter(
    (request) => (request.status === "result-ready" || request.status === "reviewed") && request.resultValue,
  ).length;

<<<<<<< HEAD
  const allReady = requests.length > 0 && readyCount === requests.length;

  return (
    <SectionAccordion
      title="Laboratory orders & results"
      icon={FlaskConical}
      defaultOpen={requests.length > 0}
=======
  const summary =
    requests.length === 0
      ? "No investigations requested yet"
      : readyCount === requests.length
        ? `${requests.length} ${requests.length === 1 ? "result" : "results"} ready`
        : `${readyCount} of ${requests.length} results ready`;

  return (
    <VisitSection
      title="Investigations"
      defaultOpen={defaultOpen}
>>>>>>> 236a1b0 (¨Color_Update¨)
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
<<<<<<< HEAD
    </SectionAccordion>
=======
    </VisitSection>
  );
}

function PrescriptionsPanel({
  visit,
  prescriptions,
}: {
  visit: Visit;
  prescriptions: Prescription[];
}) {
  const defaultOpen = prescriptions.length > 0;

  return (
    <VisitSection
      title="Prescriptions"
      defaultOpen={defaultOpen}
      badge={
        prescriptions.length > 0 ? (
          <StatusBadge role="success">Prescribed</StatusBadge>
        ) : undefined
      }
      summary={
        <p className="mt-2 text-[13px] text-fg-secondary">
          {prescriptions.length === 0 ? "No medicines prescribed yet" : `${prescriptions.length} items prescribed`}
        </p>
      }
    >
      {prescriptions.length === 0 ? (
        <p className="text-[13px] text-fg-muted">
          No medicines prescribed. Use the "Prescribe medicine" button to add from catalog.
        </p>
      ) : (
        <div className="space-y-2">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[14px] font-medium">{rx.drugName}</p>
                  <p className="mt-0.5 text-[13px] text-fg-secondary">{rx.instructions}</p>
                </div>
                <StatusBadge 
                  role={
                    rx.status === "dispensed" ? "success" 
                    : rx.status === "payment-approved" ? "warning" 
                    : "danger"
                  }
                >
                  {rx.status === "dispensed" ? "Dispensed" 
                   : rx.status === "payment-approved" ? "Payment Approved" 
                   : "Awaiting Payment"}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      )}
    </VisitSection>
>>>>>>> 236a1b0 (¨Color_Update¨)
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
