"use client";

import { useEffect, useState } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listDoctors, type BackendDoctor } from "@/lib/api/staff";
import { listQueue } from "@/lib/api/workflow";

export const UNASSIGNED_DOCTOR = "__unassigned__";

/**
 * Doctor picker that shows each doctor's current queue ("3 waiting"),
 * so reception can spread patients across doctors.
 */
export function DoctorSelect({
  id = "assigned-doctor",
  label = "Doctor",
  value,
  onChange,
  disabled,
  hint = "Optional · leave unassigned to send the patient to triage first.",
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [waiting, setWaiting] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    listDoctors()
      .then((response) => { if (active) setDoctors(response.items); })
      .catch(() => { if (active) setDoctors([]); });
    listQueue("doctor")
      .then((response) => {
        if (!active) return;
        const counts: Record<string, number> = {};
        for (const entry of response.items) {
          if (entry.doctor_id && entry.status === "waiting") counts[entry.doctor_id] = (counts[entry.doctor_id] ?? 0) + 1;
        }
        setWaiting(counts);
      })
      .catch(() => { /* counts are a hint only */ });
    return () => { active = false; };
  }, []);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[13px] font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" aria-describedby={hint ? `${id}-hint` : undefined}>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED_DOCTOR}>Unassigned</SelectItem>
          {doctors.map((doctor) => {
            const count = waiting[doctor.id] ?? 0;
            return (
              <SelectItem key={doctor.id} value={doctor.id}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span>{doctor.full_name}{doctor.room ? ` · ${doctor.room}` : ""}</span>
                  <span className={count >= 5 ? "text-xs font-medium text-warning-text" : "text-xs text-fg-muted"}>
                    {count ? `${count} waiting` : "free"}
                  </span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {hint ? <p id={`${id}-hint`} className="text-[12px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}
