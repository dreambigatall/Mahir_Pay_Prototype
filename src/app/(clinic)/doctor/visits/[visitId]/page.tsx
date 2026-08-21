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
  Search,
  Stethoscope,
  Syringe,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { DoctorLabResults } from "@/components/clinic/doctor-lab-results";
import { DoctorPrescriptionPanel } from "@/components/clinic/doctor-prescription-panel";
import { DoctorVitalsCard } from "@/components/clinic/doctor-vitals-card";
import { OrderLabDialog } from "@/components/clinic/order-lab-dialog";
import { ScheduleAppointmentDialog } from "@/components/clinic/schedule-appointment-dialog";
import { StartCourseDialog } from "@/components/clinic/start-course-dialog";
import { TreatmentPlanDialog } from "@/components/clinic/treatment-plan-dialog";
import { DoctorVisitActions } from "@/components/clinic/doctor-visit-actions";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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


      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main Clinical Consultation Column */}
        <div className="min-w-0">
          <Tabs defaultValue="consultation" className="w-full">
            <TabsList className="mb-6 flex flex-wrap w-fit bg-transparent gap-2 h-auto p-0 border-0">
              <TabsTrigger 
                value="consultation"
                className="group rounded-full px-5 py-2 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-surface-1 hover:bg-surface-2 text-fg-secondary data-[state=active]:border-primary border border-transparent transition-all"
              >
                Consultation
              </TabsTrigger>
              <TabsTrigger 
                value="labs"
                className="group rounded-full px-5 py-2 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-surface-1 hover:bg-surface-2 text-fg-secondary data-[state=active]:border-primary border border-transparent transition-all"
              >
                Labs
                {labs.length > 0 && (
                  <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary group-data-[state=active]:bg-background/20 group-data-[state=active]:text-primary-foreground">
                    {labs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="prescriptions"
                className="group rounded-full px-5 py-2 h-9 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm bg-surface-1 hover:bg-surface-2 text-fg-secondary data-[state=active]:border-primary border border-transparent transition-all"
              >
                Rx
                {visitPrescriptions.length > 0 && (
                  <span className="ml-2 inline-flex size-5 items-center justify-center rounded-full bg-warning-bg text-[10px] font-bold text-warning-text group-data-[state=active]:bg-background/20 group-data-[state=active]:text-primary-foreground">
                    {visitPrescriptions.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="consultation" className="grid gap-10 xl:grid-cols-2 focus-visible:outline-none focus-visible:ring-0 mt-0 items-start">
              {/* Section 1: Triage & Vitals */}
              <div className="xl:border-r xl:border-border/50 xl:pr-10">
                <DoctorVitalsCard />
                <div className="mt-6">
                  <Chip variant="ghost" className="w-full justify-start items-start whitespace-normal text-left px-3 py-2.5 leading-relaxed rounded-xl bg-orange-500/10 text-orange-600 hover:bg-orange-500/15">
                    <div>
                      <strong className="block text-[13px] mb-0.5">Known Drug Allergies: Penicillin</strong>
                      <span className="text-[12px] opacity-90">Verify contraindications before prescribing medications or administering injectables.</span>
                    </div>
                  </Chip>
                </div>
              </div>

              {/* Section 2: Clinical Examination & Diagnosis */}
              <div>
                <ClinicalNotesSection visit={visit} updateDiagnosis={updateVisitDiagnosis} patientId={patient.id} doctorId={doctor.id} />
              </div>
            </TabsContent>

            <TabsContent value="labs" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
              {/* Section 3: Laboratory Diagnostic Orders & Results */}
              <LabResultsSection visit={visit} requests={labs} doctorId={doctor.id} />
            </TabsContent>

            <TabsContent value="prescriptions" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
              {/* Section 4: Prescriptions & Pharmacy */}
              <PrescriptionSection visitId={visit.id} doctorId={doctor.id} patientId={patient.id} patientName={patient.name} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar: Patient Profile & Visit History */}
        <aside className="space-y-8 lg:border-l lg:border-border/50 lg:pl-6">
          {/* Patient Demographics Card */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-foreground">
              <UserRound className="size-4 text-clinical-fill" />
              <h3 className="text-[14px] font-semibold">Patient summary</h3>
            </div>

            <div className="space-y-3.5 text-[13px]">
              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                  Patient ID
                </span>
                <p className="font-mono font-medium text-foreground mt-0.5">{patient.patientId}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                  Date of birth
                </span>
                <p className="text-foreground mt-0.5">
                  {patient.dateOfBirth} ({ageFromDob(patient.dateOfBirth)} yrs)
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                  Phone
                </span>
                <p className="font-mono text-foreground mt-0.5">{patient.phone}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                  Residential address
                </span>
                <p className="text-foreground mt-0.5">{patient.address || "Not specified"}</p>
              </div>

              <div>
                <span className="text-[11px] font-medium text-fg-muted uppercase tracking-wider">
                  Emergency contact
                </span>
                <p className="text-foreground mt-0.5">{patient.emergencyContact || "None recorded"}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-border/40" />

          {/* Historical Visits Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-foreground">
              <Calendar className="size-4 text-clinical-fill" />
              <h3 className="text-[14px] font-semibold">
                Past visits ({history.length})
              </h3>
            </div>

            <div className="space-y-3">
              {history.length === 0 ? (
                <p className="text-[13px] text-fg-muted">
                  No previous recorded visits for this patient.
                </p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 text-[13px]"
                  >
                    <div className="flex items-center justify-between text-fg-muted font-mono text-[11px]">
                      <span>{item.id.toUpperCase()}</span>
                      <span>{item.createdAt.slice(0, 10)}</span>
                    </div>
                    <p className="font-medium text-foreground">
                      {item.reason}
                    </p>
                    <span className="inline-block text-[12px] text-fg-secondary">
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

function SectionHeader({
  title,
  icon: Icon,
  badge,
}: {
  title: string;
  icon: typeof Stethoscope;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-border/50 mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-clinical-fill" />
        <h2 className="text-[16px] font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      {badge && <div>{badge}</div>}
    </div>
  );
}

function ClinicalNotesSection({ 
  visit, 
  updateDiagnosis,
  patientId,
  doctorId 
}: { 
  visit: Visit; 
  updateDiagnosis: (visitId: string, diagnosis: string) => void;
  patientId: string;
  doctorId: string;
}) {
  const [complaint, setComplaint] = useState(visit.reason);
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || "");
  const [plan, setPlan] = useState("");

  return (
    <section>
      <SectionHeader 
        title="Clinical notes & examination" 
        icon={FileText} 
        badge={<ScheduleAppointmentDialog patientId={patientId} doctorId={doctorId} />}
      />
      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="chief-complaint" className="text-[13px] font-medium text-foreground">
            Chief complaint & symptoms
          </Label>
          <Input
            id="chief-complaint"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Primary reason for visit, onset, severity…"
            className="bg-background"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="exam-findings" className="text-[13px] font-medium text-foreground">
            Physical examination findings
          </Label>
          <Textarea
            id="exam-findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="General appearance, chest auscultation, abdominal palpation, ENT findings…"
            rows={3}
            className="bg-background"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="diagnosis" className="text-[13px] font-medium text-foreground">
              Provisional diagnosis
            </Label>
            <Input
              id="diagnosis"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Acute Upper Respiratory Infection"
              className="bg-background"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="management-plan" className="text-[13px] font-medium text-foreground">
              Care plan & follow-up
            </Label>
            <Input
              id="management-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="e.g. Rest, oral fluids, review in 3 days if fever persists"
              className="bg-background"
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
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
    </section>
  );
}

function LabResultsSection({
  visit,
  requests,
  doctorId,
}: {
  visit: Visit;
  requests: LabRequest[];
  doctorId: string;
}) {
  const readyCount = requests.filter(
    (request) => (request.status === "result-ready" || request.status === "reviewed") && request.resultValue,
  ).length;

  const allReady = requests.length > 0 && readyCount === requests.length;

  return (
    <section>
      <SectionHeader
        title="Laboratory orders & results"
        icon={FlaskConical}
        badge={
          requests.length > 0 ? (
            <div className="flex items-center gap-3">
              <Chip variant={allReady ? "success" : "warning"}>
                {allReady ? "All results ready" : `${readyCount}/${requests.length} ready`}
              </Chip>
              <OrderLabDialog visitId={visit.id} doctorId={doctorId} />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-fg-muted font-medium">0 ordered</span>
              <OrderLabDialog visitId={visit.id} doctorId={doctorId} />
            </div>
          )
        }
      />
      <DoctorLabResults requests={requests} />
    </section>
  );
}

function PrescriptionSection({ 
  visitId, 
  doctorId, 
  patientId, 
  patientName 
}: { 
  visitId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
}) {
  return (
    <section>
      <SectionHeader 
        title="Prescriptions & medications" 
        icon={Pill} 
        badge={
          <div className="flex items-center gap-2">
            <TreatmentPlanDialog patientName={patientName} />
            <StartCourseDialog
              patientId={patientId}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5 text-[12px] h-8">
                  <Syringe className="size-3.5" />
                  Start injection
                </Button>
              }
            />
          </div>
        }
      />
      <DoctorPrescriptionPanel visitId={visitId} />
    </section>
  );
}
