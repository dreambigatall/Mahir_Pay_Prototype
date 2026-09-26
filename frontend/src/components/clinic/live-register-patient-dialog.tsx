"use client";

import { cloneElement, useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FlaskConical,
  Loader2,
  Mars,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Siren,
  Stethoscope,
  Syringe,
  UserRoundPlus,
  UserRoundSearch,
  Users,
  Venus,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DoctorSelect, UNASSIGNED_DOCTOR } from "@/components/clinic/doctor-select";
import { Button } from "@/components/ui/button";
import { useDiscardGuard } from "@/components/ui/confirm-dialog";
import { FormErrorSummary, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/client";
import { createPatient, listPatients, type BackendPatient } from "@/lib/api/patients";
import { checkInPatient, type VisitPriority } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";
import { ageFromDob, dobFromAge, initials } from "@/lib/format";
import { rules, useFormErrors, type FieldRules } from "@/lib/use-form-errors";
import { cn } from "@/lib/utils";

type View = "search" | "new";

type NewPatient = {
  firstName: string;
  lastName: string;
  age: string;
  sex: BackendPatient["sex"] | "";
  phone: string;
};

const EMPTY_PATIENT: NewPatient = { firstName: "", lastName: "", age: "", sex: "", phone: "" };

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  age: "Age",
  sex: "Sex",
  phone: "Phone",
  reason: "Reason for visit",
};

const REASONS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "Consultation", icon: Stethoscope },
  { label: "Follow-up", icon: RotateCcw },
  { label: "Injection", icon: Syringe },
  { label: "Lab tests only", icon: FlaskConical },
];

const newPatientRules: FieldRules<NewPatient> = {
  firstName: rules.required("First name"),
  lastName: rules.required("Last name"),
  age: (value) => {
    const age = Number(value);
    if (String(value).trim() === "") return "Age is required";
    return !Number.isInteger(age) || age < 0 || age > 150 ? "Enter an age between 0 and 150" : undefined;
  },
  sex: rules.required("Sex"),
  phone: rules.phone,
};

