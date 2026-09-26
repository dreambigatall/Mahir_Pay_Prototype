"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock,
  FlaskConical,
  Receipt,
  Stethoscope,
  Syringe,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { LastUpdated } from "@/components/clinic/last-updated";
import { PageHeader } from "@/components/clinic/page-header";
import { byPriorityThenWait, PriorityBadge } from "@/components/clinic/priority-badge";
import { WAIT_WARN_MINUTES, WaitBadge } from "@/components/clinic/wait-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getDashboardReport } from "@/lib/api/reports";
import { listQueue, type BackendQueueEntry, type QueueStation } from "@/lib/api/workflow";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

const STATIONS: Array<{ id: QueueStation; label: string }> = [
  { id: "triage", label: "Triage" },
  { id: "doctor", label: "Doctor" },
  { id: "lab", label: "Laboratory" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "billing", label: "Billing" },
  { id: "procedure", label: "Procedure" },
];

type Dashboard = {
  active_visits: number;
  waiting_queue: number;
  pending_diagnostics: number;
  due_course_doses: number;
  revenue_today: number;
  outstanding_balance: number;
};

export default function AdminDashboardPage() {
  const [report, setReport] = useState<Dashboard | null>(null);
  const [queue, setQueue] = useState<BackendQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    setError("");
    try {
      const [dashboard, queues] = await Promise.all([
        getDashboardReport(),
        Promise.all(STATIONS.map(({ id }) => listQueue(id))),
      ]);
      setReport(dashboard.item as Dashboard);
      setQueue(queues.flatMap((response) => response.items));
      setUpdatedAt(new Date());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const overTarget = useMemo(
    () => queue.filter((entry) => entry.status === "waiting" && entry.wait_minutes >= WAIT_WARN_MINUTES).length,
    [queue],
  );
  const longestWaiting = useMemo(
    () => queue.filter((entry) => entry.status === "waiting").sort(byPriorityThenWait).slice(0, 6),
    [queue],
  );
  const stations = useMemo(() => STATIONS.map((station) => {
    const here = queue.filter((entry) => entry.station === station.id);
    return {
      ...station,
      total: here.length,
      waiting: here.filter((entry) => entry.status === "waiting").length,
      longest: here.reduce((max, entry) => Math.max(max, entry.wait_minutes), 0),
    };
  }), [queue]);
  const doctors = useMemo(() => doctorLoad(queue), [queue]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clinic today"
        description="What is happening right now, and where patients are waiting."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <LastUpdated at={updatedAt} refreshing={refreshing} onRefresh={() => void load(true)} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/reports"><BarChart3 className="mr-1.5 size-3.5" />Reports</Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" aria-hidden="true" />{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load(true)}>Retry</Button>
        </div>
      ) : null}

      {report ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="In clinic now" value={String(report.active_visits)} hint="Open visits" icon={Activity} tone="clinical" />
          <Kpi
            label="Waiting in queue"
            value={String(report.waiting_queue)}
            hint={overTarget ? `${overTarget} over ${WAIT_WARN_MINUTES} min` : "All within target"}
            hintTone={overTarget ? "danger" : "muted"}
            icon={Clock}
            tone="warning"
          />
          <Kpi label="Lab tests pending" value={String(report.pending_diagnostics)} hint="Not yet verified" icon={FlaskConical} tone="clinical" />
          <Kpi label="Doses due" value={String(report.due_course_doses)} hint="Injection courses" icon={Syringe} tone="clinical" />
          <Kpi label="Collected today" value={formatMoney(report.revenue_today)} hint="Completed payments" icon={CheckCircle2} tone="success" />
          <Kpi
            label="Outstanding"
            value={formatMoney(report.outstanding_balance)}
            hint="Unpaid invoice balance"
            hintTone={report.outstanding_balance > 0 ? "warning" : "muted"}
            icon={Wallet}
            tone="warning"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <h2 className="text-sm font-semibold">Where patients are now</h2>
            <p className="text-xs text-fg-muted">Patients at each station. The busiest stations are your bottlenecks.</p>
            <ul className="mt-4 space-y-2.5">
              {stations.map((station) => {
                const max = Math.max(1, ...stations.map((item) => item.total));
                return (
                  <li key={station.id} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="font-medium">{station.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-1">
                      <span
                        className={cn("block h-full rounded-full", station.longest >= WAIT_WARN_MINUTES ? "bg-warning-fill" : "bg-clinical-fill")}
                        style={{ width: `${(station.total / max) * 100}%` }}
                      />
                    </span>
                    <span className="text-right text-xs text-fg-secondary tabular-nums">
                      <span className="font-mono text-sm font-semibold text-foreground">{station.total}</span>
                      {station.waiting ? <> · {station.waiting} waiting</> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <h2 className="text-sm font-semibold">Waiting longest</h2>
            <p className="text-xs text-fg-muted">Urgent patients first, then by wait time.</p>
            {longestWaiting.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">No one is waiting right now.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60">
                {longestWaiting.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {entry.patient_name}
                        <PriorityBadge priority={entry.priority} />
                      </p>
                      <p className="text-xs text-fg-muted">
                        {STATIONS.find((station) => station.id === entry.station)?.label ?? entry.station}
                        {entry.doctor_name ? <> · Dr. {entry.doctor_name}</> : null}
                      </p>
                    </div>
                    <WaitBadge minutes={entry.wait_minutes} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Stethoscope className="size-4 text-clinical-fill" aria-hidden="true" />Doctors today</h2>
            {doctors.length === 0 ? (
              <p className="py-8 text-center text-sm text-fg-muted">No patients with doctors right now.</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-fg-muted">
                    <th className="pb-2 font-medium">Doctor</th>
                    <th className="pb-2 text-right font-medium">Waiting</th>
                    <th className="pb-2 text-right font-medium">With doctor</th>
                    <th className="pb-2 text-right font-medium">Longest wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {doctors.map((doctor) => (
                    <tr key={doctor.name}>
                      <td className="py-2 font-medium">{doctor.name}</td>
                      <td className={cn("py-2 text-right font-mono tabular-nums", doctor.waiting >= 5 && "font-semibold text-warning-text")}>{doctor.waiting}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{doctor.active}</td>
                      <td className={cn("py-2 text-right font-mono tabular-nums", doctor.longest >= WAIT_WARN_MINUTES && "font-semibold text-danger-text")}>{doctor.longest ? `${doctor.longest}m` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface-2 p-4">
            <h2 className="text-sm font-semibold">Manage</h2>
            <div className="mt-3 grid gap-1.5">
              <Shortcut href="/admin/users" icon={Stethoscope} label="Staff accounts & rooms" />
              <Shortcut href="/admin/catalog" icon={Receipt} label="Services & prices" />
              <Shortcut href="/admin/inventory" icon={Boxes} label="Medicine stock & batches" />
              <Shortcut href="/admin/reports" icon={BarChart3} label="Revenue & activity reports" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Per-doctor load from the doctor station queue: who is waiting, who is being seen. */
function doctorLoad(queue: BackendQueueEntry[]) {
  const byDoctor = new Map<string, { name: string; waiting: number; active: number; longest: number }>();
  for (const entry of queue) {
    if (entry.station !== "doctor") continue;
    const name = entry.doctor_name ? `Dr. ${entry.doctor_name}` : "Unassigned";
    const row = byDoctor.get(name) ?? { name, waiting: 0, active: 0, longest: 0 };
    if (entry.status === "waiting") {
      row.waiting += 1;
      row.longest = Math.max(row.longest, entry.wait_minutes);
    } else {
      row.active += 1;
    }
    byDoctor.set(name, row);
  }
  return [...byDoctor.values()].sort((a, b) => b.waiting - a.waiting || a.name.localeCompare(b.name));
}

type Tone = "clinical" | "warning" | "success";
const toneClass: Record<Tone, string> = { clinical: "text-clinical-fill", warning: "text-warning-fill", success: "text-success-fill" };
const hintClass = { muted: "text-fg-muted", danger: "font-medium text-danger-text", warning: "font-medium text-warning-text" };

function Kpi({
  label,
  value,
  hint,
  hintTone = "muted",
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  hintTone?: keyof typeof hintClass;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between text-xs font-medium text-fg-secondary">
        <span>{label}</span>
        <Icon className={cn("size-4", toneClass[tone])} aria-hidden="true" />
      </div>
      <p className="mt-1.5 truncate font-mono text-2xl font-bold tabular-nums">{value}</p>
      <p className={cn("mt-0.5 text-xs", hintClass[hintTone])}>{hint}</p>
    </div>
  );
}

function Shortcut({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-1/70 px-3 py-2 text-[13px] text-fg-secondary transition-colors hover:border-border-strong hover:text-foreground"
    >
      <Icon className="size-4 text-fg-muted" aria-hidden="true" />
      {label}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
