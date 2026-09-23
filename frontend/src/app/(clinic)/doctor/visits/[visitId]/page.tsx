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
import { FormField, FormGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
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
  history: string;
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

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setStartError("");
    try {
      const visitResponse = await getVisit(visitId, signal);
      const visitItem = visitResponse.item;
      const patientResponse = await getPatient(visitItem.patient_id, signal);
      if (signal?.aborted) return;

      setVisit(visitItem);
      setPatient(patientResponse.item);

      let encounterItem: BackendEncounter | null = null;
      let started = false;
      try {
        const ensured = await ensureEncounter(visitId, visitItem.status, signal);
        encounterItem = ensured.encounter;
        started = ensured.started;
      } catch (caught) {
        if (signal?.aborted) return;
        setStartError(caught instanceof ApiError ? caught.message : "Consultation could not be started.");
      }

      if (signal?.aborted) return;
      setEncounter(encounterItem);
      if (started) {
        setVisit((current) => (current ? { ...current, status: "in_consultation" } : current));
      }

      try {
        setTriage((await getTriage(visitId, signal)).item);
      } catch {
        if (!signal?.aborted) setTriage(null);
      }
    } catch (caught) {
      if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
      if (caught instanceof ApiError && caught.code === "API_UNREACHABLE" && signal?.aborted) return;
      setError(caught instanceof ApiError ? caught.message : "The consultation could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
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
                    triage={triage}
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
  triage,
  readOnly,
  onSaved,
}: {
  encounter: BackendEncounter;
  visitReason: string;
  triage: TriageObservation | null;
  readOnly: boolean;
  onSaved: (encounter: BackendEncounter) => void;
}) {
  const [notes, setNotes] = useState<ClinicalNotes>(() => notesFromEncounter(encounter, visitReason));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(notesFromEncounter(encounter, visitReason));
  }, [encounter, visitReason]);

  const baseline = notesFromEncounter(encounter, visitReason);
  const isDirty =
    !readOnly &&
    (notes.complaint !== baseline.complaint ||
      notes.history !== baseline.history ||
      notes.findings !== baseline.findings ||
      notes.diagnosis !== baseline.diagnosis ||
      notes.plan !== baseline.plan);

  useEffect(() => {
    if (!isDirty) return;
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [isDirty]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await saveEncounter(encounter.id, {
        subjective: packSubjective(notes.complaint, notes.history),
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

  const vitalChips = triageVitalChips(triage);

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-2 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-clinical-fill" aria-hidden="true" />
          <h2 className="text-base font-semibold">Clinical notes & examination</h2>
        </div>
        {isDirty ? <Chip variant="warning" size="sm">Unsaved changes</Chip> : null}
      </div>

      <div className="space-y-6">
        <FormGroup eyebrow="Subjective" hint="What the patient reports">
          <FormField id="complaint" label="Chief complaint" required={!readOnly}>
            <Input
              value={notes.complaint}
              readOnly={readOnly}
              onChange={(e) => setNotes((n) => ({ ...n, complaint: e.target.value }))}
              placeholder="Why the patient came today…"
            />
          </FormField>
          <FormField id="history" label="History of present illness" hint="Onset, duration, severity, what makes it better or worse">
            <Textarea
              value={notes.history}
              readOnly={readOnly}
              onChange={(e) => setNotes((n) => ({ ...n, history: e.target.value }))}
              placeholder="Onset, duration, severity, what makes it better or worse…"
              rows={3}
            />
          </FormField>
        </FormGroup>

        <FormGroup eyebrow="Objective" hint="Exam findings and vitals recorded at triage">
          {vitalChips.length ? (
            <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-surface-1 px-3 py-2.5">
              {vitalChips.map((chip) => (
                <span
                  key={chip.label}
                  className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-xs text-fg-secondary"
                >
                  <span className="text-fg-muted">{chip.label}</span> {chip.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-fg-muted">
              No triage vitals recorded yet. Use the vitals panel to add them.
            </p>
          )}
          <FormField id="findings" label="Physical examination findings">
            <Textarea
              value={notes.findings}
              readOnly={readOnly}
              onChange={(e) => setNotes((n) => ({ ...n, findings: e.target.value }))}
              placeholder="General appearance, chest, abdomen, ENT…"
              rows={3}
            />
          </FormField>
        </FormGroup>

        <FormGroup eyebrow="Assessment & plan" hint="What this visit concludes">
          <FormField id="diagnosis" label="Provisional diagnosis" required={!readOnly}>
            <Textarea
              value={notes.diagnosis}
              readOnly={readOnly}
              onChange={(e) => setNotes((n) => ({ ...n, diagnosis: e.target.value }))}
              placeholder="e.g. Acute URTI"
              rows={3}
            />
          </FormField>
          <FormField id="plan" label="Care plan & follow-up" required={!readOnly}>
            <Textarea
              value={notes.plan}
              readOnly={readOnly}
              onChange={(e) => setNotes((n) => ({ ...n, plan: e.target.value }))}
              placeholder="Treatment and follow-up"
              rows={3}
            />
          </FormField>
        </FormGroup>
      </div>

      {error ? <p role="alert" className="mt-3 text-sm text-danger-text">{error}</p> : null}
      {!readOnly ? (
        <div className="mt-5 flex items-center justify-end gap-3">
          <Button type="button" disabled={saving || !isDirty} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

const SUBJECTIVE_HPI_SEPARATOR = "\n---\n";

function packSubjective(complaint: string, history: string) {
  const cc = complaint.trim();
  const hpi = history.trim();
  if (!hpi) return cc;
  if (!cc) return `${SUBJECTIVE_HPI_SEPARATOR.trimStart()}${hpi}`;
  return `${cc}${SUBJECTIVE_HPI_SEPARATOR}${hpi}`;
}

function unpackSubjective(value: string | null | undefined, visitReason: string) {
  const raw = value?.trim() ?? "";
  if (!raw) return { complaint: visitReason, history: "" };
  const parts = raw.split(SUBJECTIVE_HPI_SEPARATOR);
  if (parts.length >= 2) {
    return {
      complaint: parts[0]!.trim() || visitReason,
      history: parts.slice(1).join(SUBJECTIVE_HPI_SEPARATOR).trim(),
    };
  }
  return { complaint: raw, history: "" };
}

function notesFromEncounter(encounter: BackendEncounter, visitReason: string): ClinicalNotes {
  const subjective = unpackSubjective(encounter.subjective, visitReason);
  return {
    complaint: subjective.complaint,
    history: subjective.history,
    findings: encounter.objective ?? "",
    diagnosis: encounter.diagnosis ?? encounter.assessment ?? "",
    plan: encounter.plan ?? "",
  };
}

function triageVitalChips(triage: TriageObservation | null) {
  if (!triage) return [] as Array<{ label: string; value: string }>;
  const chips: Array<{ label: string; value: string }> = [];
  if (triage.systolic_bp != null && triage.diastolic_bp != null) {
    chips.push({ label: "BP", value: `${triage.systolic_bp}/${triage.diastolic_bp}` });
  }
  if (triage.pulse_bpm != null) chips.push({ label: "HR", value: String(triage.pulse_bpm) });
  if (triage.temperature_c) chips.push({ label: "Temp", value: `${triage.temperature_c}°C` });
  if (triage.oxygen_saturation) chips.push({ label: "SpO₂", value: `${triage.oxygen_saturation}%` });
  if (triage.weight_kg) chips.push({ label: "Wt", value: `${triage.weight_kg} kg` });
  return chips;
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
      const { encounter, started } = await ensureEncounter(visit.id, visit.status);
      if (!encounter) {
        setError("Visit is not ready for consultation.");
        return;
      }
      onStarted(encounter);
      if (started) {
        onVisitUpdate({ ...visit, status: "in_consultation" });
        toast.success("Consultation started");
      } else {
        onVisitUpdate({ ...visit, status: visit.status === "awaiting_doctor" ? "in_consultation" : visit.status });
      }
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

function ensureEncounter(
  visitId: string,
  visitStatus: string,
  signal?: AbortSignal,
): Promise<{ encounter: BackendEncounter | null; started: boolean }> {
  return getEncounterByVisit(visitId, signal)
    .then((response) => ({ encounter: response.item, started: false }))
    .catch(async (caught) => {
      if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
      if (!["awaiting_doctor", "in_consultation"].includes(visitStatus)) {
        return { encounter: null, started: false };
      }
      try {
        const started = await startEncounter(visitId, signal);
        return { encounter: started.item, started: true };
      } catch (startCaught) {
        if (
          startCaught instanceof ApiError
          && (startCaught.status === 409 || startCaught.code === "ENCOUNTER_EXISTS")
        ) {
          const existing = await getEncounterByVisit(visitId, signal);
          return { encounter: existing.item, started: false };
        }
        throw startCaught;
      }
    });
}

function fullName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}
