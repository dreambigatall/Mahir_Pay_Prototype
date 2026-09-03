"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FlaskConical,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  GripVertical
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { groupLabsByVisit } from "@/lib/lab-groups";
import { getPatient, getStaff } from "@/lib/mock-data";
import type { LabRequest } from "@/lib/types";
import { LAB_COLUMNS } from "@/lib/visit-status";

export function LabBoard({ requests }: { requests: LabRequest[] }) {
  const { patients, visits } = useClinic();
  const [filterTab, setFilterTab] = useState<"all" | "urgent" | "pending" | "ready">("all");
  const [search, setSearch] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

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

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [filteredGroups]);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 402; // width (400) + gap (2)
      scrollRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

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
        <Select
          value={filterTab}
          onValueChange={(val) => setFilterTab(val as "all" | "urgent" | "pending" | "ready")}
        >
          <SelectTrigger className="h-9 px-4 bg-background font-medium text-[13px] border-border/60 hover:bg-surface-2 transition-colors focus:ring-1 focus:ring-ring/50 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <SelectValue placeholder="Filter views..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <span>All requisitions</span>
                <span className="ml-3 text-[12px] font-mono text-fg-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
                  {groups.length}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="urgent" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3.5 text-danger-fill" />
                  <span>Urgent</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-danger-text bg-danger-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.urgentCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="pending" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Pending</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-warning-text bg-warning-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.inProgressCount + stats.requestedCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="ready" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>Completed</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-success-text bg-success-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.readyCount}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

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

        </div>
      </div>

      {/* Main View: Kanban */}
      <div className="relative group mt-2">
          {showLeft && (
            <button
              onClick={() => scroll("left")}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-lg border border-border p-3 hover:bg-surface-2 transition-all backdrop-blur-sm"
              aria-label="Scroll left"
            >
              <ChevronLeft className="size-6 text-primary" />
            </button>
          )}

          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-0.5 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {LAB_COLUMNS.map((column) => {
              const columnCards = filteredGroups.filter(
                (group) => group.status === column.id,
              );
              return (
                <div
                  key={column.id}
                  className="w-[400px] shrink-0 rounded-2xl bg-card p-5 shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3.5">
                    <p className="text-xl font-bold font-heading text-foreground tracking-tight">{column.title}</p>
                    <span className="font-mono text-sm font-medium text-secondary-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                      {columnCards.length}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {columnCards.length === 0 ? (
                      <p className="py-12 text-center text-[16px] text-fg-muted">
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

          {showRight && (
            <button
              onClick={() => scroll("right")}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 shadow-lg border border-border p-3 hover:bg-surface-2 transition-all backdrop-blur-sm"
              aria-label="Scroll right"
            >
              <ChevronRight className="size-6 text-primary" />
            </button>
          )}
        </div>
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
      className="group block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 mb-3"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <GripVertical className="size-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          <p className="text-lg font-bold font-heading text-foreground group-hover:text-primary transition-colors truncate">
            {patient.name}
          </p>
        </div>
        {group.urgent ? (
          <Chip variant="warning">Urgent</Chip>
        ) : (
          <Chip variant="neutral">Routine</Chip>
        )}
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}{patient.gender}
      </p>

      <div className="mt-3 rounded-md bg-surface-1 p-2 border border-border/60">
        <p className="text-[13px] font-medium text-foreground tabular-nums">
          {countLabel}
        </p>
        <p className="text-[12px] text-fg-secondary truncate mt-0.5">
          {group.requests.map((request) => request.testName).join(", ")}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-[14px] text-fg-muted">
        <span className="truncate">{doctor?.name}</span>
        {isCompleted ? (
          <span className="text-success-text font-medium flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            Ready
          </span>
        ) : (
          <span className="text-warning-text font-medium">Pending results</span>
        )}
      </div>
    </Link>
  );
}
