"use client";

import { Stethoscope, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPatient, staff } from "@/lib/mock-data";
import type { Visit } from "@/lib/types";

export function DoctorRoomStatus({ visits }: { visits: Visit[] }) {
  const doctors = staff.filter((person) => person.role === "doctor");

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">
            Doctor & room status
          </h3>
          <p className="text-[12px] text-fg-muted">
            Consultation rooms and staff occupancy
          </p>
        </div>
        <Stethoscope className="size-4 text-fg-muted" />
      </div>

      <div className="mt-3.5 space-y-2.5">
        {doctors.map((doctor) => {
          const docVisits = visits.filter((v) => v.doctorId === doctor.id);
          const activeVisit = docVisits.find((v) => v.status === "in-consultation");
          const waitingCount = docVisits.filter((v) => v.status === "registered").length;
          const activePatient = activeVisit ? getPatient(activeVisit.patientId) : null;

          return (
            <div
              key={doctor.id}
              className="rounded-lg border border-border bg-surface-1/70 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-foreground">
                      {doctor.name}
                    </p>
                    {doctor.room && (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-fg-secondary border border-border">
                        {doctor.room}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-fg-muted">{doctor.title}</p>
                </div>

                {activeVisit ? (
                  <StatusBadge role="clinical" className="text-[11px]">
                    In room
                  </StatusBadge>
                ) : (
                  <StatusBadge role="success" className="text-[11px]">
                    Available
                  </StatusBadge>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[12px]">
                {activePatient ? (
                  <span className="flex items-center gap-1 text-clinical-text font-medium truncate">
                    <UserRound className="size-3 shrink-0" />
                    <span className="truncate">{activePatient.name}</span>
                  </span>
                ) : (
                  <span className="text-fg-muted">No patient in room</span>
                )}

                <div className="flex items-center gap-2 font-mono text-[11px] text-fg-muted">
                  {waitingCount > 0 && (
                    <span className="text-warning-text font-medium">
                      {waitingCount} waiting
                    </span>
                  )}
                  <span>{docVisits.length} total</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
