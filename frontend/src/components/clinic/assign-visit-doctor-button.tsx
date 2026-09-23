"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ArrowRight, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { listDoctors, type BackendDoctor } from "@/lib/api/staff";
import { assignVisitDoctor, sendVisitToDoctor, type BackendVisit } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";

const UNASSIGNED = "__unassigned__";

/** Doctor can only be assigned/changed before consultation starts. */
export const DOCTOR_ASSIGNABLE_STATUSES = new Set(["awaiting_triage", "awaiting_doctor"]);

export function canAssignVisitDoctor(visitStatus?: string | null) {
  return Boolean(visitStatus && DOCTOR_ASSIGNABLE_STATUSES.has(visitStatus));
}

/** Shared doctor-picker dialog used by both the standalone assign button and the send-to-doctor flow below. */
function AssignDoctorDialog({
  open,
  onOpenChange,
  visitId,
  currentDoctorId,
  patientName,
  allowUnassigned = true,
  title,
  description,
  confirmLabel = "Save",
  confirmIcon,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string;
  currentDoctorId?: string | null;
  patientName?: string;
  allowUnassigned?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmIcon?: ReactNode;
  onAssigned: (visit: BackendVisit) => void | Promise<void>;
}) {
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [doctorId, setDoctorId] = useState(currentDoctorId ?? (allowUnassigned ? UNASSIGNED : ""));
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDoctorId(currentDoctorId ?? (allowUnassigned ? UNASSIGNED : ""));
    setError("");
    let active = true;
    setLoadingDoctors(true);
    listDoctors()
      .then((response) => {
        if (active) setDoctors(response.items);
      })
      .catch(() => {
        if (active) setDoctors([]);
      })
      .finally(() => {
        if (active) setLoadingDoctors(false);
      });
    return () => {
      active = false;
    };
  }, [open, currentDoctorId, allowUnassigned]);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const nextDoctorId = doctorId === UNASSIGNED ? null : doctorId;
      const response = await assignVisitDoctor(visitId, nextDoctorId);
      announceCoreDataChanged();
      await onAssigned(response.item);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Doctor could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? "Assign doctor"}</DialogTitle>
          <DialogDescription>
            {description
              ?? (patientName
                ? `Choose the consulting doctor for ${patientName}. This can only be changed before consultation starts.`
                : "Choose the consulting doctor for this visit. This can only be changed before consultation starts.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`assign-doctor-${visitId}`}>Doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={loadingDoctors || submitting}>
              <SelectTrigger id={`assign-doctor-${visitId}`} className="w-full min-h-11">
                <SelectValue placeholder={loadingDoctors ? "Loading doctors…" : "Select doctor"} />
              </SelectTrigger>
              <SelectContent>
                {allowUnassigned ? <SelectItem value={UNASSIGNED}>Unassigned</SelectItem> : null}
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                    {doctor.room ? ` · ${doctor.room}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger-text">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={submitting || loadingDoctors || (!allowUnassigned && !doctorId)}
            onClick={() => void submit()}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : confirmIcon}
            {submitting ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AssignButtonProps = {
  visitId: string;
  currentDoctorId?: string | null;
  currentDoctorName?: string | null;
  visitStatus?: string | null;
  patientName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onAssigned?: (visit: BackendVisit) => void;
};

export function AssignVisitDoctorButton({
  visitId,
  currentDoctorId = null,
  currentDoctorName = null,
  visitStatus = null,
  patientName,
  variant = "outline",
  size = "sm",
  className,
  onAssigned,
}: AssignButtonProps) {
  const [open, setOpen] = useState(false);

  const editable = canAssignVisitDoctor(visitStatus);
  const hasDoctor = Boolean(currentDoctorId || currentDoctorName);
  const label = hasDoctor ? "Change doctor" : "Assign doctor";

  if (!editable) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className ?? "min-h-9 w-full gap-1.5"}
        onClick={() => setOpen(true)}
      >
        <Stethoscope className="size-3.5" aria-hidden="true" />
        {label}
      </Button>
      <AssignDoctorDialog
        open={open}
        onOpenChange={setOpen}
        visitId={visitId}
        currentDoctorId={currentDoctorId}
        patientName={patientName}
        title={label}
        onAssigned={(visit) => {
          toast.success(visit.doctor_id ? "Doctor assigned" : "Doctor unassigned", {
            description: visit.doctor_id
              ? `${patientName ?? "Patient"} is assigned to ${visit.doctor_name ?? "the selected doctor"}.`
              : `${patientName ?? "Patient"} has no assigned doctor.`,
          });
          onAssigned?.(visit);
        }}
      />
    </>
  );
}

type SendToDoctorButtonProps = {
  visitId: string;
  doctorId?: string | null;
  doctorName?: string | null;
  patientName?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  onSent: (visit: BackendVisit) => void;
};

/**
 * Moves a visit into the doctor queue. If no doctor is assigned yet, it opens the same
 * doctor picker used elsewhere in the app first, then continues straight into the send —
 * one motion instead of "fail, go find the assign button, come back, retry."
 */
export function SendToDoctorButton({
  visitId,
  doctorId = null,
  doctorName = null,
  patientName,
  variant = "default",
  size = "default",
  className,
  onSent,
}: SendToDoctorButtonProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const hasDoctor = Boolean(doctorId || doctorName);

  async function send() {
    setSending(true);
    try {
      const response = await sendVisitToDoctor(visitId);
      onSent(response.item);
      announceCoreDataChanged();
      toast.success("Sent to doctor queue", {
        description: response.item.doctor_name
          ? `${patientName ?? response.item.patient_name ?? "Patient"} is waiting for ${response.item.doctor_name}.`
          : `${patientName ?? "Patient"} is waiting for consultation.`,
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not send the patient to the doctor.");
    } finally {
      setSending(false);
    }
  }

  async function sendAfterAssign(assignedVisit: BackendVisit) {
    setSending(true);
    try {
      const response = await sendVisitToDoctor(visitId);
      onSent(response.item);
      announceCoreDataChanged();
      toast.success("Doctor assigned & sent to queue", {
        description: `${patientName ?? response.item.patient_name ?? "Patient"} is now waiting for ${response.item.doctor_name ?? assignedVisit.doctor_name ?? "the doctor"}.`,
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Doctor was assigned, but the patient could not be sent yet.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className ?? "gap-1.5"}
        disabled={sending}
        onClick={() => (hasDoctor ? void send() : setAssignOpen(true))}
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : hasDoctor ? (
          <ArrowRight className="size-4" aria-hidden="true" />
        ) : (
          <Stethoscope className="size-4" aria-hidden="true" />
        )}
        {sending ? "Sending…" : hasDoctor ? "Send to doctor" : "Assign & send to doctor"}
      </Button>
      <AssignDoctorDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        visitId={visitId}
        currentDoctorId={doctorId}
        patientName={patientName}
        allowUnassigned={false}
        title="Assign a doctor to continue"
        description={
          patientName
            ? `Pick who will see ${patientName} — they'll be sent to the doctor queue as soon as you save.`
            : "Pick a doctor. The patient will be sent to the doctor queue as soon as you save."
        }
        confirmLabel="Assign & send"
        confirmIcon={<ArrowRight className="size-4" aria-hidden="true" />}
        onAssigned={sendAfterAssign}
      />
    </>
  );
}
