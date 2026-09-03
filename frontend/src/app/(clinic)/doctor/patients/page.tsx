"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Search, X } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { listDoctorVisits, type BackendVisitBoardItem } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { ageFromDob } from "@/lib/format";
import { useSession } from "@/lib/session";
import { doctorVisitBadge } from "@/lib/visit-status";

function formatSex(sex: string) {
  switch (sex) {
    case "female":
      return "Female";
    case "male":
      return "Male";
    case "intersex":
      return "Intersex";
    default:
      return "Unknown";
  }
}

export default function DoctorPatientsPage() {
  const { user } = useSession();
  const [visits, setVisits] = useState<BackendVisitBoardItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!user) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await listDoctorVisits({ doctorId: user.id, scope: "all" });
      setVisits(response.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your patient list could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    };
  }, [load]);

  const roster = useMemo(() => {
    const byPatient = new Map<string, BackendVisitBoardItem>();
    for (const visit of visits) {
      if (!byPatient.has(visit.patient_id)) {
        byPatient.set(visit.patient_id, visit);
      }
    }

    const value = search.trim().toLowerCase();
    let list = Array.from(byPatient.values());
    if (value) {
      list = list.filter((visit) =>
        [visit.patient_name, visit.medical_record_number, visit.visit_number, visit.reason]
          .some((field) => field.toLowerCase().includes(value)),
      );
    }
    return list;
  }, [visits, search]);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="My patients" description="All patients you have consulted or been assigned to, with their most recent visit." />
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="mb-3 h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My patients" description="All patients you have consulted or been assigned to, with their most recent visit." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search assigned patients by name or ID…"
            className="h-9 pr-8 pl-9 text-[13px]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] text-fg-muted">
            Active roster: <strong className="text-foreground">{roster.length}</strong> patients
          </span>
          <Button type="button" variant="outline" className="h-9 gap-2" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4" aria-hidden="true" />
            {error}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : null}

      {roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-fg-muted">
          {search
            ? "No patients match your search query."
            : "No patients are linked to you yet. Patients appear here after you consult them or are assigned as their doctor."}
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
              {roster.map((visit) => {
                const badge = doctorVisitBadge(visit.status);
                return (
                  <TableRow key={visit.id} className="h-12 hover:bg-surface-1/60">
                    <TableCell className="px-4 py-2.5 text-left">
                      <Link
                        href={`/doctor/visits/${visit.id}`}
                        className="block truncate text-[14px] font-medium text-foreground hover:underline"
                      >
                        {visit.patient_name}
                      </Link>
                      <p className="font-mono text-[11px] text-fg-muted">
                        {visit.medical_record_number} · {ageFromDob(visit.patient_date_of_birth)} yrs ·{" "}
                        {formatSex(visit.patient_sex)}
                      </p>
                    </TableCell>

                    <TableCell className="truncate px-4 py-2.5 text-left text-[13px] text-foreground">
                      {visit.reason}
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <Chip variant={badge.role}>{badge.label}</Chip>
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
