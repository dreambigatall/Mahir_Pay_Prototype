"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { updatePatient, type BackendPatient } from "@/lib/api/patients";
import { listDoctors, type BackendDoctor } from "@/lib/api/staff";
import { assignVisitDoctor, getActiveVisitByPatient, type BackendVisit } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";
import { ageFromDob, dobFromAge } from "@/lib/format";

const UNASSIGNED = "__unassigned__";

type Props = {
  patient: BackendPatient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditPatientDialog({ patient, open, onOpenChange }: Props) {
  const [firstName, setFirstName] = useState(patient.first_name);
  const [lastName, setLastName] = useState(patient.last_name);
  const [age, setAge] = useState(String(ageFromDob(patient.date_of_birth)));
  const [sex, setSex] = useState<BackendPatient["sex"]>(patient.sex === "male" ? "male" : "female");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [doctorId, setDoctorId] = useState(UNASSIGNED);
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [activeVisit, setActiveVisit] = useState<BackendVisit | null>(null);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(patient.first_name);
    setLastName(patient.last_name);
    setAge(String(ageFromDob(patient.date_of_birth)));
    setSex(patient.sex === "male" ? "male" : "female");
    setPhone(patient.phone ?? "");
    setError("");
  }, [open, patient]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    listDoctors()
      .then((response) => { if (active) setDoctors(response.items); })
      .catch(() => { if (active) setDoctors([]); });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingVisit(true);
    getActiveVisitByPatient(patient.id, controller.signal)
      .then((response) => {
        setActiveVisit(response.item);
        setDoctorId(response.item?.doctor_id ?? UNASSIGNED);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setActiveVisit(null);
          setDoctorId(UNASSIGNED);
          if (!(caught instanceof ApiError && caught.status === 404)) {
            setError(caught instanceof ApiError ? caught.message : "Could not load the active visit.");
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingVisit(false);
      });
    return () => controller.abort();
  }, [open, patient.id]);

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
    try {
      await updatePatient(patient.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: patient.middle_name ?? undefined,
        dateOfBirth: dobFromAge(parsedAge),
        sex,
        phone: phone.trim(),
        email: patient.email ?? undefined,
        address: patient.address ?? undefined,
        emergencyContactName: patient.emergency_contact_name ?? undefined,
        emergencyContactPhone: patient.emergency_contact_phone ?? undefined,
        bloodGroup: patient.blood_group ?? undefined,
        allergies: patient.allergies.map((allergy) => ({
          allergen: allergy.allergen,
          reaction: allergy.reaction ?? undefined,
          severity: allergy.severity ?? undefined,
        })),
      });

      if (activeVisit) {
        const nextDoctorId = doctorId === UNASSIGNED ? null : doctorId;
        if (nextDoctorId !== activeVisit.doctor_id) {
          await assignVisitDoctor(activeVisit.id, nextDoctorId);
        }
      }

      announceCoreDataChanged();
      toast.success("Patient updated", {
        description: activeVisit
          ? "Profile saved. Doctor assignment updated for the active visit."
          : "Profile saved. Check the patient in to assign a doctor to a visit.",
      });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The patient could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit patient</DialogTitle>
          <DialogDescription>
            {patient.medical_record_number}
            {activeVisit ? ` · Active visit ${activeVisit.visit_number}` : " · No active visit"}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name *" htmlFor="edit-first-name"><Input id="edit-first-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></Field>
            <Field label="Last name *" htmlFor="edit-last-name"><Input id="edit-last-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Age *" htmlFor="edit-age"><Input id="edit-age" required inputMode="numeric" value={age} onChange={(event) => setAge(event.target.value.replace(/[^\d]/g, ""))} /></Field>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-sex">Sex *</Label>
              <Select value={sex} onValueChange={(value) => setSex(value as BackendPatient["sex"])}>
                <SelectTrigger id="edit-sex" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field label="Phone number *" htmlFor="edit-phone"><Input id="edit-phone" required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-doctor">Assigned doctor (optional)</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={!activeVisit || loadingVisit}>
              <SelectTrigger id="edit-doctor" className="w-full"><SelectValue placeholder={loadingVisit ? "Loading…" : "Unassigned"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name}{doctor.room ? ` · ${doctor.room}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingVisit && !activeVisit ? (
              <p className="text-xs text-fg-muted">No open visit. Doctor can be assigned at the next check-in.</p>
            ) : null}
          </div>
          {error ? <div role="alert" className="flex gap-2 rounded-lg border border-danger-fill/30 bg-danger-fill/10 p-3 text-sm text-danger-text"><AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</div> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{submitting ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPatientButton({ patient }: { patient: BackendPatient }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Edit
      </Button>
      <EditPatientDialog patient={patient} open={open} onOpenChange={setOpen} />
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}
