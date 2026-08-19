import Link from "next/link";

import { PageHeader } from "@/components/clinic/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, invoiceTotal } from "@/lib/format";
import { getPatient, invoices, visits } from "@/lib/mock-data";

export default function BillingListPage() {
  const rows = invoices.map((invoice) => {
    const visit = visits.find((item) => item.id === invoice.visitId);
    const patient = visit ? getPatient(visit.patientId) : undefined;
    return { invoice, visit, patient };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing"
        description="Invoices are built from consultation, lab, and medication charges."
      />
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Invoice
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Patient
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Status
              </TableHead>
              <TableHead className="h-11 text-right text-[12px] font-medium text-fg-secondary">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ invoice, visit, patient }) => (
              <TableRow key={invoice.id} className="h-11">
                <TableCell className="font-mono text-[13px]">
                  <Link
                    href={`/receptionist/billing/${visit?.id}`}
                    className="hover:underline"
                  >
                    {invoice.id}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">{patient?.name}</TableCell>
                <TableCell>
                  {invoice.paymentStatus === "paid" ? (
                    <StatusBadge role="success">Paid</StatusBadge>
                  ) : (
                    <StatusBadge role="warning">Awaiting payment</StatusBadge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(invoiceTotal(invoice.lineItems, invoice.discount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
