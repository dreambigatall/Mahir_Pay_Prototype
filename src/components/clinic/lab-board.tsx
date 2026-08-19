import Link from "next/link";
import { FlaskConical } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { groupLabsByVisit } from "@/lib/lab-groups";
import { getPatient, getStaff, getVisit } from "@/lib/mock-data";
import type { LabRequest } from "@/lib/types";
import { LAB_COLUMNS } from "@/lib/visit-status";

export function LabBoard({ requests }: { requests: LabRequest[] }) {
  const groups = groupLabsByVisit(requests);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {LAB_COLUMNS.map((column) => {
        const cards = groups.filter((group) => group.status === column.id);
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
                  No patients in this stage
                </p>
              ) : (
                cards.map((group) => (
                  <LabPatientCard key={group.visitId} group={group} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LabPatientCard({
  group,
}: {
  group: ReturnType<typeof groupLabsByVisit>[number];
}) {
  const visit = getVisit(group.visitId);
  const patient = visit ? getPatient(visit.patientId) : undefined;
  const doctor = getStaff(group.doctorId);
  if (!patient) return null;

  const countLabel = group.testCount === 1 ? "1 test" : `${group.testCount} tests`;

  return (
    <Link
      href={`/lab/visits/${group.visitId}`}
      className="block rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="size-3.5 text-fg-muted" />
          <p className="text-[14px] font-medium">{patient.name}</p>
        </div>
        {group.urgent ? (
          <StatusBadge role="danger">Urgent</StatusBadge>
        ) : (
          <StatusBadge role="neutral">Routine</StatusBadge>
        )}
      </div>
      <p className="mt-1 font-mono text-[12px] text-fg-muted">{patient.patientId}</p>
      <p className="mt-2 text-[13px] font-medium tabular-nums">{countLabel}</p>
      <p className="text-[12px] text-fg-secondary">
        {group.requests.map((request) => request.testName).join(", ")}
      </p>
      <p className="mt-1 text-[12px] text-fg-muted">{doctor?.name}</p>
    </Link>
  );
}
