"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  DollarSign,
  FlaskConical,
  Pill,
  Printer,
  Stethoscope,
  Syringe,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import { MetricCard } from "@/components/clinic/metric-card";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { staff } from "@/lib/mock-data";

export default function AdminReportsPage() {
  const { invoices, visits, labRequests, prescriptions, ready } = useClinic();
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

  const financialData = useMemo(() => {
    const byType = {
      consultation: 0,
      lab_test: 0,
      drug: 0,
      procedure: 0,
      radiology: 0,
    };

    let totalCollected = 0;
    let totalOutstanding = 0;
    let paidInvoicesCount = 0;
    let unpaidInvoicesCount = 0;

    for (const invoice of invoices) {
      const invTotal = invoiceTotal(invoice.lineItems, invoice.discount);
      if (invoice.paymentStatus === "paid") {
        totalCollected += invTotal;
        paidInvoicesCount++;
        for (const line of invoice.lineItems) {
          if (byType[line.type] !== undefined) {
            byType[line.type] += line.amount;
          }
        }
      } else {
        totalOutstanding += invTotal;
        unpaidInvoicesCount++;
      }
    }

    const totalRevenue =
      byType.consultation + byType.lab_test + byType.drug + byType.procedure + byType.radiology;

    const shares = {
      consultation: totalRevenue > 0 ? Math.round((byType.consultation / totalRevenue) * 100) : 0,
      lab_test: totalRevenue > 0 ? Math.round((byType.lab_test / totalRevenue) * 100) : 0,
      drug: totalRevenue > 0 ? Math.round((byType.drug / totalRevenue) * 100) : 0,
      procedure: totalRevenue > 0 ? Math.round((byType.procedure / totalRevenue) * 100) : 0,
      radiology: totalRevenue > 0 ? Math.round((byType.radiology / totalRevenue) * 100) : 0,
    };

    return {
      byType,
      totalRevenue,
      totalCollected,
      totalOutstanding,
      paidInvoicesCount,
      unpaidInvoicesCount,
      shares,
    };
  }, [invoices]);

  const doctorPerformance = useMemo(() => {
    const doctors = staff.filter((s) => s.role === "doctor");

    return doctors.map((doc) => {
      const docVisits = visits.filter((v) => v.doctorId === doc.id);
      const docCompletedVisits = docVisits.filter(
        (v) => v.status === "billed" || v.status === "ready-for-billing",
      );

      const docLabRequests = labRequests.filter((l) => l.doctorId === doc.id);

      // Sum revenue from visits attended by this doctor
      let docRevenue = 0;
      for (const visit of docVisits) {
        const inv = invoices.find((i) => i.visitId === visit.id);
        if (inv && inv.paymentStatus === "paid") {
          docRevenue += invoiceTotal(inv.lineItems, inv.discount);
        }
      }

      return {
        doctor: doc,
        totalVisits: docVisits.length,
        completedVisits: docCompletedVisits.length,
        labOrders: docLabRequests.length,
        revenue: docRevenue,
      };
    });
  }, [visits, labRequests, invoices]);

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial & operations reports"
        description="Comprehensive analysis of clinic revenue streams, diagnostic volume, and clinician workload."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="size-3.5" />
            Print report
          </Button>
        }
      />

      {/* Top Level Financial KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Consultation revenue</span>
            <Stethoscope className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(financialData.byType.consultation)}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {financialData.shares.consultation}% of total revenue
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Laboratory diagnostics</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(financialData.byType.lab_test)}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {financialData.shares.lab_test}% of total revenue
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Pharmacy & medications</span>
            <Pill className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(financialData.byType.drug)}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {financialData.shares.drug}% of total revenue
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Injections & vaccines</span>
            <Syringe className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-foreground">
            {formatMoney(financialData.byType.procedure)}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {financialData.shares.procedure}% of total revenue
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Outstanding balance</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1 font-mono text-[22px] font-bold tabular-nums text-warning-text">
            {formatMoney(financialData.totalOutstanding)}
          </p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {financialData.unpaidInvoicesCount} unpaid invoices
          </p>
        </div>
      </div>

      {/* Revenue Stream Breakdown Visualizer */}
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Revenue stream breakdown
            </h3>
            <p className="text-[12px] text-fg-muted">
              Total collected: <strong className="font-mono text-foreground">{formatMoney(financialData.totalCollected)}</strong> across {financialData.paidInvoicesCount} settled invoices
            </p>
          </div>

          <div className="flex items-center gap-4 text-[12px]">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-clinical-fill" />
              <span className="text-fg-secondary">Consultation ({financialData.shares.consultation}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-clinical-fill/80" />
              <span className="text-fg-secondary">Lab ({financialData.shares.lab_test}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-clinical-fill/60" />
              <span className="text-fg-secondary">Pharmacy ({financialData.shares.drug}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-clinical-fill/40" />
              <span className="text-fg-secondary">Injections ({financialData.shares.procedure}%)</span>
            </div>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-1 border border-border">
          <div
            style={{ width: `${financialData.shares.consultation}%` }}
            className="bg-clinical-fill transition-all duration-300"
            title={`Consultation: ${financialData.shares.consultation}%`}
          />
          <div
            style={{ width: `${financialData.shares.lab_test}%` }}
            className="bg-clinical-fill/80 transition-all duration-300"
            title={`Lab: ${financialData.shares.lab_test}%`}
          />
          <div
            style={{ width: `${financialData.shares.drug}%` }}
            className="bg-clinical-fill/60 transition-all duration-300"
            title={`Pharmacy: ${financialData.shares.drug}%`}
          />
          <div
            style={{ width: `${financialData.shares.procedure}%` }}
            className="bg-clinical-fill/40 transition-all duration-300"
            title={`Injections: ${financialData.shares.procedure}%`}
          />
        </div>
      </div>

      {/* Doctor Productivity & Attributed Revenue Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">
              Clinician productivity & revenue
            </h3>
            <p className="text-[12px] text-fg-muted">
              Patient consultations, laboratory orders generated, and settled billings.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 w-[35%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Doctor & room
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Patients attended
                </TableHead>
                <TableHead className="h-11 w-[20%] px-4 text-left text-[12px] font-medium text-fg-secondary">
                  Lab requisitions
                </TableHead>
                <TableHead className="h-11 w-[25%] px-4 text-right text-[12px] font-medium text-fg-secondary">
                  Revenue attributed
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctorPerformance.map(({ doctor, totalVisits, completedVisits, labOrders, revenue }) => (
                <TableRow key={doctor.id} className="h-12 hover:bg-surface-1/60">
                  <TableCell className="px-4 py-2.5 text-left">
                    <p className="font-medium text-[14px] text-foreground">{doctor.name}</p>
                    <p className="text-[12px] text-fg-muted">
                      {doctor.title} {doctor.room ? `· ${doctor.room}` : ""}
                    </p>
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-left">
                    <span className="font-mono text-[13px] font-medium text-foreground">
                      {completedVisits}
                    </span>
                    <span className="text-[11px] text-fg-muted ml-1.5">
                      ({totalVisits} queued)
                    </span>
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-left font-mono text-[13px] text-foreground">
                    {labOrders}
                  </TableCell>

                  <TableCell className="px-4 py-2.5 text-right font-mono text-[14px] font-semibold tabular-nums text-foreground">
                    {formatMoney(revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
