"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";

import { SendToDoctorButton } from "@/components/clinic/assign-visit-doctor-button";
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
import { listBillableVisits, listPaidInvoicesToday, type BackendInvoice, type BillableVisit } from "@/lib/api/billing";
import { listQueue, type BackendQueueEntry, type BackendVisit, type QueueStation, type VisitPriority } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const stations: Array<{ id: QueueStation; label: string; description: string }> = [
  { id: "triage", label: "Triage", description: "Initial assessment" },
  { id: "doctor", label: "Doctor", description: "Clinical consultation" },
  { id: "lab", label: "Laboratory", description: "Tests and diagnostics" },
  { id: "pharmacy", label: "Pharmacy", description: "Medicine dispensing" },
  { id: "billing", label: "Billing", description: "Invoice and payment" },
  { id: "procedure", label: "Procedure", description: "Treatment room" },
];

export function LiveQueueBoard() {
  const { user } = useSession();
  const [entries, setEntries] = useState<BackendQueueEntry[]>([]);
  const [paidToday, setPaidToday] = useState<BackendInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "waiting" | "inService" | "urgent">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const canSendToDoctor = user?.role === "receptionist" || user?.role === "admin";

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [queueResponses, billable, paid] = await Promise.all([
        Promise.all(stations.map(({ id }) => listQueue(id))),
        listBillableVisits(),
        listPaidInvoicesToday(),
      ]);
      const queueEntries = queueResponses.flatMap((response) => response.items);
      const billingVisitIds = new Set(
        queueEntries.filter((entry) => entry.station === "billing").map((entry) => entry.visit_id),
      );
      const billingFromWorklist = billable.items
        .filter((visit) => !billingVisitIds.has(visit.id))
        .map(billableVisitToQueueEntry);
      setEntries([...queueEntries, ...billingFromWorklist]);
      setPaidToday(paid.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The live queue could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh); };
  }, [load]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filterTab === "waiting") list = list.filter((entry) => entry.status === "waiting");
    else if (filterTab === "inService") list = list.filter((entry) => entry.status === "called" || entry.status === "in_service");
    else if (filterTab === "urgent") list = list.filter((entry) => entry.priority === "urgent" || entry.priority === "emergency");

    const value = query.trim().toLowerCase();
    if (!value) return list;
    return list.filter((entry) =>
      [entry.patient_name, entry.medical_record_number, entry.visit_number, entry.doctor_name ?? ""]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [entries, query, filterTab]);

  const stats = useMemo(() => ({
    total: entries.length,
    waiting: entries.filter((entry) => entry.status === "waiting").length,
    inService: entries.filter((entry) => entry.status === "called" || entry.status === "in_service").length,
    urgent: entries.filter((entry) => entry.priority === "urgent" || entry.priority === "emergency").length,
  }), [entries]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -340 : 340, behavior: "smooth" });
  };

  const paidTodayFiltered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return paidToday;
    return paidToday.filter((invoice) =>
      [invoice.patient_name, invoice.visit_number, invoice.invoice_number]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [paidToday, query]);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [filtered, paidTodayFiltered]);

  function handleSent() {
    void load(true);
  }

  if (loading) return <QueueSkeleton />;

  return (
    <section className="space-y-5" aria-label="Live clinic queue">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active queue" value={stats.total} detail="Across all stations" icon={Users} />
        <Metric label="Waiting" value={stats.waiting} detail="Not yet called" icon={Clock3} tone="warning" />
        <Metric label="In service" value={stats.inService} detail="Called or being served" icon={Activity} tone="success" />
        <Metric label="Urgent priority" value={stats.urgent} detail="Urgent and emergency" icon={ShieldAlert} tone="danger" />
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
                <span>All patients</span>
                <span className="ml-3 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">{stats.total}</span>
              </div>
            </SelectItem>
            <SelectItem value="waiting" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-3.5 text-warning-fill" />
                  <span>Waiting</span>
                </div>
                <span className="ml-3 rounded-full bg-warning-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-warning-text">{stats.waiting}</span>
              </div>
            </SelectItem>
            <SelectItem value="inService" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-3.5 text-success-fill" />
                  <span>In service</span>
                </div>
                <span className="ml-3 rounded-full bg-success-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-success-text">{stats.inService}</span>
              </div>
            </SelectItem>
            <SelectItem value="urgent" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-3.5 text-danger-fill" />
                  <span>Urgent priority</span>
                </div>
                <span className="ml-3 rounded-full bg-danger-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-danger-text">{stats.urgent}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, patient ID, or visit number" className="h-9 pl-8 pr-8 text-[13px]" />
            {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-foreground" aria-label="Clear queue search"><X className="size-3.5" /></button> : null}
          </div>
          <Button type="button" variant="outline" className="h-9 gap-2" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"><span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div> : null}

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
          className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {stations.map((station) => {
            const cards = filtered.filter((entry) => entry.station === station.id);
            return (
              <div key={station.id} className="w-[320px] shrink-0 rounded-2xl bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-start justify-between border-b border-border/50 pb-3.5">
                  <div>
                    <p className="font-heading text-xl font-bold tracking-tight text-foreground">{station.label}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{station.description}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground">{cards.length}</span>
                </div>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <p className="py-12 text-center text-[16px] text-fg-muted">No patients at this station</p>
                  ) : cards.map((entry) => (
                    <QueueCard
                      key={entry.id}
                      entry={entry}
                      canSendToDoctor={canSendToDoctor && entry.station === "triage"}
                      onSent={handleSent}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden="true" />

          <div className="w-[320px] shrink-0 rounded-2xl border border-success-fill/25 bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between border-b border-success-fill/20 pb-3.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-fill" aria-hidden="true" />
                <div>
                  <p className="font-heading text-xl font-bold tracking-tight text-foreground">Paid today</p>
                  <p className="mt-0.5 text-xs text-fg-muted">Completed billing — not a queue stage</p>
                </div>
              </div>
              <span className="rounded-full bg-success-fill/10 px-2.5 py-0.5 font-mono text-sm font-medium text-success-text">{paidTodayFiltered.length}</span>
            </div>
            <div className="space-y-3">
              {paidTodayFiltered.length === 0 ? (
                <p className="py-12 text-center text-[16px] text-fg-muted">No paid invoices today</p>
              ) : paidTodayFiltered.map((invoice) => (
                <PaidTodayCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          </div>
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
      <p className="text-xs text-fg-muted">After full payment or credit release, visits leave Billing. Unpaid balances stay on the outstanding list.</p>
    </section>
  );
}

function QueueCard({
  entry,
  canSendToDoctor,
  onSent,
}: {
  entry: BackendQueueEntry;
  canSendToDoctor: boolean;
  onSent: (visit: BackendVisit) => void;
}) {
  const status = entry.status === "in_service" ? "In service" : entry.status === "called" ? "Called" : "Waiting";
  const visitHref = entry.station === "doctor"
    ? `/doctor/visits/${entry.visit_id}`
    : entry.station === "billing"
      ? `/receptionist/billing/${entry.visit_id}`
      : `/receptionist/visits/${entry.visit_id}`;

  return (
    <article className={cn("rounded-xl border bg-surface-2 p-4 shadow-sm transition-shadow hover:shadow-md", entry.priority === "emergency" ? "border-danger-fill/60" : entry.priority === "urgent" ? "border-warning-fill/60" : "border-border/60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-bold text-foreground">{entry.patient_name}</h3>
          <p className="mt-1 font-mono text-xs text-fg-muted">{entry.medical_record_number}</p>
        </div>
        <PriorityBadge priority={entry.priority} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-[13px]">
        <div><p className="text-fg-muted">Visit</p><p className="mt-0.5 font-mono font-medium">{entry.visit_number}</p></div>
        <div><p className="text-fg-muted">Status</p><p className="mt-0.5 font-medium">{status}</p></div>
      </div>
      <p className="mt-2.5 text-[13px] text-fg-secondary">
        {entry.doctor_name ? <>Dr. {entry.doctor_name}</> : <span className="text-fg-muted">Doctor unassigned</span>}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[13px]">
          <span className={entry.wait_minutes > 20 ? "font-semibold text-danger-text" : "text-fg-secondary"}>Waiting {entry.wait_minutes} min</span>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link href={visitHref}>Open</Link>
          </Button>
        </div>
        {canSendToDoctor ? (
          <SendToDoctorButton
            visitId={entry.visit_id}
            doctorId={entry.doctor_id}
            doctorName={entry.doctor_name}
            patientName={entry.patient_name}
            size="sm"
            className="min-h-9 w-full gap-1.5"
            onSent={onSent}
          />
        ) : null}
      </div>
    </article>
  );
}

function PaidTodayCard({ invoice }: { invoice: BackendInvoice }) {
  return (
    <Link
      href={`/receptionist/billing/${invoice.visit_id}`}
      className="block rounded-xl border border-border/60 bg-surface-2 p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-bold text-foreground">{invoice.patient_name}</h3>
          <p className="mt-1 font-mono text-xs text-fg-muted">{invoice.visit_number}</p>
        </div>
        <span className="shrink-0 rounded-full bg-success-fill/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-success-text">Paid</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-[13px]">
        <div>
          <p className="text-fg-muted">Invoice</p>
          <p className="mt-0.5 font-mono font-medium">{invoice.invoice_number}</p>
        </div>
        <div>
          <p className="text-fg-muted">Total</p>
          <p className="mt-0.5 font-mono font-medium tabular-nums">{formatMoney(Number(invoice.total))}</p>
        </div>
      </div>
      <p className="mt-2.5 text-[13px] text-fg-secondary">
        {invoice.paid_at ? formatPaidAt(invoice.paid_at) : "Paid today"}
      </p>
    </Link>
  );
}

function formatPaidAt(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function PriorityBadge({ priority }: { priority: BackendQueueEntry["priority"] }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide", priority === "emergency" ? "bg-danger-fill/15 text-danger-text" : priority === "urgent" ? "bg-warning-fill/15 text-warning-text" : "bg-secondary text-secondary-foreground")}>{priority}</span>;
}

function Metric({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: number; detail: string; icon: typeof Users; tone?: "default" | "warning" | "success" | "danger" }) {
  const tones = { default: "text-clinical-fill", warning: "text-warning-fill", success: "text-success-fill", danger: "text-danger-fill" };
  return <div className="rounded-xl border border-border bg-surface-2 p-3.5"><div className="flex items-center justify-between text-xs font-medium text-fg-secondary"><span>{label}</span><Icon className={cn("size-4", tones[tone])} aria-hidden="true" /></div><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p><p className="mt-0.5 text-[11px] text-fg-muted">{detail}</p></div>;
}

function QueueSkeleton() {
  return <div className="space-y-5" aria-label="Loading live queue"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div><div className="flex gap-2 overflow-hidden">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-80 w-[320px] shrink-0 rounded-2xl" />)}</div></div>;
}

function billableVisitToQueueEntry(visit: BillableVisit): BackendQueueEntry {
  const checkedInAt = new Date(visit.checked_in_at);
  const waitMinutes = Number.isNaN(checkedInAt.getTime())
    ? 0
    : Math.max(0, Math.floor((Date.now() - checkedInAt.getTime()) / 60_000));

  return {
    id: `billing-worklist-${visit.id}`,
    visit_id: visit.id,
    visit_number: visit.visit_number,
    patient_id: visit.patient_id,
    medical_record_number: visit.medical_record_number,
    patient_name: visit.patient_name,
    doctor_id: null,
    doctor_name: visit.doctor_name,
    station: "billing",
    status: "waiting",
    priority: visit.priority as VisitPriority,
    assigned_user_id: null,
    queued_at: visit.checked_in_at,
    called_at: null,
    service_started_at: null,
    wait_minutes: waitMinutes,
  };
}
