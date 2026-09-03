"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  FlaskConical,
  Loader2,
  LockKeyhole,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { DoctorVitalsCard } from "@/components/clinic/doctor-vitals-card";
import { LiveClinicalOrders } from "@/components/clinic/live-clinical-orders";
import { LiveDoctorLabsSection } from "@/components/clinic/live-doctor-labs-section";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { getTriage, type TriageObservation } from "@/lib/api/clinical";
import {
  getEncounterByVisit,
  getPatient,
  getVisit,
  saveEncounter,
  signEncounter,
  startEncounter,
  type BackendEncounter,
} from "@/lib/api/encounters";
import type { BackendPatient } from "@/lib/api/patients";
import type { BackendVisit } from "@/lib/api/workflow";
import { ageFromDob } from "@/lib/format";
import { announceCoreDataChanged } from "@/lib/core-events";
import { cn } from "@/lib/utils";

type ClinicalNotes = {
  complaint: string;
  findings: string;
  diagnosis: string;
  plan: string;
};

export default function DoctorVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<BackendVisit | null>(null);
  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [encounter, setEncounter] = useState<BackendEncounter | null>(null);
  const [triage, setTriage] = useState<TriageObservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setStartError("");
    try {
      const visitResponse = await getVisit(visitId);
      const visitItem = visitResponse.item;
      const patientResponse = await getPatient(visitItem.patient_id);
      setVisit(visitItem);
      setPatient(patientResponse.item);

      let encounterItem: BackendEncounter | null = null;
      try {
        encounterItem = (await getEncounterByVisit(visitId)).item;
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) {
          if (["awaiting_doctor", "in_consultation"].includes(visitItem.status)) {
            try {
              encounterItem = (await startEncounter(visitId)).item;
              setVisit((current) => (current ? { ...current, status: "in_consultation" } : current));
            } catch (startCaught) {
              setStartError(startCaught instanceof ApiError ? startCaught.message : "Consultation could not be started.");
            }
          }
        }
      }

      setEncounter(encounterItem);

      try {
        setTriage((await getTriage(visitId)).item);
      } catch {
        setTriage(null);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The consultation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <VisitSkeleton />;

  if (error || !visit || !patient) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost">
          <Link href="/doctor"><ArrowLeft className="size-4" />Back to doctor queue</Link>
        </Button>
        <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-5 text-sm text-danger-text">
          <p className="font-medium">Consultation unavailable</p>
          <p className="mt-1">{error || "The visit or patient record was not found."}</p>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void load()}>Try again</Button>
        </div>
      </div>
    );
  }

  const signed = encounter?.status === "signed";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${fullName(patient)} — Consultation`}
        description={`${patient.medical_record_number} · ${ageFromDob(patient.date_of_birth)} yrs · ${patient.sex} · ${visit.visit_number}`}
        action={
          encounter && !signed ? (
            <CompleteVisitButton
              encounter={encounter}
              patientName={fullName(patient)}
              onSigned={(next) => {
                setEncounter(next);
                setVisit((current) => (current ? { ...current, status: "ready_for_billing", active_queue: null } : current));
                router.push("/doctor");
              }}
            />
          ) : signed ? (
            <Chip variant="success">Completed</Chip>
          ) : null
        }
      />

      {startError ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-warning-fill/30 bg-warning-fill/10 p-4 text-sm text-warning-text sm:flex-row sm:items-center sm:justify-between">
          <span>{startError}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Retry start</Button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {encounter ? (
            <Tabs defaultValue="consultation" className="w-full">
              <TabsList className="mb-6 flex h-auto w-fit flex-wrap gap-2 bg-transparent p-0">
                <TabPill value="consultation" label="Consultation" />
                <TabPill value="labs" label="Labs" icon={FlaskConical} />
                <TabPill value="prescriptions" label="Rx" icon={Pill} />
              </TabsList>

              <TabsContent value="consultation" className="mt-0 focus-visible:outline-none">
                <div className="grid gap-10 xl:grid-cols-2">
                  <div className="xl:border-r xl:border-border/50 xl:pr-10">
                    <DoctorVitalsCard
                      visitId={visit.id}
                      triage={triage}
                      readOnly={signed}
                      onSaved={async () => {
                        try {
                          setTriage((await getTriage(visit.id)).item);
                        } catch {
                          /* keep local values */
                        }
                      }}
                    />
                    {patient.allergies.length ? (
                      <div className="mt-6 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">
                        <strong>Known allergies:</strong>{" "}
                        {patient.allergies.map((a) => a.allergen).join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <ClinicalNotesSection
                    encounter={encounter}
                    visitReason={visit.reason}
                    readOnly={signed}
                    onSaved={setEncounter}
                  />
                </div>
              </TabsContent>

              <TabsContent value="labs" className="mt-0 focus-visible:outline-none">
                <LiveDoctorLabsSection visitId={visit.id} encounterId={encounter.id} readOnly={signed} />
              </TabsContent>

              <TabsContent value="prescriptions" className="mt-0 focus-visible:outline-none">
                <LiveClinicalOrders visitId={visit.id} encounterId={encounter.id} readOnly={signed} />
              </TabsContent>
            </Tabs>
          ) : (
            <StartConsultationPanel visit={visit} onStarted={setEncounter} onVisitUpdate={setVisit} />
          )}
        </div>

        <PatientSidebar patient={patient} visit={visit} encounter={encounter} />
      </div>
    </div>
  );
}

function TabPill({ value, label, icon: Icon }: { value: string; label: string; icon?: typeof FileText }) {
  return (
    <TabsTrigger
      value={value}
      className="rounded-full border border-transparent bg-surface-1 px-5 py-2 h-9 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
    >
      {Icon ? <Icon className="mr-1.5 size-3.5" aria-hidden="true" /> : null}
      {label}
    </TabsTrigger>
  );
}

function ClinicalNotesSection({
  encounter,
  visitReason,
  readOnly,
  onSaved,
}: {
  encounter: BackendEncounter;
  visitReason: string;
  readOnly: boolean;
  onSaved: (encounter: BackendEncounter) => void;
}) {
  const [notes, setNotes] = useState<ClinicalNotes>({
    complaint: encounter.subjective ?? visitReason,
    findings: encounter.objective ?? "",
    diagnosis: encounter.diagnosis ?? encounter.assessment ?? "",
    plan: encounter.plan ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes({
      complaint: encounter.subjective ?? visitReason,
      findings: encounter.objective ?? "",
      diagnosis: encounter.diagnosis ?? encounter.assessment ?? "",
      plan: encounter.plan ?? "",
    });
  }, [encounter, visitReason]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await saveEncounter(encounter.id, {
        subjective: notes.complaint.trim(),
        objective: notes.findings.trim(),
        diagnosis: notes.diagnosis.trim(),
        assessment: notes.diagnosis.trim(),
        plan: notes.plan.trim(),
      });
      onSaved(response.item);
      toast.success("Consultation saved");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Consultation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2 border-b border-border/50 pb-4">
        <FileText className="size-5 text-clinical-fill" aria-hidden="true" />
        <h2 className="text-base font-semibold">Clinical notes & examination</h2>
      </div>
      <div className="space-y-4">
        <Field label="Chief complaint & symptoms" id="complaint">
          <Input id="complaint" value={notes.complaint} readOnly={readOnly} onChange={(e) => setNotes((n) => ({ ...n, complaint: e.target.value }))} placeholder="Primary reason, onset, severity…" />
        </Field>
        <Field label="Physical examination findings" id="findings">
          <Textarea id="findings" value={notes.findings} readOnly={readOnly} onChange={(e) => setNotes((n) => ({ ...n, findings: e.target.value }))} placeholder="General appearance, chest, abdomen, ENT…" rows={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provisional diagnosis" id="diagnosis">
            <Input id="diagnosis" value={notes.diagnosis} readOnly={readOnly} onChange={(e) => setNotes((n) => ({ ...n, diagnosis: e.target.value }))} placeholder="e.g. Acute URTI" />
          </Field>
          <Field label="Care plan & follow-up" id="plan">
            <Input id="plan" value={notes.plan} readOnly={readOnly} onChange={(e) => setNotes((n) => ({ ...n, plan: e.target.value }))} placeholder="Treatment and follow-up" />
          </Field>
        </div>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-danger-text">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-5 flex justify-end">
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Save consultation"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CompleteVisitButton({
  encounter,
  patientName,
  onSigned,
}: {
  encounter: BackendEncounter;
  patientName: string;
  onSigned: (encounter: BackendEncounter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function complete() {
    setSubmitting(true);
    try {
      const response = await signEncounter(encounter.id);
      onSigned(response.item);
      announceCoreDataChanged();
      toast.success("Consultation completed", {
        description: "Your clinical work is done. Reception will handle the rest.",
      });
      setOpen(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Consultation could not be completed.");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" className="gap-1.5 shadow-sm" onClick={() => setOpen(true)}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Complete visit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete consultation?</DialogTitle>
            <DialogDescription>
              Finalize the visit for {patientName}. Save your notes first — diagnosis and care plan are required.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Continue editing</Button>
            <Button type="button" disabled={submitting} onClick={() => void complete()}>
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
              {submitting ? "Completing…" : "Complete visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StartConsultationPanel({
  visit,
  onStarted,
  onVisitUpdate,
}: {
  visit: BackendVisit;
  onStarted: (encounter: BackendEncounter) => void;
  onVisitUpdate: (visit: BackendVisit) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canStart = ["awaiting_doctor", "in_consultation"].includes(visit.status);

  async function start() {
    setSubmitting(true);
    setError("");
    try {
      const response = await startEncounter(visit.id);
      onStarted(response.item);
      onVisitUpdate({ ...visit, status: "in_consultation" });
      toast.success("Consultation started");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Consultation could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface-2 p-8 text-center">
      <Stethoscope className="mx-auto size-10 text-primary" aria-hidden="true" />
      <h2 className="mt-4 font-heading text-xl font-semibold">Start consultation</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-secondary">Begin the examination to record notes, order labs, and prescribe medication.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-danger-text">{error}</p> : null}
      <Button type="button" className="mt-6 min-h-11" disabled={!canStart || submitting} onClick={() => void start()}>
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {submitting ? "Starting…" : canStart ? "Start consultation" : "Visit is not ready"}
      </Button>
    </section>
  );
}

function PatientSidebar({
  patient,
  visit,
  encounter,
}: {
  patient: BackendPatient;
  visit: BackendVisit;
  encounter: BackendEncounter | null;
}) {
  return (
    <aside className="space-y-6 lg:border-l lg:border-border/50 lg:pl-6">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="size-4 text-clinical-fill" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Patient summary</h3>
        </div>
        <dl className="space-y-3 text-sm">
          <SidebarItem label="Phone" value={patient.phone || "—"} />
          <SidebarItem label="Reason" value={visit.reason} />
          <SidebarItem label="Priority" value={visit.priority} capitalize />
          <SidebarItem label="Doctor" value={visit.doctor_name || encounter?.clinician_name || "Unassigned"} />
        </dl>
      </section>
      {patient.allergies.length ? (
        <section className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger-text">
            <AlertCircle className="size-4" aria-hidden="true" />
            Allergies
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-danger-text">
            {patient.allergies.map((allergy) => (
              <li key={allergy.id}>{allergy.allergen}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium">{label}</Label>
      {children}
    </div>
  );
}

function SidebarItem({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={cn("font-medium", capitalize && "capitalize")}>{value}</dd>
    </div>
  );
}

function VisitSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading consultation">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

function fullName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}
