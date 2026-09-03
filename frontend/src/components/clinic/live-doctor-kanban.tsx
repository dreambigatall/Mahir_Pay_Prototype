"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  GripVertical,
  Loader2,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listDoctorVisits, type BackendVisitBoardItem } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { ageFromDob } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { VisitStatus } from "@/lib/types";
import { DOCTOR_QUEUE_COLUMNS, mapDoctorVisitStatus, visitDot } from "@/lib/visit-status";

type BoardVisit = BackendVisitBoardItem & { boardStatus: VisitStatus };

export function LiveDoctorKanban() {
  const { user } = useSession();
  const [visits, setVisits] = useState<BoardVisit[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "waiting" | "active" | "closed">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!user) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await listDoctorVisits({ doctorId: user.id, scope: "today" });
      setVisits(response.items.map((visit) => ({ ...visit, boardStatus: mapDoctorVisitStatus(visit.status) })));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Your queue could not be loaded.");
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

  const stats = useMemo(() => {
    const total = visits.length;
    const waiting = visits.filter((visit) => visit.boardStatus === "registered").length;
    const active = visits.filter((visit) =>
      visit.boardStatus === "in-consultation" || visit.boardStatus === "awaiting-lab" || visit.boardStatus === "lab-complete",
    ).length;
    const closed = visits.filter((visit) => visit.boardStatus === "billed").length;
    return { total, waiting, active, closed };
  }, [visits]);

  const filteredVisits = useMemo(() => {
    let list = visits;

    if (filterTab === "waiting") {
      list = list.filter((visit) => visit.boardStatus === "registered");
    } else if (filterTab === "active") {
      list = list.filter((visit) =>
        visit.boardStatus === "in-consultation" || visit.boardStatus === "awaiting-lab" || visit.boardStatus === "lab-complete",
      );
    } else if (filterTab === "closed") {
      list = list.filter((visit) => visit.boardStatus === "billed");
    }

    const value = search.trim().toLowerCase();
    if (value) {
      list = list.filter((visit) =>
        [visit.patient_name, visit.medical_record_number, visit.visit_number, visit.doctor_name ?? "", visit.reason]
          .some((field) => field.toLowerCase().includes(value)),
      );
    }

    return list;
  }, [visits, filterTab, search]);

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
  }, [filteredVisits]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 402;
    scrollRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading doctor queue">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-96 w-[400px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total visits</span>
            <Users className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">{stats.total}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Today&apos;s schedule</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Waiting</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">{stats.waiting}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Triage &amp; Doctor queue</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">In progress</span>
            <Stethoscope className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-clinical-text">{stats.active}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Consultation &amp; lab</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Completed</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-success-text">{stats.closed}</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Your work finished</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filterTab} onValueChange={(value) => setFilterTab(value as typeof filterTab)}>
          <SelectTrigger className="h-9 w-full border-border/60 bg-background px-4 text-[13px] font-medium transition-colors hover:bg-surface-2 focus:ring-1 focus:ring-ring/50 sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-primary" />
              <SelectValue placeholder="Filter..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <span>All visits</span>
                <span className="ml-3 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">
                  {stats.total}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="waiting" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Waiting</span>
                </div>
                <span className="ml-3 rounded-full bg-warning-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-warning-text">
                  {stats.waiting}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="active" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-3.5 text-clinical-fill" />
                  <span>In progress</span>
                </div>
                <span className="ml-3 rounded-full bg-clinical-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-clinical-text">
                  {stats.active}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="closed" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>Completed</span>
                </div>
                <span className="ml-3 rounded-full bg-success-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-success-text">
                  {stats.closed}
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient or doctor…"
              className="h-9 pr-8 pl-8 text-[13px]"
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
          <Button type="button" variant="outline" className="h-9 gap-2" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            {refreshing ? "Refreshing…" : "Refresh"}
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

      <div className="group relative mt-2">
        {showLeft ? (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-lg backdrop-blur-sm transition-all hover:bg-surface-2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-6 text-primary" />
          </button>
        ) : null}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-0.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {DOCTOR_QUEUE_COLUMNS.map((column) => {
            const cards = filteredVisits.filter((visit) => column.statuses.includes(visit.boardStatus));
            return (
              <div key={column.id} className="w-[400px] shrink-0 rounded-2xl bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3.5">
                  <p className="font-heading text-xl font-bold tracking-tight text-foreground">{column.title}</p>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {cards.length === 0 ? (
                    <p className="py-12 text-center text-[16px] text-fg-muted">No patients in this stage</p>
                  ) : (
                    cards.map((visit) => <DoctorKanbanCard key={visit.id} visit={visit} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {showRight ? (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full border border-border bg-background/90 p-3 shadow-lg backdrop-blur-sm transition-all hover:bg-surface-2"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-6 text-primary" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DoctorKanbanCard({ visit }: { visit: BoardVisit }) {
  const gender = visit.patient_sex === "female" ? "F" : visit.patient_sex === "male" ? "M" : "";
  const overSla = visit.wait_minutes > 20;

  return (
    <Link
      href={`/doctor/visits/${visit.id}`}
      className="group mb-3 block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <GripVertical className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          <p className="truncate font-heading text-lg font-bold text-foreground transition-colors group-hover:text-primary">
            {visit.patient_name}
          </p>
        </div>
        <span className={`mt-2 size-3 shrink-0 rounded-full ${visitDot(visit.boardStatus)}`} />
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {visit.medical_record_number} · {ageFromDob(visit.patient_date_of_birth)}
        {gender}
      </p>
      <p className="mt-2.5 truncate text-[15px] text-fg-secondary">{visit.doctor_name ?? "Unassigned"}</p>
      <p className="truncate text-[15px] text-fg-muted">{visit.reason}</p>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4 text-[14px]">
        {visit.boardStatus === "billed" ? (
          <span className="font-medium text-success-text">Clinical work complete</span>
        ) : (
          <span className={overSla ? "font-semibold text-danger-text" : "font-mono text-fg-muted"}>
            Waiting {visit.wait_minutes}m
          </span>
        )}
        <span className="font-mono text-[13px] text-fg-muted uppercase">{visit.visit_number.slice(-6)}</span>
      </div>
    </Link>
  );
}
