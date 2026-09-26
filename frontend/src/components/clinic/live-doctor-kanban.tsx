"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FlaskConical,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";

import { LastUpdated } from "@/components/clinic/last-updated";
import { byPriorityThenWait, PriorityBadge, priorityBorder } from "@/components/clinic/priority-badge";
import { StatFilter } from "@/components/clinic/stat-filter";
import { WaitBadge } from "@/components/clinic/wait-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listDoctorVisits, type BackendVisitBoardItem } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { ageFromDob } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { VisitStatus } from "@/lib/types";
import { DOCTOR_QUEUE_COLUMNS, mapDoctorVisitStatus } from "@/lib/visit-status";

type BoardVisit = BackendVisitBoardItem & { boardStatus: VisitStatus };

export function LiveDoctorKanban() {
  const { user } = useSession();
  const [visits, setVisits] = useState<BoardVisit[]>([]);
  const [filterTab, setFilterTab] = useState<"all" | "waiting" | "active" | "closed">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
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
      setUpdatedAt(new Date());
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

    return [...list].sort(byPriorityThenWait);
  }, [visits, filterTab, search]);

  const toggleFilter = (tab: typeof filterTab) => setFilterTab((current) => (current === tab ? "all" : tab));

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
        <StatFilter label="My patients today" value={stats.total} hint="Show everyone" icon={Users} tone="clinical" active={filterTab === "all"} onClick={() => setFilterTab("all")} />
        <StatFilter label="Waiting for me" value={stats.waiting} hint="Not seen yet" icon={Clock} tone="warning" active={filterTab === "waiting"} onClick={() => toggleFilter("waiting")} />
        <StatFilter label="In progress" value={stats.active} hint="In consultation or lab" icon={Stethoscope} tone="clinical" active={filterTab === "active"} onClick={() => toggleFilter("active")} />
        <StatFilter label="Completed" value={stats.closed} hint="My part is finished" icon={CheckCircle2} tone="success" active={filterTab === "closed"} onClick={() => toggleFilter("closed")} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find patient by name, ID, or reason"
            aria-label="Search my queue"
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
        <LastUpdated at={updatedAt} refreshing={refreshing} onRefresh={() => void load(true)} />
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
                <div className="mb-5 flex items-start justify-between border-b border-border/50 pb-3.5">
                  <div>
                    <p className="font-heading text-xl font-bold tracking-tight text-foreground">{column.title}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{column.description}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <p className="py-12 text-center text-sm text-fg-muted">{search || filterTab !== "all" ? "No matching patients" : "No one here right now"}</p>
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

function nextStep(visit: BoardVisit): { label: string; tone: "action" | "info" | "done" } {
  switch (visit.boardStatus) {
    case "registered":
      return { label: "Start consultation", tone: "action" };
    case "in-consultation":
      return { label: "Continue consultation", tone: "action" };
    case "lab-complete":
      return { label: "Review lab results", tone: "action" };
    case "awaiting-lab":
      return { label: "Waiting for lab results", tone: "info" };
    default:
      return { label: "My part is finished", tone: "done" };
  }
}

function DoctorKanbanCard({ visit }: { visit: BoardVisit }) {
  const gender = visit.patient_sex === "female" ? "F" : visit.patient_sex === "male" ? "M" : "";
  const step = nextStep(visit);
  const resultsBack = visit.boardStatus === "lab-complete";

  return (
    <Link
      href={`/doctor/visits/${visit.id}`}
      className={cn(
        "group block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        priorityBorder(visit.priority),
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <p className="min-w-0 truncate font-heading text-lg font-bold text-foreground transition-colors group-hover:text-primary">
          {visit.patient_name}
        </p>
        <PriorityBadge priority={visit.priority} className="mt-1" />
      </div>

      <p className="mt-1.5 font-mono text-sm text-muted-foreground">
        {visit.medical_record_number} · {ageFromDob(visit.patient_date_of_birth)}
        {gender}
      </p>
      <p className="mt-2 line-clamp-2 text-[15px] text-fg-secondary">{visit.reason}</p>

      {resultsBack ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-clinical-fill/15 px-2.5 py-1 text-xs font-semibold text-clinical-text">
          <FlaskConical className="size-3.5" aria-hidden="true" />
          Lab results are back
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-4 text-[14px]">
        {step.tone === "done" ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-success-text">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {step.label}
          </span>
        ) : (
          <>
            <WaitBadge minutes={visit.wait_minutes} />
            <span className={cn("inline-flex items-center gap-1 text-[13px] font-semibold", step.tone === "action" ? "text-primary" : "text-fg-muted")}>
              {step.label}
              {step.tone === "action" ? <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
            </span>
          </>
        )}
      </div>
    </Link>
  );
}
