"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserCheck, Users, X } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { RegisterPatientDialog } from "@/components/clinic/register-patient-dialog";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getStaff } from "@/lib/mock-data";
import { visitBadge } from "@/lib/visit-status";

export default function PatientsPage() {
  const { patients, visits, courses, ready } = useClinic();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((patient) => {
      if (!q) return true;
      return (
        patient.name.toLowerCase().includes(q) ||
        patient.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        patient.patientId.toLowerCase().includes(q)
      );
    });
  }, [patients, query]);

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patients directory"
        description="Master registry of all clinic patients, contact details, and visit activity."
        action={<RegisterPatientDialog />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, phone number, or patient ID…"
            className="h-9 pl-9 pr-8 text-[13px]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-[13px] text-fg-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 text-fg-muted" />
            <span>Total registered: <strong>{patients.length}</strong></span>
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-fg-muted">
          No patients match your search criteria. Click &ldquo;Register patient&rdquo; to add a new profile.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[35%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patient name & demographics
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patient ID
                </TableHead>
                <TableHead className="h-11 w-[25%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Phone & emergency
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Current visit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((patient) => {
                const visit = visits.find((item) => item.patientId === patient.id);
                const activeCourse = courses.find(
                  (course) =>
                    course.patientId === patient.id && course.status === "active",
                );
                const badge = visit ? visitBadge(visit.status) : null;
                const assignedDoctor = visit ? getStaff(visit.doctorId) : null;

                return (
                  <TableRow key={patient.id} className="h-12 hover:bg-surface-1/60">
                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="font-medium text-[14px] text-foreground truncate">
                        {patient.name}
                      </p>
                      <p className="text-[12px] text-fg-muted">
                        {ageFromDob(patient.dateOfBirth)} yrs ·{" "}
                        {patient.gender === "F" ? "Female" : "Male"}
                        {patient.allergies?.length > 0 && (
                          <span className="ml-2 font-medium text-danger-text">
                            · Allergies: {patient.allergies.join(", ")}
                          </span>
                        )}
                      </p>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left font-mono text-[13px] text-fg-secondary">
                      {patient.patientId}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="font-mono text-[13px] text-foreground">{patient.phone}</p>
                      {patient.emergencyContact && (
                        <p className="text-[11px] text-fg-muted truncate">
                          ICE: {patient.emergencyContact}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      {activeCourse ? (
                        <Link
                          href={`/receptionist/courses/${activeCourse.id}`}
                          className="group inline-flex flex-col"
                        >
                          <Chip variant="clinical">Injection course</Chip>
                          <span className="text-[11px] text-fg-muted mt-0.5 group-hover:underline">
                            {activeCourse.procedureName}
                          </span>
                        </Link>
                      ) : visit && badge ? (
                        <Link
                          href={
                            visit.kind === "procedure" && visit.courseId
                              ? `/receptionist/courses/${visit.courseId}`
                              : visit.status === "ready-for-billing" || visit.status === "billed"
                                ? `/receptionist/billing/${visit.id}`
                                : `/receptionist/visits/${visit.id}`
                          }
                          className="group inline-flex flex-col"
                        >
                          <Chip variant={badge.role}>{badge.label}</Chip>
                          {assignedDoctor && (
                            <span className="text-[11px] text-fg-muted mt-0.5 group-hover:underline">
                              {assignedDoctor.name}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-[13px] text-fg-muted">No active visit</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
