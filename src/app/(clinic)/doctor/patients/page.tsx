"use client";

import Link from "next/link";

import { PageHeader } from "@/components/clinic/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ageFromDob } from "@/lib/format";
import { getPatient, visitsForDoctor } from "@/lib/mock-data";
import { useClinic } from "@/lib/clinic-store";
import { useSession } from "@/lib/session";

export default function DoctorPatientsPage() {
  const { user } = useSession();
  const { visits } = useClinic();
  const mine = user ? visitsForDoctor(user.id, visits) : [];
  const unique = Array.from(new Map(mine.map((visit) => [visit.patientId, visit])).values());

  return (
    <div className="space-y-5">
      <PageHeader
        title="My patients"
        description="Patients on your list today."
      />
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Patient
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Reason
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Visit
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unique.map((visit) => {
              const patient = getPatient(visit.patientId);
              if (!patient) return null;
              return (
                <TableRow key={visit.id} className="h-11">
                  <TableCell>
                    <Link
                      href={`/doctor/visits/${visit.id}`}
                      className="font-medium hover:underline"
                    >
                      {patient.name}
                    </Link>
                    <p className="text-[12px] text-fg-muted">
                      {patient.patientId} · {ageFromDob(patient.dateOfBirth)}
                      {patient.gender}
                    </p>
                  </TableCell>
                  <TableCell className="text-fg-secondary">{visit.reason}</TableCell>
                  <TableCell className="font-mono text-[13px] text-fg-muted">
                    {visit.id.toUpperCase()}
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
