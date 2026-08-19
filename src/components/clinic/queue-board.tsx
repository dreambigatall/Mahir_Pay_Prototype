import Link from "next/link";
import { GripVertical } from "lucide-react";

import { getPatient, getStaff } from "@/lib/mock-data";
import { ageFromDob } from "@/lib/format";
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
              <p className="text-[13px] font-medium">{column.title}</p>
              <span className="text-[12px] text-fg-muted">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-fg-muted">
                  No patients waiting
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
  const patient = getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) return null;

  const overSla = visit.waitMinutes > 20;

  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="size-3.5 text-fg-muted" />
          <p className="text-[14px] font-medium">{patient.name}</p>
        </div>
        <span className={`mt-1 size-2 shrink-0 rounded-full ${visitDot(visit.status)}`} />
      </div>
      <p className="mt-1 font-mono text-[12px] text-fg-muted">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}
        {patient.gender}
      </p>
      <p className="mt-2 text-[13px]">
        {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
      </p>
      <p className="text-[13px] text-fg-secondary">{visit.reason}</p>
      {visit.status !== "billed" ? (
        <p className={`text-[12px] ${overSla ? "text-warning-text" : "text-fg-muted"}`}>
          Waiting {visit.waitMinutes} min
        </p>
      ) : (
        <p className="text-[12px] text-fg-muted">Visit closed</p>
      )}
    </Link>
  );
}
