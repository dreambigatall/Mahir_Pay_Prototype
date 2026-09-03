"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Clock3, Loader2, PackageCheck, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { listPharmacyWorklist, type PharmacyPrescription } from "@/lib/api/pharmacy";

export function LivePharmacyBoard() {
  const [items, setItems] = useState<PharmacyPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try { setItems((await listPharmacyWorklist(signal)).items); }
    catch (caught) { if (!signal?.aborted) setError(caught instanceof ApiError ? caught.message : "The pharmacy worklist could not be loaded."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((rx) => `${rx.patient_name} ${rx.visit_number} ${rx.items.map((item) => item.drug_name).join(" ")}`.toLowerCase().includes(query));
  }, [items, search]);
  const remaining = items.reduce((total, rx) => total + rx.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity_prescribed) - Number(item.quantity_dispensed)), 0), 0);

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Ready to dispense" value={String(items.filter((rx) => rx.status === "payment_approved").length)} icon={<Clock3 className="size-4" aria-hidden="true" />} />
      <Metric label="Partially dispensed" value={String(items.filter((rx) => rx.status === "partially_dispensed").length)} icon={<PackageCheck className="size-4" aria-hidden="true" />} />
      <Metric label="Units remaining" value={String(remaining)} icon={<Boxes className="size-4" aria-hidden="true" />} />
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative max-w-md flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient, visit, or medicine" aria-label="Search pharmacy worklist" className="min-h-11 pl-9" /></div>
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={loading} onClick={() => void load()}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />Refresh</Button>
    </div>
    {error ? <div role="alert" className="rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">{error}</div> : null}
    {loading && !items.length ? <div className="flex min-h-48 items-center justify-center text-sm text-fg-muted"><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />Loading pharmacy worklist…</div> : filtered.length ? <div className="grid gap-3 lg:grid-cols-2">{filtered.map((rx) => {
      const units = rx.items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity_prescribed) - Number(item.quantity_dispensed)), 0);
      return <Link key={rx.id} href={`/pharmacy/prescriptions/${rx.id}`} className="block rounded-xl border border-border bg-surface-2 p-5 transition-colors hover:border-primary/40 hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-heading text-base font-semibold">{rx.patient_name}</h2><p className="mt-1 text-xs text-fg-muted">{rx.visit_number} · Prescribed by {rx.prescriber_name}</p></div><span className={rx.status === "partially_dispensed" ? "rounded-full bg-warning-fill/10 px-2.5 py-1 text-xs font-semibold text-warning-text" : "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"}>{rx.status === "partially_dispensed" ? "Partial" : "Paid"}</span></div>
        <div className="mt-4 border-t border-border/60 pt-3"><p className="truncate text-sm text-fg-secondary">{rx.items.map((item) => item.drug_name).join(", ")}</p><p className="mt-1 text-xs text-fg-muted">{rx.items.length} medicine{rx.items.length === 1 ? "" : "s"} · {units} unit{units === 1 ? "" : "s"} remaining</p></div>
      </Link>;
    })}</div> : <div className="rounded-xl border border-dashed border-border p-10 text-center"><PackageCheck className="mx-auto size-8 text-fg-muted" aria-hidden="true" /><p className="mt-3 font-medium">No paid prescriptions are waiting</p><p className="mt-1 text-sm text-fg-muted">Prescriptions appear here automatically after full payment.</p></div>}
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-xl border border-border bg-surface-2 p-4"><div className="flex items-center justify-between text-fg-secondary"><p className="text-xs font-medium">{label}</p>{icon}</div><p className="mt-2 font-mono text-xl font-bold tabular-nums">{value}</p></div>; }
