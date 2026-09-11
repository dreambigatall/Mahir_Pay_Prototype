"use client";

import { useEffect, useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { assignVisitDoctor, type BackendVisit } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";

const UNASSIGNED = "__unassigned__";

/** Doctor can only be assigned/changed before consultation starts. */
export const DOCTOR_ASSIGNABLE_STATUSES = new Set(["awaiting_triage", "awaiting_doctor"]);

export function canAssignVisitDoctor(visitStatus?: string | null) {
  return Boolean(visitStatus && DOCTOR_ASSIGNABLE_STATUSES.has(visitStatus));
}

type Props = {
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [doctorId, setDoctorId] = useState(currentDoctorId ?? UNASSIGNED);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const editable = canAssignVisitDoctor(visitStatus);
  const hasDoctor = Boolean(currentDoctorId || currentDoctorName);
  const label = hasDoctor ? "Change doctor" : "Assign doctor";

  useEffect(() => {
    if (!open) return;
    setDoctorId(currentDoctorId ?? UNASSIGNED);
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
  }, [open, currentDoctorId]);

  if (!editable) return null;

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const nextDoctorId = doctorId === UNASSIGNED ? null : doctorId;
      const response = await assignVisitDoctor(visitId, nextDoctorId);
      announceCoreDataChanged();
      toast.success(nextDoctorId ? "Doctor assigned" : "Doctor unassigned", {
        description: nextDoctorId
          ? `${patientName ?? "Patient"} is assigned to ${response.item.doctor_name ?? "the selected doctor"}.`
          : `${patientName ?? "Patient"} has no assigned doctor.`,
      });
      onAssigned?.(response.item);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Doctor could not be updated.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className ?? "min-h-9 w-full gap-1.5"}>
          <Stethoscope className="size-3.5" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {patientName
              ? `Choose the consulting doctor for ${patientName}. This can only be changed before consultation starts.`
              : "Choose the consulting doctor for this visit. This can only be changed before consultation starts."}
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
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
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
          <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting || loadingDoctors} onClick={() => void submit()}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
