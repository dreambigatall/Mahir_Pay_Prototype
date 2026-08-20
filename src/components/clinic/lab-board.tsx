"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FlaskConical,
  Kanban,
  Search,
  X,
} from "lucide-react";

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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { groupLabsByVisit } from "@/lib/lab-groups";
import { getPatient, getStaff } from "@/lib/mock-data";
import type { LabRequest } from "@/lib/types";
import { LAB_COLUMNS } from "@/lib/visit-status";

export function LabBoard({ requests }: { requests: LabRequest[] }) {
  const { patients, visits } = useClinic();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [filterTab, setFilterTab] = useState<"all" | "urgent" | "pending" | "ready">("all");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => groupLabsByVisit(requests), [requests]);

  const stats = useMemo(() => {
    const total = groups.length;
    const urgentCount = groups.filter((g) => g.urgent).length;
    const inProgressCount = groups.filter((g) => g.status === "in-progress").length;
    const readyCount = groups.filter((g) => g.status === "result-ready").length;
    const requestedCount = groups.filter((g) => g.status === "requested").length;

    return { total, urgentCount, inProgressCount, readyCount, requestedCount };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    let list = groups;

    if (filterTab === "urgent") {
      list = list.filter((g) => g.urgent);
    } else if (filterTab === "pending") {
      list = list.filter((g) => g.status !== "result-ready");
    } else if (filterTab === "ready") {
      list = list.filter((g) => g.status === "result-ready");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) => {
        const visit = visits.find((v) => v.id === g.visitId);
        const patient =
          patients.find((p) => p.id === visit?.patientId) ||
          (visit ? getPatient(visit.patientId) : undefined);
        const testNames = g.requests.map((r) => r.testName.toLowerCase()).join(" ");

        return (
          patient?.name.toLowerCase().includes(q) ||
          patient?.patientId.toLowerCase().includes(q) ||
          testNames.includes(q)
        );
      });
    }

    return list;
  }, [groups, filterTab, search, visits, patients]);

  return (
    <div className="space-y-5">
      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total requisitions</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {stats.total}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {requests.length} total test orders
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Urgent / STAT</span>
            <AlertCircle className="size-4 text-danger-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-danger-text">
            {stats.urgentCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Priority processing</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">In analysis</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">
            {stats.inProgressCount + stats.requestedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {stats.requestedCount} queued · {stats.inProgressCount} active
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Results verified</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-success-text">
            {stats.readyCount}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Sent to doctors</p>
        </div>
      </div>

      {/* Control Bar: Filter Tabs, Search, and View Mode Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filterTab}
          onValueChange={(val) =>
            setFilterTab(val as "all" | "urgent" | "pending" | "ready")
          }
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 bg-surface-1 p-1">
            <TabsTrigger value="all" className="text-[13px]">
              All ({groups.length})
            </TabsTrigger>
            <TabsTrigger value="urgent" className="text-[13px]">
              Urgent ({stats.urgentCount})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-[13px]">
              Pending ({stats.inProgressCount + stats.requestedCount})
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-[13px]">
              Completed ({stats.readyCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or test…"
              className="h-9 pl-8 pr-8 text-[13px]"
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

          <div className="flex items-center rounded-lg border border-border bg-surface-1 p-0.5">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-8 px-2.5 text-[12px] gap-1.5"
            >
              <Kanban className="size-3.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 px-2.5 text-[12px] gap-1.5"
            >
              <FileSpreadsheet className="size-3.5" />
              List
            </Button>
          </div>
        </div>
      </div>

      {/* Main View: Kanban vs Table */}
      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {LAB_COLUMNS.map((column) => {
            const columnCards = filteredGroups.filter(
              (group) => group.status === column.id,
            );
            return (
              <div
                key={column.id}
                className="w-[300px] shrink-0 rounded-xl bg-surface-1 p-3"
              >
                <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                  <p className="text-[13px] font-medium text-foreground">{column.title}</p>
                  <span className="font-mono text-[12px] text-fg-muted">
                    {columnCards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnCards.length === 0 ? (
                    <p className="py-8 text-center text-[12px] text-fg-muted">
                      No requisitions in this stage
                    </p>
                  ) : (
                    columnCards.map((group) => (
                      <LabPatientCard key={group.visitId} group={group} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabular List View */
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[32%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patient & requisition
                </TableHead>
                <TableHead className="h-11 w-[32%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Ordered tests
                </TableHead>
                <TableHead className="h-11 w-[16%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Status & priority
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => {
                const { visit, patient, doctor } = useGroupInfo(group);
                if (!patient) return null;

                return (
                  <TableRow key={group.visitId} className="h-12 hover:bg-surface-1/60">
                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="text-[14px] font-medium text-foreground truncate">
                        {patient.name}
                      </p>
                      <p className="font-mono text-[11px] text-fg-muted">
                        {patient.patientId} · {doctor?.name}
                      </p>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <p className="text-[13px] text-foreground font-medium truncate">
                        {group.requests.map((r) => r.testName).join(", ")}
                      </p>
                      <span className="text-[11px] text-fg-muted font-mono">
                        {group.testCount} {group.testCount === 1 ? "test" : "tests"}
                      </span>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-left">
                      <div className="flex items-center gap-1.5">
                        {group.urgent && (
                          <StatusBadge role="danger">Urgent</StatusBadge>
                        )}
                        {group.status === "result-ready" ? (
                          <StatusBadge role="success">Ready</StatusBadge>
                        ) : (
                          <StatusBadge role="warning">In progress</StatusBadge>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" asChild className="h-8 text-[12px]">
                        <Link href={`/lab/visits/${group.visitId}`}>
                          {group.status === "result-ready" ? "View report" : "Enter results"}
                        </Link>
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

function useGroupInfo(group: ReturnType<typeof groupLabsByVisit>[number]) {
  const { visits, patients } = useClinic();
  const visit = visits.find((v) => v.id === group.visitId);
  const patient =
    patients.find((p) => p.id === visit?.patientId) ||
    (visit ? getPatient(visit.patientId) : undefined);
  const doctor = getStaff(group.doctorId);

  return { visit, patient, doctor };
}

function LabPatientCard({
  group,
}: {
  group: ReturnType<typeof groupLabsByVisit>[number];
}) {
  const { visit, patient, doctor } = useGroupInfo(group);
  if (!patient) return null;

  const countLabel = group.testCount === 1 ? "1 test" : `${group.testCount} tests`;
  const isCompleted = group.status === "result-ready";

  return (
    <Link
      href={`/lab/visits/${group.visitId}`}
      className="block rounded-xl border border-border bg-surface-2 p-3.5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FlaskConical className="size-3.5 text-clinical-fill shrink-0" />
          <p className="text-[14px] font-medium text-foreground truncate">{patient.name}</p>
        </div>
        {group.urgent ? (
          <StatusBadge role="danger">Urgent</StatusBadge>
        ) : (
          <StatusBadge role="neutral">Routine</StatusBadge>
        )}
      </div>

      <p className="mt-1 font-mono text-[11px] text-fg-muted">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}{patient.gender}
      </p>

      <div className="mt-2.5 rounded-md bg-surface-1 p-2 border border-border/60">
        <p className="text-[12px] font-medium text-foreground tabular-nums">
          {countLabel}
        </p>
        <p className="text-[11px] text-fg-secondary truncate mt-0.5">
          {group.requests.map((request) => request.testName).join(", ")}
        </p>
      </div>

      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-fg-muted">
        <span className="truncate">{doctor?.name}</span>
        {isCompleted ? (
          <span className="text-success-text font-medium flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Ready
          </span>
        ) : (
          <span className="text-warning-text font-medium">Pending results</span>
        )}
      </div>
    </Link>
  );
}
