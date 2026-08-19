import { notFound } from "next/navigation";

import { CollectPaymentButton } from "@/components/clinic/collect-payment-button";
import { PageHeader } from "@/components/clinic/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { getInvoiceByVisit, getPatient, getStaff, getVisit } from "@/lib/mock-data";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = getVisit(visitId);
  if (!visit) notFound();

  const patient = getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  const invoice = getInvoiceByVisit(visit.id);
  if (!patient || !invoice) notFound();

  const total = invoiceTotal(invoice.lineItems, invoice.discount);
  const paid = invoice.paymentStatus === "paid";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={`Invoice ${invoice.id}`}
        description={`${patient.name} · ${doctor?.name ?? "Unassigned"}`}
        action={paid ? undefined : <CollectPaymentButton />}
      />
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[13px] text-fg-muted">{patient.patientId}</p>
          {paid ? (
            <StatusBadge role="success">Paid</StatusBadge>
          ) : (
            <StatusBadge role="warning">Awaiting payment</StatusBadge>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {invoice.lineItems.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between text-[14px]"
            >
              <span>{item.name}</span>
              <span className="tabular-nums">{formatMoney(item.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[15px] font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
