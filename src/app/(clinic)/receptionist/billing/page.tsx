"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, DollarSign, Receipt, Search, X, ChevronLeft, ChevronRight, GripVertical, Filter } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
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
import { formatMoney, invoiceTotal } from "@/lib/format";
import { getPatient } from "@/lib/mock-data";

const BILLING_COLUMNS = [
  { id: "unpaid", title: "Awaiting Payment", isPaid: false },
  { id: "paid", title: "Paid in Full", isPaid: true },
];

export default function BillingListPage() {
  const { visits, patients, ready, getInvoiceByVisit } = useClinic();
  const [filterTab, setFilterTab] = useState<"all" | "unpaid" | "paid">("all");
  const [search, setSearch] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const allBillingVisits = useMemo(() => {
    return visits
      .filter(
        (v) =>
          v.status === "ready-for-billing" ||
          v.status === "billed" ||
          v.status === "lab-complete" ||
          v.status === "medication-prescribed",
      )
      .map((visit) => {
        const patient =
          patients.find((p) => p.id === visit.patientId) || getPatient(visit.patientId);
        const invoice = getInvoiceByVisit(visit.id);
        const total = invoice
          ? invoiceTotal(invoice.lineItems, invoice.discount)
          : 0;
        const isPaid = invoice?.paymentStatus === "paid" || visit.status === "billed";

        return { visit, patient, invoice, total, isPaid };
      });
  }, [visits, patients, getInvoiceByVisit]);

  const stats = useMemo(() => {
    const totalCollected = allBillingVisits
      .filter((r) => r.isPaid)
      .reduce((sum, r) => sum + r.total, 0);

    const totalOutstanding = allBillingVisits
      .filter((r) => !r.isPaid)
      .reduce((sum, r) => sum + r.total, 0);

    const unpaidCount = allBillingVisits.filter((r) => !r.isPaid).length;
    const paidCount = allBillingVisits.filter((r) => r.isPaid).length;

    return { totalCollected, totalOutstanding, unpaidCount, paidCount };
  }, [allBillingVisits]);

  const filteredRows = useMemo(() => {
    let rows = allBillingVisits;

    if (filterTab === "unpaid") {
      rows = rows.filter((r) => !r.isPaid);
    } else if (filterTab === "paid") {
      rows = rows.filter((r) => r.isPaid);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.patient?.name.toLowerCase().includes(q) ||
          r.patient?.patientId.toLowerCase().includes(q) ||
          r.invoice?.id.toLowerCase().includes(q),
      );
    }

    return rows;
  }, [allBillingVisits, filterTab, search]);

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
  }, [filteredRows]);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 402;
      scrollRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & cashier"
        description="Patient invoicing, clinical charge reconciliations, and payment collection."
      />

      {/* Summary KPI Cards */}
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

        <div className="rounded-xl border border-border bg-surface-2 p-3.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Total billed</span>
            <DollarSign className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(stats.totalCollected + stats.totalOutstanding)}
          </p>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {allBillingVisits.length} total visits
          </p>
        </div>
      </div>

      {/* Control Bar: Filter Tabs, Search */}
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
                <span>All invoices</span>
                <span className="ml-3 text-[12px] font-mono text-fg-muted bg-surface-2 px-1.5 py-0.5 rounded-full">
                  {allBillingVisits.length}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="unpaid" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-warning-fill" />
                  <span>Awaiting payment</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-warning-text bg-warning-fill/10 px-1.5 py-0.5 rounded-full">
                  {stats.unpaidCount}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="paid" className="pl-3 py-2">
              <div className="flex items-center justify-between w-full min-w-40">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-success-fill" />
                  <span>Paid</span>
                </div>
                <span className="ml-3 text-[12px] font-mono text-success-text bg-success-fill/10 px-1.5 py-0.5 rounded-full">
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, ID, invoice…"
              className="h-9 pl-8 pr-8 text-[13px] bg-background"
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
            {BILLING_COLUMNS.map((column) => {
              const cards = filteredRows.filter((r) => r.isPaid === column.isPaid);
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
                        No invoices in this stage
                      </p>
                    ) : (
                      cards.map(({ invoice, visit, patient, total, isPaid }) => (
                        <Link
                          key={visit.id}
                          href={`/receptionist/billing/${visit.id}`}
                          className="group block rounded-xl border border-border/60 bg-surface-2 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-primary/30 mb-3"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <GripVertical className="size-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                              <p className="text-lg font-bold font-heading text-foreground group-hover:text-primary transition-colors truncate">
                                {patient?.name}
                              </p>
                            </div>
                            {isPaid ? (
                              <Chip variant="success">Paid in full</Chip>
                            ) : (
                              <Chip variant="warning">Awaiting payment</Chip>
                            )}
                          </div>

                          <p className="mt-2.5 font-mono text-sm text-muted-foreground">
                            {patient?.patientId} · {invoice?.id ?? `INV-${visit.id.slice(-4)}`}
                          </p>

                          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                            <span className="text-[14px] text-fg-muted">Total</span>
                            <span className="font-mono text-[16px] font-semibold tabular-nums text-foreground">
                              {formatMoney(total)}
                            </span>
                          </div>
                        </Link>
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
