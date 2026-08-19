"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { RegisterPatientDialog } from "@/components/clinic/register-patient-dialog";
import { Input } from "@/components/ui/input";
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
import { patients, todaysVisits } from "@/lib/mock-data";
import { visitBadge } from "@/lib/visit-status";

export default function PatientsPage() {
  const [query, setQuery] = useState("");
  const today = todaysVisits();

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
  }, [query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Patients"
        description="Search by name, phone, or patient ID."
        action={<RegisterPatientDialog />}
      />
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search patients"
          className="pl-9"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Patient
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                ID
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Phone
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Today
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((patient) => {
              const visit = today.find((item) => item.patientId === patient.id);
              const badge = visit ? visitBadge(visit.status) : null;
              return (
                <TableRow key={patient.id} className="h-11">
                  <TableCell>
                    {visit ? (
                      <>
                        <Link
                          href={`/receptionist/visits/${visit.id}`}
                          className="font-medium hover:underline"
                        >
                          {patient.name}
                        </Link>
                        <p className="text-[12px] text-fg-muted">
                          {ageFromDob(patient.dateOfBirth)}
                          {patient.gender}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-[12px] text-fg-muted">
                          {ageFromDob(patient.dateOfBirth)}
                          {patient.gender}
                        </p>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[13px] text-fg-secondary">
                    {patient.patientId}
                  </TableCell>
                  <TableCell className="text-fg-secondary">{patient.phone}</TableCell>
                  <TableCell>
                    {badge ? (
                      <StatusBadge role={badge.role}>{badge.label}</StatusBadge>
                    ) : (
                      <span className="text-[13px] text-fg-muted">No visit</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
