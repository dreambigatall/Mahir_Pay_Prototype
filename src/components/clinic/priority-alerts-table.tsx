"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ageFromDob } from "@/lib/format";
import { getPatient, getStaff } from "@/lib/mock-data";
import type { LabRequest, Visit } from "@/lib/types";
import { visitBadge } from "@/lib/visit-status";

export function PriorityAlertsTable({
  visits,
  labRequests,
}: {
  visits: Visit[];
  labRequests: LabRequest[];
}) {
  // Find urgent lab visit IDs
  const urgentVisitIds = new Set(
    labRequests
      .filter((l) => l.urgency === "urgent" && l.status !== "result-ready")
      .map((l) => l.visitId),
  );

  // Filter priority visits: long wait time (>15 mins), urgent lab pending, or in consultation
  const priorityVisits = visits.filter(
    (v) =>
      v.status !== "billed" &&
      v.status !== "cancelled" &&
      (v.waitMinutes >= 15 || urgentVisitIds.has(v.id) || v.status === "in-consultation"),
  );

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">
              Priority alerts & active attention
            </h3>
            {priorityVisits.length > 0 && (
              <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-text">
                {priorityVisits.length} requiring focus
              </span>
            )}
          </div>
          <p className="text-[12px] text-fg-muted">
            Patients exceeding wait SLA thresholds or awaiting urgent laboratory diagnostic tests
          </p>
        </div>
      </div>

      <div className="mt-3.5 overflow-hidden rounded-lg border border-border bg-surface-1/30">
        {priorityVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="size-6 text-success-fill" />
            <p className="mt-2 text-[14px] font-medium text-foreground">
              All queues running smoothly
            </p>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              No patients exceeding wait time thresholds or pending urgent lab orders.
            </p>
          </div>
        ) : (
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 w-[32%] px-3 text-[12px] font-medium text-fg-secondary">
                  Patient
                </TableHead>
                <TableHead className="h-10 w-[24%] px-3 text-[12px] font-medium text-fg-secondary">
                  Assigned doctor
                </TableHead>
                <TableHead className="h-10 w-[20%] px-3 text-[12px] font-medium text-fg-secondary">
                  Stage
                </TableHead>
                <TableHead className="h-10 w-[14%] px-3 text-[12px] font-medium text-fg-secondary">
                  Wait time
                </TableHead>
                <TableHead className="h-10 w-[10%] px-3 text-right text-[12px] font-medium text-fg-secondary">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priorityVisits.map((visit) => {
                const patient = getPatient(visit.patientId);
                const doctor = getStaff(visit.doctorId);
                const badge = visitBadge(visit.status);
                const hasUrgentLab = urgentVisitIds.has(visit.id);
                const overSla = visit.waitMinutes > 20;

                if (!patient) return null;

                return (
                  <TableRow key={visit.id} className="h-11 hover:bg-surface-1/60">
                    {/* Patient Name & Code */}
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {patient.name}
                        </p>
                        {hasUrgentLab && (
                          <span
                            title="Urgent lab test pending"
                            className="inline-flex shrink-0 items-center text-danger-text"
                          >
                            <AlertTriangle className="size-3" />
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-fg-muted">
                        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}
                        {patient.gender}
                      </p>
                    </TableCell>

                    {/* Doctor & Room */}
                    <TableCell className="px-3 py-2 text-[13px] text-fg-secondary">
                      <p className="truncate font-medium">{doctor?.name ?? "Unassigned"}</p>
                      {doctor?.room && (
                        <p className="font-mono text-[11px] text-fg-muted">
                          {doctor.room}
                        </p>
                      )}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="px-3 py-2">
                      <StatusBadge role={badge.role} className="text-[11px]">
                        {badge.label}
                      </StatusBadge>
                    </TableCell>

                    {/* Wait Time with SLA Highlight */}
                    <TableCell className="px-3 py-2 font-mono text-[12px]">
                      <span
                        className={
                          overSla
                            ? "font-semibold text-danger-text"
                            : visit.waitMinutes >= 15
                              ? "font-medium text-warning-text"
                              : "text-fg-muted"
                        }
                      >
                        <Clock className="mr-1 inline-block size-3" />
                        {visit.waitMinutes}m
                      </span>
                    </TableCell>

                    {/* Link */}
                    <TableCell className="px-3 py-2 text-right">
                      <Link
                        href={`/receptionist/visits/${visit.id}`}
                        className="inline-flex items-center gap-0.5 text-[12px] font-medium text-clinical-text hover:underline"
                      >
                        <span>View</span>
                        <ArrowUpRight className="size-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
