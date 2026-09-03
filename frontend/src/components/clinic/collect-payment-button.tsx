"use client";

import { CollectPaymentModal } from "@/components/clinic/collect-payment-modal";
import type { Invoice } from "@/lib/types";

export function CollectPaymentButton({
  invoice,
  patientName,
}: {
  invoice?: Invoice;
  patientName?: string;
}) {
  if (!invoice) return null;

  return (
    <CollectPaymentModal
      invoice={invoice}
      patientName={patientName ?? "Patient"}
    />
  );
}
