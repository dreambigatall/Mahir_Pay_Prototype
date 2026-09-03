"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { createPatient, listPatients, type BackendPatient } from "@/lib/api/patients";
import { listDoctors, type BackendDoctor } from "@/lib/api/staff";
import { checkInPatient } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";
import { ageFromDob, dobFromAge } from "@/lib/format";
import { cn } from "@/lib/utils";

type Mode = "new" | "returning";
const UNASSIGNED = "__unassigned__";

export function LiveRegisterPatientDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("new");

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setMode("new"); }}>
      <DialogTrigger asChild>
        <Button className="mr-2 mt-1 min-h-11 gap-2 px-5 shadow-sm">
          <Plus className="size-4" aria-hidden="true" />
          Register patient
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[95vh] w-full flex-col overflow-hidden p-6 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Register or check in patient</DialogTitle>
          <DialogDescription>Create a new medical record or locate an existing patient.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2" role="tablist" aria-label="Patient registration mode">
          {([
            { id: "new" as const, label: "New walk-in", icon: UserPlus },
            { id: "returning" as const, label: "Returning patient", icon: Search },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm transition-colors", mode === id ? "border-primary bg-primary font-semibold text-primary-foreground" : "border-border bg-surface-1 text-fg-secondary hover:bg-surface-2")}>
              <Icon className="size-4" aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        {mode === "new" ? <NewPatientForm onDone={() => setOpen(false)} /> : <ReturningPatientForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function NewPatientForm({ onDone }: { onDone: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BackendPatient["sex"]>("female");
  const [phone, setPhone] = useState("");
  const [doctorId, setDoctorId] = useState(UNASSIGNED);
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    listDoctors()
      .then((response) => { if (active) setDoctors(response.items); })
      .catch(() => { if (active) setDoctors([]); });
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 150) {
      setError("Enter a valid age between 0 and 150.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setSubmitting(true);
    let patient: BackendPatient | null = null;
    try {
      const created = await createPatient({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dobFromAge(parsedAge),
        sex,
        phone: phone.trim(),
        allergies: [],
      });
      patient = created.item;
      await checkInPatient({
        patientId: patient.id,
        reason: "Consultation",
        ...(doctorId !== UNASSIGNED ? { doctorId } : {}),
      });
      announceCoreDataChanged();
      toast.success("Patient registered and checked in", {
        description: doctorId !== UNASSIGNED
          ? `${fullName(patient)} is now on the assigned doctor's queue.`
          : `${fullName(patient)} · ${patient.medical_record_number} — waiting for triage.`,
      });
      onDone();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "The patient could not be registered.";
      if (patient) {
        announceCoreDataChanged();
        toast.warning("Patient profile saved, but check-in failed", { description: message });
        onDone();
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="grid gap-4 pb-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *" htmlFor="first-name"><Input id="first-name" required autoFocus value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
            <Field label="Last name *" htmlFor="last-name"><Input id="last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Age *" htmlFor="patient-age"><Input id="patient-age" required inputMode="numeric" min={0} max={150} value={age} onChange={(event) => setAge(event.target.value.replace(/[^\d]/g, ""))} placeholder="Years" /></Field>
            <div className="grid gap-1.5">
              <Label htmlFor="sex">Sex *</Label>
              <Select value={sex} onValueChange={(value) => setSex(value as BackendPatient["sex"])}>
                <SelectTrigger id="sex" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field label="Phone number *" htmlFor="patient-phone"><Input id="patient-phone" required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          <DoctorSelect doctors={doctors} value={doctorId} onChange={setDoctorId} />
          {error ? <div role="alert" className="flex gap-2 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</div> : null}
        </div>
      </ScrollArea>
      <DialogFooter className="pt-3"><Button type="submit" className="min-h-11" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitting ? "Saving patient…" : "Save and check in"}</Button></DialogFooter>
    </form>
  );
}

function ReturningPatientForm({ onDone }: { onDone: () => void }) {
  const [query, setQuery] = useState("");
  const [doctorId, setDoctorId] = useState(UNASSIGNED);
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [patients, setPatients] = useState<BackendPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listDoctors()
      .then((response) => { if (active) setDoctors(response.items); })
      .catch(() => { if (active) setDoctors([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!query.trim()) { setPatients([]); setLoading(false); return; }
      setLoading(true); setError("");
      try {
        const response = await listPatients({ search: query, limit: 20, signal: controller.signal });
        setPatients(response.items);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof ApiError ? caught.message : "Patient search failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function checkIn(patient: BackendPatient) {
    setCheckingInId(patient.id); setError("");
    try {
      await checkInPatient({
        patientId: patient.id,
        reason: "Follow-up consultation",
        ...(doctorId !== UNASSIGNED ? { doctorId } : {}),
      });
      announceCoreDataChanged();
      toast.success("Patient checked in", {
        description: doctorId !== UNASSIGNED
          ? `${fullName(patient)} is now on the assigned doctor's queue.`
          : `${fullName(patient)} is waiting for triage.`,
      });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Patient check-in failed.");
    } finally {
      setCheckingInId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Field label="Search patient" htmlFor="patient-search"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" /><Input id="patient-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, or patient ID" className="pl-9" /></div></Field>
      <DoctorSelect doctors={doctors} value={doctorId} onChange={setDoctorId} />
      {error ? <div role="alert" className="rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text">{error}</div> : null}
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="space-y-2 pb-3">
          {!query.trim() ? <SearchMessage text="Search by patient name, phone number, or medical record number." /> : loading ? <SearchMessage text="Searching patient records…" loading /> : patients.length === 0 ? <SearchMessage text="No matching patient records were found." /> : patients.map((patient) => (
            <button key={patient.id} type="button" disabled={checkingInId !== null} onClick={() => checkIn(patient)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-60">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{fullName(patient)}</p><p className="mt-1 text-xs text-fg-muted">{patient.medical_record_number} · {ageFromDob(patient.date_of_birth)} yrs · {patient.sex}</p></div>
              <span className="shrink-0 text-xs font-medium text-primary">{checkingInId === patient.id ? "Checking in…" : "Check in"}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DoctorSelect({
  doctors,
  value,
  onChange,
  id = "assigned-doctor",
}: {
  doctors: BackendDoctor[];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>Assigned doctor (optional)</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {doctors.map((doctor) => (
            <SelectItem key={doctor.id} value={doctor.id}>
              {doctor.full_name}{doctor.room ? ` · ${doctor.room}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function SearchMessage({ text, loading = false }: { text: string; loading?: boolean }) {
  return <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-sm text-fg-muted">{loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}<p>{text}</p></div>;
}

function fullName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}
