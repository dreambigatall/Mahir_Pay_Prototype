"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Printer, Receipt } from "lucide-react";

import { CollectPaymentModal } from "@/components/clinic/collect-payment-modal";
import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useClinic } from "@/lib/clinic-store";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { getPatient, getStaff } from "@/lib/mock-data";

export default function InvoicePage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = use(params);
  const { visits, patients, ready, getInvoiceByVisit } = useClinic();

  if (!ready) {
    return <div className="min-h-[40vh]" />;
  }

  const visit = visits.find((v) => v.id === visitId);
  if (!visit) notFound();

  const patient =
    patients.find((p) => p.id === visit.patientId) || getPatient(visit.patientId);
  const doctor = getStaff(visit.doctorId);
  if (!patient) notFound();

  const invoice = getInvoiceByVisit(visit.id);
  if (!invoice) notFound();

  const total = invoiceTotal(invoice.lineItems, invoice.discount);
  const isPaid = invoice.paymentStatus === "paid" || visit.status === "billed";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Link
          href="/receptionist/billing"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to billing list</span>
        </Link>
      </div>

      <PageHeader
        title={`Invoice ${invoice.id}`}
        description={`${patient.name} · ${doctor?.name ?? "Unassigned doctor"}`}
        action={
          isPaid ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="size-3.5" />
              Print receipt
            </Button>
          ) : (
            <CollectPaymentModal invoice={invoice} patientName={patient.name} />
          )
        }
      />

      <div className="rounded-xl border border-border bg-surface-2 p-5 shadow-none">
        {/* Invoice Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <p className="text-[15px] font-semibold text-foreground">{patient.name}</p>
            <p className="font-mono text-[12px] text-fg-muted">
              {patient.patientId} · Visit {visit.id.toUpperCase()}
            </p>
          </div>

          <div>
            {isPaid ? (
              <Chip variant="success" className="gap-1 font-medium">
                <CheckCircle2 className="size-3" />
                Paid in full
              </Chip>
            ) : (
              <Chip variant="warning" className="font-medium">
                Awaiting payment
              </Chip>
            )}
          </div>
        </div>

        {/* Itemized Line Items */}
        <div className="py-4">
          <p className="text-[12px] font-medium text-fg-secondary uppercase mb-3">
            Itemized clinical charges
          </p>
          <div className="space-y-2.5">
            {invoice.lineItems.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="flex items-center justify-between text-[14px]"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fg-muted border border-border">
                    {item.type === "lab_test"
                      ? "Lab"
                      : item.type === "drug"
                        ? "Pharmacy"
                        : item.type === "procedure"
                          ? "Injection"
                          : "Consult"}
                  </span>
                  <span className="text-foreground">{item.name}</span>
                </div>
                <span className="font-mono tabular-nums text-foreground">
                  {formatMoney(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-border pt-4 space-y-2">
          {invoice.discount > 0 && (
            <div className="flex items-center justify-between text-[13px] text-fg-secondary">
              <span>Discount</span>
              <span className="font-mono tabular-nums text-success-text">
                -{formatMoney(invoice.discount)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-[16px] font-semibold text-foreground">
            <span>Total amount</span>
            <span className="font-mono tabular-nums text-[18px]">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        {/* Settlement Notes */}
        {isPaid && (
          <div className="mt-5 rounded-lg border border-success-fill/20 bg-success-bg/40 p-3 text-[12px] text-success-text">
            Payment has been successfully confirmed and receipt recorded. The patient’s visit is marked as completed.
          </div>
        )}
      </div>
    </div>
  );
}
