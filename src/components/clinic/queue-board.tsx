"use client";

import Link from "next/link";
import { GripVertical } from "lucide-react";

import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff } from "@/lib/mock-data";
import type { Visit } from "@/lib/types";
import { QUEUE_COLUMNS, visitDot } from "@/lib/visit-status";

export function QueueBoard({
  visits,
  hrefFor,
}: {
  visits: Visit[];
  hrefFor: (visit: Visit) => string;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {QUEUE_COLUMNS.map((column) => {
        const cards = visits.filter((visit) =>
          column.statuses.includes(visit.status),
        );
        return (
          <div
            key={column.id}
            className="w-[280px] shrink-0 rounded-xl bg-surface-1 p-3"
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <p className="text-[13px] font-medium text-foreground">{column.title}</p>
              <span className="font-mono text-[12px] font-medium text-fg-muted">
                {cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-fg-muted">
                  No patients in this stage
                </p>
              ) : (
                cards.map((visit) => (
                  <QueueCard
                    key={visit.id}
                    visit={visit}
                    href={hrefFor(visit)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QueueCard({ visit, href }: { visit: Visit; href: string }) {
  const { patients } = useClinic();
  const patient =
    patients.find((p) => p.id === visit.patientId) || getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) return null;

  const overSla = visit.waitMinutes > 20;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
<<<<<<< HEAD
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="size-3.5 text-fg-muted shrink-0" />
          <p className="text-[14px] font-medium text-foreground truncate">{patient.name}</p>
=======
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3.5 text-primary" />
          <p className="text-[14px] font-medium text-primary">{patient.name}</p>
>>>>>>> 236a1b0 (¨Color_Update¨)
        </div>
        <span className={`mt-1 size-2 shrink-0 rounded-full ${visitDot(visit.status)}`} />
      </div>

      <p className="mt-1 font-mono text-[11px] text-fg-muted">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}{patient.gender}
      </p>
<<<<<<< HEAD

      <p className="mt-2 text-[13px] text-foreground truncate">
        {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
      </p>
      <p className="text-[12px] text-fg-secondary truncate">{visit.reason}</p>
      {visit.kind === "procedure" ? (
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-clinical-text">
          Injection / vaccine
=======
      <p className="mt-2 text-[13px] text-fg-secondary">
        {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
      </p>
      <p className="text-[13px] text-fg-muted">{visit.reason}</p>
      {visit.status !== "billed" ? (
        <p className={`text-[12px] ${overSla ? "text-warning-text" : "text-fg-muted"}`}>
          Waiting {visit.waitMinutes} min
>>>>>>> 236a1b0 (¨Color_Update¨)
        </p>
      ) : null}

      <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
        {visit.status !== "billed" ? (
          <span className={overSla ? "font-semibold text-danger-text" : "text-fg-muted font-mono"}>
            Waiting {visit.waitMinutes}m
          </span>
        ) : (
          <span className="text-success-text font-medium">Visit closed</span>
        )}

        <span className="font-mono text-fg-muted text-[10px] uppercase">
          {visit.id.slice(-6)}
        </span>
      </div>
    </Link>
  );
}
