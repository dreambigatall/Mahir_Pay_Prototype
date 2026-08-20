"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, DollarSign, Receipt, Search, X } from "lucide-react";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { getPatient } from "@/lib/mock-data";

export default function BillingListPage() {
  const { visits, patients, ready, getInvoiceByVisit } = useClinic();
  const [tab, setTab] = useState<"all" | "unpaid" | "paid">("all");
  const [search, setSearch] = useState("");

  const allBillingVisits = useMemo(() => {
    // Visits that are either ready for billing, billed, or have clinical work
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

    if (tab === "unpaid") {
      rows = rows.filter((r) => !r.isPaid);
    } else if (tab === "paid") {
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
  }, [allBillingVisits, tab, search]);

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
          <p className="mt-0.5 text-[11px] text-fg-muted">
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
          <p className="mt-0.5 text-[11px] text-fg-muted">
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
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {allBillingVisits.length} total visits
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(val) => setTab(val as "all" | "unpaid" | "paid")}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 bg-surface-1 p-1">
            <TabsTrigger value="all" className="text-[13px]">
              All ({allBillingVisits.length})
            </TabsTrigger>
            <TabsTrigger value="unpaid" className="text-[13px]">
              Awaiting payment ({stats.unpaidCount})
            </TabsTrigger>
            <TabsTrigger value="paid" className="text-[13px]">
              Paid ({stats.paidCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, ID, invoice…"
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

      {/* Billing Invoices Table */}
      {filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-[13px] text-fg-muted">
          No billing invoices match the selected filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[22%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Invoice
                </TableHead>
                <TableHead className="h-11 w-[32%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patient
                </TableHead>
                <TableHead className="h-11 w-[22%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Payment status
                </TableHead>
                <TableHead className="h-11 w-[24%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Total amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map(({ invoice, visit, patient, total, isPaid }) => (
                <TableRow key={visit.id} className="h-12 hover:bg-surface-1/60">
                  {/* Invoice Code */}
                  <TableCell className="px-4 py-2.5 text-left">
                    <Link
                      href={`/receptionist/billing/${visit.id}`}
                      className="font-mono text-[13px] font-medium text-clinical-text hover:underline"
                    >
                      {invoice?.id ?? `INV-${visit.id.slice(-4)}`}
                    </Link>
                  </TableCell>

                  {/* Patient Name & Code */}
                  <TableCell className="px-4 py-2.5 text-left">
                    <p className="truncate text-[14px] font-medium text-foreground">
                      {patient?.name}
                    </p>
                    <p className="font-mono text-[11px] text-fg-muted">
                      {patient?.patientId}
                    </p>
                  </TableCell>

                  {/* Payment Status Badge */}
                  <TableCell className="px-4 py-2.5 text-left">
                    {isPaid ? (
                      <StatusBadge role="success">Paid in full</StatusBadge>
                    ) : (
                      <StatusBadge role="warning">Awaiting payment</StatusBadge>
                    )}
                  </TableCell>

                  {/* Total & Checkout Action */}
                  <TableCell className="px-4 py-2.5 text-right font-mono text-[14px] font-semibold tabular-nums text-foreground">
                    <div className="flex items-center justify-end gap-3">
                      <span>{formatMoney(total)}</span>
                      <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[12px]">
                        <Link href={`/receptionist/billing/${visit.id}`}>
                          {isPaid ? "View" : "Collect"}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
