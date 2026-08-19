"use client";

import { MetricCard } from "@/components/clinic/metric-card";
import { PageHeader } from "@/components/clinic/page-header";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { invoices, todaysVisits } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  const { visits, labRequests } = useClinic();
  const today = todaysVisits(visits);
  const revenue = invoices
    .filter((invoice) => invoice.paymentStatus === "paid")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice.lineItems, invoice.discount), 0);
  const waiting = today.filter((visit) => visit.status === "registered").length;
  const labPending = labRequests.filter((item) => item.status !== "result-ready").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Operations"
        description="Today’s volume, revenue, and work in progress."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today’s visits" value={String(today.length)} hint="All statuses" />
        <MetricCard label="Waiting" value={String(waiting)} hint="Checked in" />
        <MetricCard label="Lab pending" value={String(labPending)} hint="Request or in progress" />
        <MetricCard label="Collected today" value={formatMoney(revenue)} hint="Paid invoices" />
      </div>
    </div>
  );
}
