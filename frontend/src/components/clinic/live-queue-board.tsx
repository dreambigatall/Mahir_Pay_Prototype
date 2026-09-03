"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertCircle, ArrowRight, Clock3, Loader2, RefreshCw, Search, ShieldAlert, Users, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listBillableVisits, type BillableVisit } from "@/lib/api/billing";
import { listQueue, sendVisitToDoctor, type BackendQueueEntry, type QueueStation, type VisitPriority } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT, announceCoreDataChanged } from "@/lib/core-events";
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sendingVisitId, setSendingVisitId] = useState<string | null>(null);

  const canSendToDoctor = user?.role === "receptionist" || user?.role === "admin";

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [queueResponses, billable] = await Promise.all([
        Promise.all(stations.map(({ id }) => listQueue(id))),
        listBillableVisits(),
      ]);
      const queueEntries = queueResponses.flatMap((response) => response.items);
      const billingVisitIds = new Set(
        queueEntries.filter((entry) => entry.station === "billing").map((entry) => entry.visit_id),
      );
      const billingFromWorklist = billable.items
        .filter((visit) => !billingVisitIds.has(visit.id))
        .map(billableVisitToQueueEntry);
      setEntries([...queueEntries, ...billingFromWorklist]);
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
    const value = query.trim().toLowerCase();
    if (!value) return entries;
    return entries.filter((entry) =>
      [entry.patient_name, entry.medical_record_number, entry.visit_number, entry.doctor_name ?? ""]
        .some((field) => field.toLowerCase().includes(value)),
    );
  }, [entries, query]);

  const stats = useMemo(() => ({
    total: entries.length,
    waiting: entries.filter((entry) => entry.status === "waiting").length,
    inService: entries.filter((entry) => entry.status === "called" || entry.status === "in_service").length,
    urgent: entries.filter((entry) => entry.priority === "urgent" || entry.priority === "emergency").length,
  }), [entries]);

  async function sendToDoctor(entry: BackendQueueEntry) {
    setSendingVisitId(entry.visit_id);
    try {
      await sendVisitToDoctor(entry.visit_id);
      announceCoreDataChanged();
      toast.success("Sent to doctor queue", {
        description: entry.doctor_name
          ? `${entry.patient_name} is waiting for ${entry.doctor_name}.`
          : `${entry.patient_name} is waiting for consultation.`,
      });
      await load(true);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not send the patient to the doctor.");
    } finally {
      setSendingVisitId(null);
    }
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
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, patient ID, or visit number" className="min-h-11 pl-9 pr-9" />
          {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-accent hover:text-foreground" aria-label="Clear queue search"><X className="size-4" /></button> : null}
        </div>
        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={refreshing} onClick={() => void load(true)}>
          {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          {refreshing ? "Refreshing…" : "Refresh queue"}
        </Button>
      </div>

      {error ? <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text"><span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div> : null}

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-max grid-cols-6 gap-3">
          {stations.map((station) => {
            const cards = filtered.filter((entry) => entry.station === station.id);
            return (
              <section key={station.id} className="w-[310px] rounded-2xl border border-border/70 bg-surface-1 p-4" aria-labelledby={`station-${station.id}`}>
                <header className="mb-4 flex items-start justify-between border-b border-border/60 pb-3">
                  <div><h2 id={`station-${station.id}`} className="font-heading text-base font-semibold">{station.label}</h2><p className="mt-0.5 text-xs text-fg-muted">{station.description}</p></div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs font-semibold">{cards.length}</span>
                </header>
                <div className="space-y-3">
                  {cards.length === 0 ? (
                    <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-xs text-fg-muted">No patients at this station</div>
                  ) : cards.map((entry) => (
                    <QueueCard
                      key={entry.id}
                      entry={entry}
                      canSendToDoctor={canSendToDoctor && entry.station === "triage"}
                      sending={sendingVisitId === entry.visit_id}
                      onSendToDoctor={() => void sendToDoctor(entry)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-fg-muted">Use “Send to doctor” on triage cards after registration. Assigned doctors then see those patients on their queue.</p>
    </section>
  );
}

function QueueCard({
  entry,
  canSendToDoctor,
  sending,
  onSendToDoctor,
}: {
  entry: BackendQueueEntry;
  canSendToDoctor: boolean;
  sending: boolean;
  onSendToDoctor: () => void;
}) {
  const status = entry.status === "in_service" ? "In service" : entry.status === "called" ? "Called" : "Waiting";
  const visitHref = entry.station === "doctor"
    ? `/doctor/visits/${entry.visit_id}`
    : entry.station === "billing"
      ? `/receptionist/billing/${entry.visit_id}`
      : `/receptionist/visits/${entry.visit_id}`;

  return (
    <article className={cn("rounded-xl border bg-background p-4 shadow-sm", entry.priority === "emergency" ? "border-danger-fill/60" : entry.priority === "urgent" ? "border-warning-fill/60" : "border-border/70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{entry.patient_name}</h3>
          <p className="mt-1 font-mono text-xs text-fg-muted">{entry.medical_record_number}</p>
        </div>
        <PriorityBadge priority={entry.priority} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-xs">
        <div><p className="text-fg-muted">Visit</p><p className="mt-0.5 font-mono font-medium">{entry.visit_number}</p></div>
        <div><p className="text-fg-muted">Status</p><p className="mt-0.5 font-medium">{status}</p></div>
      </div>
      <p className="mt-2 text-xs text-fg-secondary">
        {entry.doctor_name ? <>Dr. {entry.doctor_name}</> : <span className="text-fg-muted">Doctor unassigned</span>}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className={entry.wait_minutes > 20 ? "font-semibold text-danger-text" : "text-fg-secondary"}>Waiting {entry.wait_minutes} min</span>
          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
            <Link href={visitHref}>Open</Link>
          </Button>
        </div>
        {canSendToDoctor ? (
          <Button type="button" size="sm" className="min-h-9 w-full gap-1.5" disabled={sending} onClick={onSendToDoctor}>
            {sending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-3.5" aria-hidden="true" />}
            {sending ? "Sending…" : "Send to doctor"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function PriorityBadge({ priority }: { priority: BackendQueueEntry["priority"] }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide", priority === "emergency" ? "bg-danger-fill/15 text-danger-text" : priority === "urgent" ? "bg-warning-fill/15 text-warning-text" : "bg-secondary text-fg-secondary")}>{priority}</span>;
}

function Metric({ label, value, detail, icon: Icon, tone = "default" }: { label: string; value: number; detail: string; icon: typeof Users; tone?: "default" | "warning" | "success" | "danger" }) {
  const tones = { default: "text-clinical-fill", warning: "text-warning-fill", success: "text-success-fill", danger: "text-danger-fill" };
  return <div className="rounded-xl border border-border bg-surface-2 p-3.5"><div className="flex items-center justify-between text-xs font-medium text-fg-secondary"><span>{label}</span><Icon className={cn("size-4", tones[tone])} aria-hidden="true" /></div><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p><p className="mt-0.5 text-[11px] text-fg-muted">{detail}</p></div>;
}

function QueueSkeleton() {
  return <div className="space-y-5" aria-label="Loading live queue"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div><div className="flex gap-3 overflow-hidden">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-80 w-[310px] shrink-0 rounded-2xl" />)}</div></div>;
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
