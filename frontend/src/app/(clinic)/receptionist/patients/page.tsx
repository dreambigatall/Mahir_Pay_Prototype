"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search, X } from "lucide-react";

import { EditPatientButton } from "@/components/clinic/edit-patient-dialog";
import { LiveRegisterPatientDialog } from "@/components/clinic/live-register-patient-dialog";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError } from "@/lib/api/client";
import { listPatients, type BackendPatient } from "@/lib/api/patients";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { ageFromDob } from "@/lib/format";

const PAGE_SIZE = 20;

export default function PatientsPage() {
  const [patients, setPatients] = useState<BackendPatient[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await listPatients({ search: query, limit: 100, signal });
      setPatients(response.items);
      setHasMore(Boolean(response.nextCursor));
      setPage(1);
    } catch (caught) {
      if (!signal?.aborted) setError(caught instanceof ApiError ? caught.message : "Patient records could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, refreshKey, query]);

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
  }, []);

  const totalPages = Math.max(1, Math.ceil(patients.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return patients.slice(start, start + PAGE_SIZE);
  }, [patients, currentPage]);
  const pageNumbers = useMemo(() => getPageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Patients directory" description="Registered patients. Open a record to update details or assign a doctor on the active visit." action={<LiveRegisterPatientDialog />} />
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone number, or patient ID" className="min-h-11 pr-9 pl-9" />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-accent hover:text-foreground"
            aria-label="Clear patient search"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <PatientTableSkeleton />
      ) : patients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-fg-muted">
          {query ? "No patients match this search." : "No patients are registered yet. Use “Register patient” to create the first record."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface-2">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Patient</TableHead>
                  <TableHead>Patient ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="w-[100px]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((patient) => (
                  <TableRow key={patient.id} className="hover:bg-surface-1/60">
                    <TableCell>
                      <p className="font-medium">{fullName(patient)}</p>
                      <p className="mt-0.5 text-xs capitalize text-fg-muted">
                        {ageFromDob(patient.date_of_birth)} yrs · {patient.sex}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-fg-secondary">{patient.medical_record_number}</TableCell>
                    <TableCell className="font-mono text-sm">{patient.phone || "—"}</TableCell>
                    <TableCell className="text-sm text-fg-secondary">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(patient.created_at))}
                    </TableCell>
                    <TableCell>
                      <EditPatientButton patient={patient} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-fg-muted">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, patients.length)} of {patients.length}
            </p>
            {totalPages > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={currentPage <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    />
                  </PaginationItem>
                  {pageNumbers.map((entry, index) =>
                    entry === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={entry}>
                        <PaginationLink
                          isActive={entry === currentPage}
                          onClick={() => setPage(entry)}
                        >
                          {entry}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        </>
      )}

      {hasMore ? (
        <p className="text-xs text-fg-muted">Showing the newest 100 records. Narrow the search to find older patients.</p>
      ) : null}
    </div>
  );
}

function getPageNumbers(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    pages.add(total - 3);
  }

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) result.push("ellipsis");
    result.push(page);
  }
  return result;
}

function PatientTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4" aria-label="Loading patient records">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

function fullName(patient: BackendPatient): string {
  return [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(" ");
}
