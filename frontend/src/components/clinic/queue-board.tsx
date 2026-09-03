"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Users,
  Clock,
  CreditCard,
  CheckCircle2,
  Search,
  X,
  Filter,
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
import { getPatient, getStaff } from "@/lib/mock-data";
import type { Visit } from "@/lib/types";
import { QUEUE_COLUMNS, visitDot } from "@/lib/visit-status";

export function QueueBoard({
  visits,
  hrefFor,
}: {
  visits: Visit[];
  hrefFor: (visit: Visit) => string;
}) {
  const { patients } = useClinic();
  const [filterTab, setFilterTab] = useState<"all" | "waiting" | "ready" | "closed">("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  // Stats calculation
  const stats = useMemo(() => {
    const total = visits.length;
    const waiting = visits.filter(v => v.status === "registered").length;
    const readyForBilling = visits.filter(v => v.status === "ready-for-billing").length;
    const closed = visits.filter(v => v.status === "billed").length;
    return { total, waiting, readyForBilling, closed };
  }, [visits]);

  // Filtering logic
  const filteredVisits = useMemo(() => {
    let list = visits;

    if (filterTab === "waiting") {
      list = list.filter(v => v.status === "registered");
    } else if (filterTab === "ready") {
      list = list.filter(v => v.status === "ready-for-billing");
    } else if (filterTab === "closed") {
      list = list.filter(v => v.status === "billed");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(v => {
        const patient = patients.find(p => p.id === v.patientId) || getPatient(v.patientId);
        const doctor = getStaff(v.doctorId);
        return (
          patient?.name.toLowerCase().includes(q) ||
          patient?.patientId.toLowerCase().includes(q) ||
          doctor?.name.toLowerCase().includes(q) ||
          v.reason.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [visits, filterTab, search, patients]);

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
            <span className="text-[12px] font-medium">Total visits</span>
            <Users className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {stats.total}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Today's schedule</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Waiting</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">
            {stats.waiting}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Triage & Doctor queue</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Ready for billing</span>
            <CreditCard className="size-4 text-danger-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-danger-text">
            {stats.readyForBilling}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Pending payment</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Closed</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-success-text">
            {stats.closed}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">Visits completed</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select
          value={filterTab}
          onValueChange={(val) => setFilterTab(val as any)}
        >
          <SelectTrigger className="h-9 px-4 bg-background font-medium text-[13px] border-border/60 hover:bg-surface-2 transition-colors focus:ring-1 focus:ring-ring/50 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-primary" />
              <SelectValue placeholder="Filter..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <span>All visits</span>
                <span className="ml-3 text-[12px] font-mono text-fg-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
                  {stats.total}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="waiting" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Waiting</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-warning-text bg-warning-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.waiting}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="ready" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-3.5 text-danger-fill" />
                  <span>Ready to Bill</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-danger-text bg-danger-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.readyForBilling}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="closed" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>Closed</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-success-text bg-success-fill/10 px-1.5 py-0.5 rounded-full">
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient or doctor…"
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
          {QUEUE_COLUMNS.map((column) => {
            const cards = filteredVisits.filter((visit) =>
              column.statuses.includes(visit.status),
            );
            return (
              <div
                key={column.id}
                className="w-[400px] shrink-0 rounded-2xl bg-card p-5 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3.5">
                  <p className="text-xl font-bold font-heading text-foreground tracking-tight">{column.title}</p>
                  <span className="font-mono text-sm font-medium text-secondary-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {cards.length === 0 ? (
                    <p className="py-12 text-center text-[16px] text-fg-muted">
                      No patients in this stage
                    </p>
                  ) : (
                    cards.map((visit) => (
                      <QueueCard
                        key={visit.id}
                        visit={visit}
                        href={hrefFor(visit)}
                      />
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

function QueueCard({ visit, href }: { visit: Visit; href: string }) {
  const { patients } = useClinic();
  const patient =
    patients.find((p) => p.id === visit.patientId) || getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) return null;

  const overSla = visit.waitMinutes > 20;

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 mb-3"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <GripVertical className="size-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
          <p className="text-lg font-bold font-heading text-foreground group-hover:text-primary transition-colors truncate">{patient.name}</p>
        </div>
        <span className={`mt-2 size-3 shrink-0 rounded-full ${visitDot(visit.status)}`} />
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {patient.patientId} · {ageFromDob(patient.dateOfBirth)}{patient.gender}
      </p>
      <p className="mt-2.5 text-[15px] text-fg-secondary truncate">
        {doctor?.name} {doctor?.room ? `· ${doctor.room}` : ""}
      </p>
      <p className="text-[15px] text-fg-muted truncate">{visit.reason}</p>
      {visit.kind === "procedure" ? (
        <p className="mt-2 text-[13px] font-semibold uppercase tracking-wide text-clinical-text">
          Injection / vaccine
        </p>
      ) : null}

      <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-[14px]">
        {visit.status !== "billed" ? (
          <span className={overSla ? "font-semibold text-danger-text" : "text-fg-muted font-mono"}>
            Waiting {visit.waitMinutes}m
          </span>
        ) : (
          <span className="text-success-text font-medium">Visit closed</span>
        )}

        <span className="font-mono text-fg-muted text-[13px] uppercase">
          {visit.id.slice(-6)}
        </span>
      </div>
    </Link>
  );
}
