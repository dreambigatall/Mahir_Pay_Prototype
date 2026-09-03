"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FlaskConical,
  Receipt,
  Users,
} from "lucide-react";

import { ClinicFlowBar } from "@/components/clinic/clinic-flow-bar";
import { DoctorRoomStatus } from "@/components/clinic/doctor-room-status";
import { PageHeader } from "@/components/clinic/page-header";
import { PriorityAlertsTable } from "@/components/clinic/priority-alerts-table";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { invoices, todaysVisits } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  const { visits, labRequests, ready } = useClinic();
  const today = todaysVisits(visits);

  const completedVisits = today.filter((v) => v.status === "billed").length;
  const activeVisits = today.length - completedVisits;
  const waitingVisits = today.filter((v) => v.status === "registered");
  const overSlaCount = waitingVisits.filter((v) => v.waitMinutes > 20).length;

  const activeLabs = labRequests.filter((item) => item.status !== "result-ready");
  const urgentLabsCount = activeLabs.filter((item) => item.urgency === "urgent").length;

  const paidInvoices = invoices.filter((invoice) => invoice.paymentStatus === "paid");
  const revenue = paidInvoices.reduce(
    (sum, invoice) => sum + invoiceTotal(invoice.lineItems, invoice.discount),
    0,
  );

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations"
        description="Live outpatient volume, practice flow, revenue, and queue performance."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/reports">
                <BarChart3 className="mr-1.5 size-3.5" />
                Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/catalog">
                <Receipt className="mr-1.5 size-3.5" />
                Service catalog
              </Link>
            </Button>
          </div>
        }
      />

      {/* Top Operational KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Volume */}
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Today’s visits</span>
            <Activity className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1.5 font-mono text-[26px] leading-tight font-bold tabular-nums text-foreground">
            {today.length}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-fg-muted">
            <span className="text-success-text font-medium">{completedVisits} completed</span>
            <span>·</span>
            <span>{activeVisits} in clinic</span>
          </div>
        </div>

        {/* Queue & Wait Time */}
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Waiting in queue</span>
            <Clock className="size-4 text-warning-fill" />
          </div>
          <p className="mt-1.5 font-mono text-[26px] leading-tight font-bold tabular-nums text-foreground">
            {waitingVisits.length}
          </p>
          <div className="mt-1 text-[12px]">
            {overSlaCount > 0 ? (
              <span className="text-danger-text font-medium">
                {overSlaCount} {overSlaCount === 1 ? "patient" : "patients"} over 20m SLA
              </span>
            ) : (
              <span className="text-fg-muted">Within normal wait target</span>
            )}
          </div>
        </div>

        {/* Laboratory Workload */}
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Lab pending</span>
            <FlaskConical className="size-4 text-clinical-fill" />
          </div>
          <p className="mt-1.5 font-mono text-[26px] leading-tight font-bold tabular-nums text-foreground">
            {activeLabs.length}
          </p>
          <div className="mt-1 text-[12px]">
            {urgentLabsCount > 0 ? (
              <span className="text-danger-text font-medium">
                {urgentLabsCount} urgent {urgentLabsCount === 1 ? "test" : "tests"}
              </span>
            ) : (
              <span className="text-fg-muted">Routine diagnostic processing</span>
            )}
          </div>
        </div>

        {/* Revenue Collected */}
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between text-fg-secondary">
            <span className="text-[12px] font-medium">Collected today</span>
            <CheckCircle2 className="size-4 text-success-fill" />
          </div>
          <p className="mt-1.5 font-mono text-[26px] leading-tight font-bold tabular-nums text-foreground">
            {formatMoney(revenue)}
          </p>
          <div className="mt-1 text-[12px] text-fg-muted">
            From {paidInvoices.length} paid patient invoices
          </div>
        </div>
      </div>

      {/* Outpatient Journey Distribution Flow */}
      <ClinicFlowBar visits={today} />

      {/* Main Operations Grid */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: Priority Alerts Table */}
        <div className="space-y-4">
          <PriorityAlertsTable visits={today} labRequests={labRequests} />
        </div>

        {/* Right: Staff Room Status & Shortcuts */}
        <div className="space-y-4">
          <DoctorRoomStatus visits={today} />

          {/* Admin Navigation Quick-Links */}
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <h3 className="text-[14px] font-semibold text-foreground">
              Management shortcuts
            </h3>
            <div className="mt-3 space-y-1.5">
              <Link
                href="/admin/catalog"
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1/70 px-3 py-2 text-[13px] text-fg-secondary transition-colors hover:border-border-strong hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-fg-muted" />
                  <span>Service catalog & pricing</span>
                </div>
                <ArrowRight className="size-3.5 text-fg-muted" />
              </Link>

              <Link
                href="/admin/reports"
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1/70 px-3 py-2 text-[13px] text-fg-secondary transition-colors hover:border-border-strong hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-fg-muted" />
                  <span>Revenue & department reports</span>
                </div>
                <ArrowRight className="size-3.5 text-fg-muted" />
              </Link>

              <Link
                href="/admin/users"
                className="flex items-center justify-between rounded-lg border border-border bg-surface-1/70 px-3 py-2 text-[13px] text-fg-secondary transition-colors hover:border-border-strong hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-fg-muted" />
                  <span>Staff accounts & rooms</span>
                </div>
                <ArrowRight className="size-3.5 text-fg-muted" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
