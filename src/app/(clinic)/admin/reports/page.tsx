import { MetricCard } from "@/components/clinic/metric-card";
import { PageHeader } from "@/components/clinic/page-header";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { invoices } from "@/lib/mock-data";

export default function AdminReportsPage() {
  const byType = {
    consultation: 0,
    lab_test: 0,
    drug: 0,
  };
  for (const invoice of invoices) {
    if (invoice.paymentStatus !== "paid") continue;
    for (const line of invoice.lineItems) {
      byType[line.type] += line.amount;
    }
  }
  const outstanding = invoices
    .filter((invoice) => invoice.paymentStatus !== "paid")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice.lineItems, invoice.discount), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Revenue by category from paid invoices. Export comes in a later phase."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Consultations" value={formatMoney(byType.consultation)} />
        <MetricCard label="Laboratory" value={formatMoney(byType.lab_test)} />
        <MetricCard label="Medication" value={formatMoney(byType.drug)} />
        <MetricCard label="Outstanding" value={formatMoney(outstanding)} hint="Unpaid invoices" />
      </div>
    </div>
  );
}
