"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  GripVertical,
  Loader2,
  RefreshCw,
  Search,
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

const BILLING_COLUMNS = [
  { id: "unpaid", title: "Awaiting Payment", isPaid: false },
  { id: "paid", title: "Paid in Full", isPaid: true },
] as const;

type BillingCard = {
  key: string;
  visitId: string;
  patientName: string;
  patientRef: string;
  invoiceLabel: string;
  total: number;
  isPaid: boolean;
};

export function LiveBillingBoard() {
  const [visits, setVisits] = useState<BillableVisit[]>([]);
  const [outstanding, setOutstanding] = useState<BackendInvoice[]>([]);
  const [paidToday, setPaidToday] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unpaid" | "paid">("all");
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
    const unpaid: BillingCard[] = [
      ...visits.map((visit) => ({
        key: `visit-${visit.id}`,
        visitId: visit.id,
        patientName: visit.patient_name,
        patientRef: visit.medical_record_number,
        invoiceLabel: visit.visit_number,
        total: 0,
        isPaid: false,
      })),
      ...outstanding.map((invoice) => ({
        key: `invoice-${invoice.id}`,
        visitId: invoice.visit_id,
        patientName: invoice.patient_name,
        patientRef: invoice.visit_number,
        invoiceLabel: invoice.invoice_number,
        total: Number(invoice.balance_due),
        isPaid: false,
      })),
    ];

    const paid: BillingCard[] = paidToday.map((invoice) => ({
      key: `paid-${invoice.id}`,
      visitId: invoice.visit_id,
      patientName: invoice.patient_name,
      patientRef: invoice.visit_number,
      invoiceLabel: invoice.invoice_number,
      total: Number(invoice.total),
      isPaid: true,
    }));

    return [...unpaid, ...paid];
  }, [outstanding, paidToday, visits]);

  const stats = useMemo(() => {
    const unpaidCards = cards.filter((card) => !card.isPaid);
    const paidCards = cards.filter((card) => card.isPaid);
    const totalOutstanding = unpaidCards.reduce((sum, card) => sum + card.total, 0);
    const totalCollected = paidCards.reduce((sum, card) => sum + card.total, 0);
    return {
      totalOutstanding,
      totalCollected,
      unpaidCount: unpaidCards.length,
      paidCount: paidCards.length,
      totalBilled: totalOutstanding + totalCollected,
    };
  }, [cards]);

  const filtered = useMemo(() => {
    let list = cards;
    if (filterTab === "unpaid") list = list.filter((card) => !card.isPaid);
    if (filterTab === "paid") list = list.filter((card) => card.isPaid);

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-96 w-[400px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Awaiting payment</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">
            {formatMoney(stats.totalOutstanding)}
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {stats.unpaidCount} patient {stats.unpaidCount === 1 ? "invoice" : "invoices"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Collected today</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-success-text">
            {formatMoney(stats.totalCollected)}
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {stats.paidCount} settled {stats.paidCount === 1 ? "invoice" : "invoices"}
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-border bg-surface-2 p-3.5 sm:col-span-1">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total billed</span>
            <DollarSign className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(stats.totalBilled)}
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">{cards.length} total visits</p>
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
                <span>All invoices</span>
                <span className="ml-3 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted">
                  {cards.length}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="unpaid" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Awaiting payment</span>
                </div>
                <span className="ml-3 rounded-full bg-warning-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-warning-text">
                  {stats.unpaidCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="paid" className="py-2 pl-3">
              <div className="flex min-w-40 w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>Paid</span>
                </div>
                <span className="ml-3 rounded-full bg-success-fill/10 px-1.5 py-0.5 font-mono text-[12px] text-success-text">
                  {stats.paidCount}
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
            const columnCards = filtered.filter((card) => card.isPaid === column.isPaid);
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
        {card.isPaid ? (
          <Chip variant="success">Paid in full</Chip>
        ) : (
          <Chip variant="warning">Awaiting payment</Chip>
        )}
      </div>

      <p className="mt-2.5 font-mono text-sm text-muted-foreground">
        {card.patientRef} · {card.invoiceLabel}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
        <span className="text-[14px] text-fg-muted">Total</span>
        <span className="font-mono text-[16px] font-semibold text-foreground tabular-nums">
          {card.isPaid || card.total > 0 ? formatMoney(card.total) : "Create invoice"}
        </span>
      </div>
    </Link>
  );
}
