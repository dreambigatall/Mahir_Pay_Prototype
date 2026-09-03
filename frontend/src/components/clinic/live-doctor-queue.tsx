"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Clock3, Loader2, RefreshCw, Search, Stethoscope, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { listQueue, type BackendQueueEntry } from "@/lib/api/workflow";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export function LiveDoctorQueue() {
  const { user } = useSession();
  const [entries, setEntries] = useState<BackendQueueEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await listQueue("doctor");
      setEntries(response.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The doctor queue could not be loaded.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load(true);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh); };
  }, [load]);

  const myEntries = useMemo(() => {
    if (!user) return entries;
    return entries.filter((entry) => !entry.doctor_id || entry.doctor_id === user.id);
  }, [entries, user]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return myEntries;
    return myEntries.filter((entry) =>
      [entry.patient_name, entry.medical_record_number, entry.visit_number].some((field) => field.toLowerCase().includes(value)),
    );
  }, [myEntries, query]);

  if (loading) return <div className="space-y-3" aria-label="Loading doctor queue">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>;

  return (
    <section className="space-y-4" aria-label="Doctor consultation queue">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Waiting for you" value={myEntries.filter((entry) => entry.status === "waiting").length} />
        <Summary label="Called" value={myEntries.filter((entry) => entry.status === "called").length} />
        <Summary label="In consultation" value={myEntries.filter((entry) => entry.status === "in_service").length} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient or visit number" className="min-h-11 pl-9 pr-9" />
          {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-fg-muted hover:bg-accent" aria-label="Clear queue search"><X className="size-4" /></button> : null}
        </div>
        <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={refreshing} onClick={() => void load(true)}>
          {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <span className="flex items-center gap-2"><AlertCircle className="size-4" aria-hidden="true" />{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Try again</Button>
        </div>
      ) : null}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Stethoscope className="mx-auto size-6 text-fg-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No patients are waiting for consultation</p>
          <p className="mt-1 text-xs text-fg-muted">Patients appear here after reception sends them from triage to the doctor station.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((entry) => <DoctorQueueCard key={entry.id} entry={entry} />)}
        </div>
      )}
      <p className="text-xs text-fg-muted">Showing patients assigned to you, plus unassigned visits. Visits assigned to another doctor are hidden.</p>
    </section>
  );
}

function DoctorQueueCard({ entry }: { entry: BackendQueueEntry }) {
  return (
    <article className={cn("rounded-xl border bg-surface-2 p-4", entry.priority === "emergency" ? "border-danger-fill/60" : entry.priority === "urgent" ? "border-warning-fill/60" : "border-border")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-heading text-base font-semibold">{entry.patient_name}</h2>
          <p className="mt-1 font-mono text-xs text-fg-muted">{entry.medical_record_number} · {entry.visit_number}</p>
          <p className="mt-1 text-xs text-fg-secondary">{entry.doctor_name ? `Assigned · ${entry.doctor_name}` : "Unassigned — available to claim"}</p>
        </div>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase", entry.priority === "emergency" ? "bg-danger-fill/15 text-danger-text" : entry.priority === "urgent" ? "bg-warning-fill/15 text-warning-text" : "bg-secondary text-fg-secondary")}>{entry.priority}</span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Waiting {entry.wait_minutes} min · {entry.status.replace("_", " ")}
        </span>
        <Button asChild size="sm" className="min-h-9">
          <Link href={`/doctor/visits/${entry.visit_id}`}>{entry.status === "in_service" ? "Continue" : "Open chart"}</Link>
        </Button>
      </div>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-surface-2 p-4"><p className="text-xs font-medium text-fg-secondary">{label}</p><p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p></div>;
}
