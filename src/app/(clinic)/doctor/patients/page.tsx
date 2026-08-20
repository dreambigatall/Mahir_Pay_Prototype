"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserCheck, Users, X } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
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
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPatient, visitsForDoctor } from "@/lib/mock-data";
import { useSession } from "@/lib/session";
import { visitBadge } from "@/lib/visit-status";

export default function DoctorPatientsPage() {
  const { user } = useSession();
  const { visits, patients, ready } = useClinic();
  const [search, setSearch] = useState("");

  const mine = useMemo(() => {
    return user ? visitsForDoctor(user.id, visits) : [];
  }, [user, visits]);

  const unique = useMemo(() => {
    const map = new Map<string, typeof mine[0]>();
    for (const visit of mine) {
      if (!map.has(visit.patientId)) {
        map.set(visit.patientId, visit);
      }
    }
    let list = Array.from(map.values());

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((visit) => {
        const patient =
          patients.find((p) => p.id === visit.patientId) ||
          getPatient(visit.patientId);
        return (
          patient?.name.toLowerCase().includes(q) ||
          patient?.patientId.toLowerCase().includes(q) ||
          visit.reason.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [mine, patients, search]);

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My patients"
        description="Patients assigned to your consultation list today."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search assigned patients by name or ID…"
            className="h-9 pl-9 pr-8 text-[13px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <span className="text-[13px] text-fg-muted">
          Active roster: <strong className="text-foreground">{unique.length}</strong> patients
        </span>
      </div>

      {unique.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-fg-muted">
          No patients match your search query.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[35%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patient & demographics
                </TableHead>
                <TableHead className="h-11 w-[30%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Chief complaint
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Status
                </TableHead>
                <TableHead className="h-11 w-[15%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Consultation
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unique.map((visit) => {
                const patient =
                  patients.find((p) => p.id === visit.patientId) ||
                  getPatient(visit.patientId);
                if (!patient) return null;
                const badge = visitBadge(visit.status);

                return (
                  <TableRow key={visit.id} className="h-12 hover:bg-surface-1/60">
                    <TableCell className="px-4 py-2.5 text-left">
                      <Link
                        href={`/doctor/visits/${visit.id}`}
                        className="font-medium text-[14px] text-foreground hover:underline truncate block"
                      >
                        {patient.name}
                      </Link>
                      <p className="font-mono text-[11px] text-fg-muted">
                        {patient.patientId} · {ageFromDob(patient.dateOfBirth)} yrs ·{" "}
                        {patient.gender === "F" ? "Female" : "Male"}
                      </p>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left text-[13px] text-foreground truncate">
                      {visit.reason}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <StatusBadge role={badge.role}>{badge.label}</StatusBadge>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 text-[12px]">
                        <Link href={`/doctor/visits/${visit.id}`}>Open</Link>
                      </Button>
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
