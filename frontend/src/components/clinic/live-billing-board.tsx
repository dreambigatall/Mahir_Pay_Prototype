"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Filter,
  GripVertical,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
import {
  listBillableVisits,
  listOutstandingInvoices,
  listPaidInvoicesToday,
  type BackendInvoice,
  type BillableVisit,
} from "@/lib/api/billing";
import { CORE_DATA_CHANGED_EVENT } from "@/lib/core-events";
import { formatMoney } from "@/lib/format";

type BillingStage = "awaiting" | "partial" | "credit" | "paid";
type FilterTab = "all" | BillingStage;

const BILLING_COLUMNS: Array<{ id: BillingStage; title: string }> = [
  { id: "awaiting", title: "Awaiting Payment" },
  { id: "partial", title: "Partially Paid" },
  { id: "credit", title: "On Credit" },
  { id: "paid", title: "Paid in Full" },
];

type BillingCard = {
  key: string;
  visitId: string;
  patientName: string;
  patientRef: string;
  invoiceLabel: string;
  total: number;
  amountPaid: number;
  stage: BillingStage;
  dueAt: string | null;
  pendingRxCount: number;
  pendingRxSummary: string | null;
};

export function LiveBillingBoard() {
  const [visits, setVisits] = useState<BillableVisit[]>([]);
  const [outstanding, setOutstanding] = useState<BackendInvoice[]>([]);
  const [paidToday, setPaidToday] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [ready, open, paid] = await Promise.all([
        listBillableVisits(),
        listOutstandingInvoices(),
        listPaidInvoicesToday(),
      ]);
      setVisits(ready.items);
      setOutstanding(open.items);
      setPaidToday(paid.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The billing worklist could not be loaded.");
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
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CORE_DATA_CHANGED_EVENT, refresh);
    };
  }, [load]);

  const cards = useMemo<BillingCard[]>(() => {
    const invoicedVisitIds = new Set(outstanding.map((invoice) => invoice.visit_id));

    const awaitingVisits: BillingCard[] = visits
      .filter((visit) => !invoicedVisitIds.has(visit.id))
      .map((visit) => ({
        key: `visit-${visit.id}`,
        visitId: visit.id,
        patientName: visit.patient_name,
        patientRef: visit.medical_record_number,
        invoiceLabel: visit.visit_number,
        total: 0,
        amountPaid: 0,
        stage: "awaiting" as const,
        dueAt: null,
        pendingRxCount: Number(visit.pending_rx_count ?? 0),
        pendingRxSummary: visit.pending_rx_summary ?? null,
      }));

    const openInvoices: BillingCard[] = outstanding.map((invoice) => ({
      key: `invoice-${invoice.id}`,
      visitId: invoice.visit_id,
      patientName: invoice.patient_name,
      patientRef: invoice.visit_number,
      invoiceLabel: invoice.invoice_number,
      total: Number(invoice.balance_due),
      amountPaid: Number(invoice.amount_paid),
      stage: invoiceStage(invoice),
      dueAt: invoice.due_at,
      pendingRxCount: Number(invoice.pending_rx_count ?? 0),
      pendingRxSummary: invoice.pending_rx_summary ?? null,
    }));

    const paid: BillingCard[] = paidToday.map((invoice) => ({
      key: `paid-${invoice.id}`,
      visitId: invoice.visit_id,
      patientName: invoice.patient_name,
      patientRef: invoice.visit_number,
      invoiceLabel: invoice.invoice_number,
      total: Number(invoice.total),
      amountPaid: Number(invoice.amount_paid),
      stage: "paid" as const,
      dueAt: null,
      pendingRxCount: 0,
      pendingRxSummary: null,
    }));

    return [...awaitingVisits, ...openInvoices, ...paid];
  }, [outstanding, paidToday, visits]);

  const stats = useMemo(() => {
    const byStage = (stage: BillingStage) => cards.filter((card) => card.stage === stage);
    const awaiting = byStage("awaiting");
    const partial = byStage("partial");
    const credit = byStage("credit");
    const paid = byStage("paid");
    const open = [...awaiting, ...partial, ...credit];
    return {
      awaitingCount: awaiting.length,
      partialCount: partial.length,
      creditCount: credit.length,
      paidCount: paid.length,
      totalOutstanding: open.reduce((sum, card) => sum + card.total, 0),
      totalCollected: paid.reduce((sum, card) => sum + card.total, 0),
      totalBilled: open.reduce((sum, card) => sum + card.total, 0) + paid.reduce((sum, card) => sum + card.total, 0),
    };
  }, [cards]);

  const filtered = useMemo(() => {
    let list = cards;
    if (filterTab !== "all") list = list.filter((card) => card.stage === filterTab);

    const value = search.trim().toLowerCase();
    if (value) {
      list = list.filter((card) =>
        [card.patientName, card.patientRef, card.invoiceLabel, card.visitId]
          .some((field) => field.toLowerCase().includes(value)),
      );
    }
    return list;
  }, [cards, filterTab, search]);

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
  }, [filtered]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -402 : 402, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="space-y-5" aria-label="Loading billing board">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-96 w-[400px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Awaiting payment"
          value={formatMoney(cards.filter((c) => c.stage === "awaiting").reduce((s, c) => s + c.total, 0))}
          hint={`${stats.awaitingCount} ${stats.awaitingCount === 1 ? "invoice" : "invoices"}`}
          icon={<Clock className="size-4 text-warning-fill" />}
          valueClass="text-warning-text"
        />
        <StatCard
          label="Partially paid"
          value={String(stats.partialCount)}
          hint={`${formatMoney(cards.filter((c) => c.stage === "partial").reduce((s, c) => s + c.total, 0))} still due`}
          icon={<Wallet className="size-4 text-clinical-fill" />}
          valueClass="text-clinical-text"
        />
        <StatCard
          label="On credit"
          value={String(stats.creditCount)}
          hint={`${formatMoney(cards.filter((c) => c.stage === "credit").reduce((s, c) => s + c.total, 0))} still due`}
          icon={<CreditCard className="size-4 text-info-fill" />}
          valueClass="text-info-text"
        />
        <StatCard
          label="Collected today"
          value={formatMoney(stats.totalCollected)}
          hint={`${stats.paidCount} settled ${stats.paidCount === 1 ? "invoice" : "invoices"}`}
          icon={<CheckCircle2 className="size-4 text-success-fill" />}
          valueClass="text-success-text"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={filterTab} onValueChange={(value) => setFilterTab(value as FilterTab)}>
          <SelectTrigger className="h-9 w-full border-border/60 bg-background px-4 text-[13px] font-medium transition-colors hover:bg-surface-2 focus:ring-1 focus:ring-ring/50 sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-primary" />
              <SelectValue placeholder="Filter..." />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="py-2 pl-3">
              <FilterRow label="All invoices" count={cards.length} />
            </SelectItem>
            <SelectItem value="awaiting" className="py-2 pl-3">
              <FilterRow
                label="Awaiting payment"
                count={stats.awaitingCount}
                icon={<Clock className="size-3.5 text-warning-fill" />}
                countClass="bg-warning-fill/10 text-warning-text"
              />
            </SelectItem>
            <SelectItem value="partial" className="py-2 pl-3">
              <FilterRow
                label="Partially paid"
                count={stats.partialCount}
                icon={<Wallet className="size-3.5 text-clinical-fill" />}
                countClass="bg-clinical-fill/10 text-clinical-text"
              />
            </SelectItem>
            <SelectItem value="credit" className="py-2 pl-3">
              <FilterRow
                label="On credit"
                count={stats.creditCount}
                icon={<CreditCard className="size-3.5 text-info-fill" />}
                countClass="bg-info-fill/10 text-info-text"
              />
            </SelectItem>
            <SelectItem value="paid" className="py-2 pl-3">
              <FilterRow
                label="Paid in full"
                count={stats.paidCount}
                icon={<CheckCircle2 className="size-3.5 text-success-fill" />}
                countClass="bg-success-fill/10 text-success-text"
              />
            </SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search patient, ID, invoice…"
              className="h-9 bg-background pr-8 pl-8 text-[13px]"
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
            Refresh
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
          {BILLING_COLUMNS.map((column) => {
            const columnCards = filtered.filter((card) => card.stage === column.id);
            return (
              <div key={column.id} className="w-[400px] shrink-0 rounded-2xl bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between border-b border-border/50 pb-3.5">
                  <p className="font-heading text-xl font-bold tracking-tight text-foreground">{column.title}</p>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-sm font-medium text-secondary-foreground">
                    {columnCards.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {columnCards.length === 0 ? (
                    <p className="py-12 text-center text-[16px] text-fg-muted">No invoices in this stage</p>
                  ) : (
                    columnCards.map((card) => <BillingKanbanCard key={card.key} card={card} />)
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

function BillingKanbanCard({ card }: { card: BillingCard }) {
  const overdue = card.stage === "credit" && card.dueAt ? isOverdue(card.dueAt) : false;
  return (
    <Link
      href={`/receptionist/billing/${card.visitId}`}
      className="group mb-3 block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <GripVertical className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          <p className="truncate font-heading text-lg font-bold text-foreground transition-colors group-hover:text-primary">
            {card.patientName}
          </p>
        </div>
        <StageChip stage={card.stage} overdue={overdue} />
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {card.patientRef} · {card.invoiceLabel}
      </p>

      {card.stage === "credit" && card.dueAt ? (
        <p className={`mt-2 text-sm ${overdue ? "text-danger-text" : "text-fg-muted"}`}>
          Due {formatShortDate(card.dueAt)}
        </p>
      ) : null}

      {card.stage === "partial" && card.amountPaid > 0 ? (
        <p className="mt-2 text-sm text-fg-muted">
          Paid {formatMoney(card.amountPaid)} · {formatMoney(card.total)} left
        </p>
      ) : null}

      {card.stage === "awaiting" && card.pendingRxCount > 0 ? (
        <div className="mt-3 rounded-lg border border-warning-fill/20 bg-warning-fill/10 px-3 py-2 text-sm text-warning-text">
          <p className="font-medium">Rx pending payment · {card.pendingRxCount}</p>
          {card.pendingRxSummary ? <p className="mt-0.5 truncate text-xs opacity-90">{card.pendingRxSummary}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
        <span className="text-[14px] text-fg-muted">
          {card.stage === "paid" ? "Total" : card.stage === "awaiting" && card.total === 0 ? "Total" : "Balance"}
        </span>
        <span className="font-mono text-[16px] font-semibold text-foreground tabular-nums">
          {card.stage === "paid" || card.total > 0 ? formatMoney(card.total) : "Create invoice"}
        </span>
      </div>
    </Link>
  );
}

function StageChip({ stage, overdue }: { stage: BillingStage; overdue: boolean }) {
  if (stage === "paid") return <Chip variant="success">Paid in full</Chip>;
  if (stage === "credit") return <Chip variant={overdue ? "danger" : "info"}>{overdue ? "Credit overdue" : "On credit"}</Chip>;
  if (stage === "partial") return <Chip variant="clinical">Partially paid</Chip>;
  return <Chip variant="warning">Awaiting payment</Chip>;
}

function StatCard({
  label,
  value,
  hint,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3.5">
      <div className="flex items-center justify-between text-fg-secondary">
        <span className="text-[12px] font-medium">{label}</span>
        {icon}
      </div>
      <p className={`mt-1 font-mono text-[22px] font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-[12px] text-fg-muted">{hint}</p>
    </div>
  );
}

function FilterRow({
  label,
  count,
  icon,
  countClass = "bg-surface-2 text-fg-muted",
}: {
  label: string;
  count: number;
  icon?: ReactNode;
  countClass?: string;
}) {
  return (
    <div className="flex min-w-44 w-full items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`ml-3 rounded-full px-1.5 py-0.5 font-mono text-[12px] ${countClass}`}>{count}</span>
    </div>
  );
}

function invoiceStage(invoice: BackendInvoice): BillingStage {
  if (invoice.status === "paid") return "paid";
  if (invoice.on_credit) return "credit";
  if (invoice.status === "partially_paid" && Number(invoice.amount_paid) > 0) return "partial";
  return "awaiting";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function isOverdue(dueAt: string) {
  const [year, month, day] = dueAt.slice(0, 10).split("-").map(Number);
  const due = Date.UTC(year!, month! - 1, day!);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return due < today;
}