/** Front-desk check-in: find the patient first, register only when they are new. */
export function LiveRegisterPatientDialog() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("search");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BackendPatient | null>(null);
  const [patient, setPatient] = useState<NewPatient>(EMPTY_PATIENT);
  const [doctorId, setDoctorId] = useState(UNASSIGNED_DOCTOR);
  const [reason, setReason] = useState("Consultation");
  const [priority, setPriority] = useState<VisitPriority>("routine");
  const [reasonError, setReasonError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const form = useFormErrors(patient, view === "new" ? newPatientRules : {});

  const dirty = view === "new"
    ? Object.values(patient).some((value) => value !== "")
    : selected !== null || query.trim() !== "";

  function reset() {
    setView("search");
    setQuery("");
    setSelected(null);
    setPatient(EMPTY_PATIENT);
    setDoctorId(UNASSIGNED_DOCTOR);
    setReason("Consultation");
    setPriority("routine");
    setReasonError("");
    form.reset();
  }

  const patientStepDone = view === "search"
    ? selected !== null
    : Object.values(patient).every((value) => String(value).trim() !== "");
  const summaryName = view === "search"
    ? (selected ? fullName(selected) : "")
    : [patient.firstName.trim(), patient.lastName.trim()].filter(Boolean).join(" ");

  const guard = useDiscardGuard(dirty && !submitting, () => { setOpen(false); reset(); });

  function startNew() {
    // Carry what was typed in the search box into the new-patient form.
    const text = query.trim();
    const digits = text.replace(/[^\d]/g, "");
    const next = { ...EMPTY_PATIENT };
    if (digits.length >= 6 && digits.length >= text.replace(/\s/g, "").length - 1) {
      next.phone = text;
    } else if (text) {
      const [first, ...rest] = text.split(/\s+/);
      next.firstName = capitalize(first);
      next.lastName = capitalize(rest.join(" "));
    }
    setPatient(next);
    setSelected(null);
    form.reset();
    setView("new");
  }

  function pickExisting(match: BackendPatient) {
    setSelected(match);
    setQuery(fullName(match));
    form.reset();
    setView("search");
  }

  /** Reason is shared by both flows, so it is checked here rather than in the patient rules. */
  function validateReason(): boolean {
    const message = reason.trim() ? "" : "Reason for visit is required";
    setReasonError(message);
    return !message;
  }

  async function checkIn(target: BackendPatient) {
    await checkInPatient({
      patientId: target.id,
      reason: reason.trim(),
      priority,
      ...(doctorId !== UNASSIGNED_DOCTOR ? { doctorId } : {}),
    });
  }

  function finish(target: BackendPatient, registered: boolean) {
    announceCoreDataChanged();
    toast.success(registered ? "Patient registered and checked in" : "Patient checked in", {
      description: `${fullName(target)} · ${target.medical_record_number} — ${
        doctorId !== UNASSIGNED_DOCTOR ? "on the doctor's queue" : "waiting for triage"
      }.`,
    });
    setOpen(false);
    reset();
  }

  async function submitExisting() {
    const reasonOk = validateReason();
    if (!selected || !form.validateAll() || !reasonOk) return;
    setSubmitting(true);
    try {
      await checkIn(selected);
      finish(selected, false);
    } catch (caught) {
      form.applyApiError(caught, "Check-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNew() {
    const reasonOk = validateReason();
    if (!form.validateAll() || !reasonOk) return;
    setSubmitting(true);
    let created: BackendPatient | null = null;
    try {
      created = (await createPatient({
        firstName: patient.firstName.trim(),
        lastName: patient.lastName.trim(),
        dateOfBirth: dobFromAge(Number(patient.age)),
        sex: patient.sex as BackendPatient["sex"],
        phone: patient.phone.trim(),
        allergies: [],
      })).item;
      await checkIn(created);
      finish(created, true);
    } catch (caught) {
      if (created) {
        // The record exists now; switch to it so a retry only repeats the check-in.
        announceCoreDataChanged();
        pickExisting(created);
        form.setFormError(`${fullName(created)} was registered, but check-in failed: ${caught instanceof ApiError ? caught.message : "please try again"}.`);
      } else {
        form.applyApiError(caught, "The patient could not be registered.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : guard.requestClose())}>
      <SheetTrigger asChild>
        <Button className="mr-2 mt-1 min-h-11 gap-2 px-5 shadow-sm">
          <Plus className="size-4" aria-hidden="true" />
          Check in patient
        </Button>
      </SheetTrigger>
      <SheetContent size="panel" onOpenAutoFocus={(event) => event.preventDefault()}>
        <SheetHeader className="border-b border-border/70 px-6 py-5">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              {view === "new" ? <UserRoundPlus className="size-5" aria-hidden="true" /> : <UserRoundSearch className="size-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <SheetTitle className="font-heading text-lg font-semibold tracking-tight">
                {view === "new" ? "Register new patient" : "Check in a patient"}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[13px]">
                {view === "new" ? "Create the record and check them in, in one step." : "Find the patient first. Register only if they are new."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => { event.preventDefault(); void (view === "new" ? submitNew() : submitExisting()); }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/40 px-6 py-5">
            <FormErrorSummary
              message={form.formError || undefined}
              items={form.formError ? [] : [...form.visibleErrors, ...(reasonError ? [{ name: "reason", message: reasonError }] : [])]}
              labels={FIELD_LABELS}
              idFor={(name) => `checkin-${name}`}
            />

            {view === "search" ? (
              <Section step={1} done={patientStepDone} title="Find patient" description="Search by name, phone number, or patient ID.">
                <PatientSearch
                  query={query}
                  onQueryChange={(next) => { setQuery(next); setSelected(null); }}
                  selected={selected}
                  onSelect={setSelected}
                  onRegisterNew={startNew}
                />
              </Section>
            ) : (
              <Section
                step={1}
                done={patientStepDone}
                title="Patient details"
                description="All fields are required."
                action={
                  <button type="button" onClick={() => { setView("search"); form.reset(); }} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-1 hover:text-foreground">
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Back to search
                  </button>
                }
              >
                <NewPatientFields
                  patient={patient}
                  onChange={(next) => setPatient((current) => ({ ...current, ...next }))}
                  errorFor={form.errorFor}
                  touch={form.touch}
                  onUseExisting={pickExisting}
                />
              </Section>
            )}

            {view === "new" || selected ? (
              <Section step={2} title="Visit details" description="Why they came today and how soon they need to be seen.">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <FormField id="checkin-reason" label="Reason for visit" required error={reasonError || undefined}>
                      <Input
                        value={reason}
                        onChange={(event) => { setReason(event.target.value); if (reasonError) setReasonError(""); }}
                        onBlur={() => { if (!reason.trim()) setReasonError("Reason for visit is required"); }}
                        placeholder="Type a reason or pick one below"
                      />
                    </FormField>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common reasons">
                      {REASONS.map(({ label, icon: Icon }) => {
                        const active = reason === label;
                        return (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => { setReason(label); setReasonError(""); }}
                            className={cn(
                              "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "border-border/80 bg-background text-fg-secondary hover:border-primary/40 hover:text-foreground",
                            )}
                          >
                            <Icon className="size-3.5" aria-hidden="true" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <SegmentedControl
                      id="checkin-priority"
                      label="Priority"
                      value={priority}
                      onChange={setPriority}
                      options={[
                        { value: "routine", label: "Routine" },
                        { value: "urgent", label: "Urgent", tone: "warning" },
                        { value: "emergency", label: <><Siren aria-hidden="true" />Emergency</>, tone: "danger" },
                      ]}
                    />
                    <DoctorSelect id="checkin-doctor" value={doctorId} onChange={setDoctorId} hint="" />
                  </div>

                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] leading-relaxed text-fg-secondary">
                    {priority === "routine"
                      ? "Routine patients are seen in arrival order."
                      : priority === "urgent"
                        ? "Urgent patients move to the top of every queue with an amber marker."
                        : "Emergency patients jump to the very top of every queue with a red marker."}
                    {" "}
                    {doctorId === UNASSIGNED_DOCTOR ? "With no doctor chosen, they go to triage first." : "They go straight to the chosen doctor's queue."}
                  </p>
                </div>
              </Section>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-border/70 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5" aria-live="polite">
              {summaryName ? (
                <>
                  <Avatar name={summaryName} size="sm" />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-[13px] font-semibold">{summaryName}</p>
                    <p className="truncate text-[11px] text-fg-muted">
                      {priority === "routine" ? "Routine" : priority === "urgent" ? "Urgent" : "Emergency"} · {reason.trim() || "No reason yet"}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-fg-muted">{view === "new" ? "Enter the patient's name to begin" : "No patient selected yet"}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" disabled={submitting} onClick={guard.requestClose}>Cancel</Button>
              <Button type="submit" className="gap-2 shadow-xs" disabled={submitting || (view === "search" && !selected)}>
                {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                {submitting
                  ? "Saving…"
                  : view === "new"
                    ? "Register and check in"
                    : selected
                      ? `Check in ${selected.first_name}`
                      : "Select a patient"}
              </Button>
            </div>
          </div>
        </form>
        {guard.prompt}
      </SheetContent>
    </Sheet>
  );
}

function PatientSearch({
  query,
  onQueryChange,
  selected,
  onSelect,
  onRegisterNew,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  selected: BackendPatient | null;
  onSelect: (patient: BackendPatient) => void;
  onRegisterNew: () => void;
}) {
  const { results, loading, error } = usePatientSearch(selected ? "" : query);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
        <Avatar name={fullName(selected)} />
        <PatientSummary patient={selected} />
        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => onQueryChange("")}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <Input
          id="checkin-search"
          aria-label="Search patients"
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="e.g. Abena Mensah or 024 123 4567"
          className="pr-8 pl-9"
          autoComplete="off"
        />
        {query ? (
          <button type="button" onClick={() => onQueryChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:text-foreground" aria-label="Clear search">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {!query.trim() ? (
        <EmptyState icon={UserRoundSearch} title="Search existing records" hint="Returning patients keep their history, allergies, and past visits." />
      ) : loading ? (
        <EmptyState icon={Loader2} spin title="Searching…" />
      ) : error ? (
        <p role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">{error}</p>
      ) : results.length === 0 ? (
        <EmptyState icon={Search} title={`No patient matches “${query.trim()}”`} hint="Check the spelling, or register them as a new patient." />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70" aria-label="Matching patients">
          {results.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => onSelect(patient)}
                className="group flex w-full items-center gap-3 bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Avatar name={fullName(patient)} />
                <PatientSummary patient={patient} />
                <ChevronRight className="size-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onRegisterNew}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 text-[13px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserRoundPlus className="size-4" aria-hidden="true" />
        {query.trim() ? "Not listed? Register a new patient" : "Register a new patient"}
      </button>
    </div>
  );
}

function NewPatientFields({
  patient,
  onChange,
  errorFor,
  touch,
  onUseExisting,
}: {
  patient: NewPatient;
  onChange: (next: Partial<NewPatient>) => void;
  errorFor: (name: keyof NewPatient & string) => string | undefined;
  touch: (name: keyof NewPatient & string) => void;
  onUseExisting: (patient: BackendPatient) => void;
}) {
  // Look for an existing record by phone, or by full name, to avoid duplicates.
  const phoneDigits = patient.phone.replace(/[^\d]/g, "");
  const duplicateQuery = phoneDigits.length >= 6
    ? phoneDigits
    : patient.firstName.trim().length >= 2 && patient.lastName.trim().length >= 2
      ? `${patient.firstName.trim()} ${patient.lastName.trim()}`
      : "";
  const { results: possibleMatches } = usePatientSearch(duplicateQuery, 5);

  return (
    <div className="space-y-4">
      {possibleMatches.length ? (
        <div className="rounded-xl border border-warning-fill/40 bg-warning-bg/50 p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-warning-text">
            <Users className="size-4" aria-hidden="true" />
            This patient may already have a record
          </p>
          <ul className="mt-2 divide-y divide-warning-fill/20 overflow-hidden rounded-lg border border-warning-fill/30 bg-background">
            {possibleMatches.map((match) => (
              <li key={match.id}>
                <button type="button" onClick={() => onUseExisting(match)} className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-warning-bg/40">
                  <Avatar name={fullName(match)} size="sm" />
                  <PatientSummary patient={match} />
                  <span className="shrink-0 text-xs font-semibold text-warning-text">Use this record</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="checkin-firstName" label="First name" required error={errorFor("firstName")}>
          <Input autoFocus autoComplete="off" value={patient.firstName} onChange={(event) => onChange({ firstName: event.target.value })} onBlur={() => touch("firstName")} placeholder="e.g. Abena" />
        </FormField>
        <FormField id="checkin-lastName" label="Last name" required error={errorFor("lastName")}>
          <Input autoComplete="off" value={patient.lastName} onChange={(event) => onChange({ lastName: event.target.value })} onBlur={() => touch("lastName")} placeholder="e.g. Mensah" />
        </FormField>
        <FormField id="checkin-age" label="Age" required error={errorFor("age")}>
          <InputAdornment end="years">
            <Input
              inputMode="numeric"
              value={patient.age}
              onChange={(event) => onChange({ age: event.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
              onBlur={() => touch("age")}
              placeholder="e.g. 34"
              className="pr-14"
            />
          </InputAdornment>
        </FormField>
        <SegmentedControl
          id="checkin-sex"
          label="Sex"
          required
          value={patient.sex}
          onChange={(sex) => onChange({ sex })}
          onBlur={() => touch("sex")}
          error={errorFor("sex")}
          options={[
            { value: "female", label: <><Venus aria-hidden="true" />Female</> },
            { value: "male", label: <><Mars aria-hidden="true" />Male</> },
          ]}
        />
        <FormField id="checkin-phone" label="Phone number" required error={errorFor("phone")} className="sm:col-span-2">
          <InputAdornment start={<Phone className="size-3.5" aria-hidden="true" />}>
            <Input inputMode="tel" autoComplete="off" value={patient.phone} onChange={(event) => onChange({ phone: event.target.value })} onBlur={() => touch("phone")} placeholder="e.g. 024 123 4567" className="pl-8" />
          </InputAdornment>
        </FormField>
      </div>
    </div>
  );
}

/**
 * Wraps an input with a leading icon and/or trailing unit. It forwards the id and aria
 * props that FormField injects onto the real input, so labels and errors stay linked.
 */
function InputAdornment({
  start,
  end,
  children,
  ...fieldProps
}: {
  start?: ReactNode;
  end?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <div className="relative">
      {start ? <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted">{start}</span> : null}
      {cloneElement(children, fieldProps)}
      {end ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-muted">{end}</span> : null}
    </div>
  );
}

function Section({
  step,
  done = false,
  title,
  description,
  action,
  children,
}: {
  step: number;
  done?: boolean;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `checkin-section-${step}`;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-border/60 bg-background p-4 shadow-xs sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              done ? "bg-success-fill/15 text-success-text" : "bg-primary/12 text-primary",
            )}
            aria-hidden="true"
          >
            {done ? <Check className="size-3.5" strokeWidth={3} /> : step}
          </span>
          <div>
            <h3 id={headingId} className="text-sm font-semibold text-foreground">{title}</h3>
            {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, hint, spin = false }: { icon: LucideIcon; title: string; hint?: string; spin?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 px-4 py-7 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-primary">
        <Icon className={cn("size-5", spin && "animate-spin")} aria-hidden="true" />
      </span>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-xs text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary",
        size === "sm" ? "size-8 text-[11px]" : "size-9 text-xs",
      )}
      aria-hidden="true"
    >
      {initials(name) || "?"}
    </span>
  );
}

function PatientSummary({ patient }: { patient: BackendPatient }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-semibold text-foreground">{fullName(patient)}</span>
      <span className="mt-0.5 block truncate text-xs text-fg-muted">
        <span className="font-mono">{patient.medical_record_number}</span> · {ageFromDob(patient.date_of_birth)} yrs · <span className="capitalize">{patient.sex}</span>
        {patient.phone ? ` · ${patient.phone}` : ""}
      </span>
      {patient.allergies.length ? (
        <span className="mt-1 inline-flex max-w-full items-center rounded-full bg-danger-fill/10 px-2 py-0.5 text-[11px] font-medium text-danger-text">
          <span className="truncate">Allergies: {patient.allergies.map((allergy) => allergy.allergen).join(", ")}</span>
        </span>
      ) : null}
    </span>
  );
}

function usePatientSearch(query: string, limit = 20) {
  const [results, setResults] = useState<BackendPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const text = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!text) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await listPatients({ search: text, limit, signal: controller.signal });
        setResults(response.items);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof ApiError ? caught.message : "Patient search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, limit]);

  return { results, loading, error };
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function fullName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}
