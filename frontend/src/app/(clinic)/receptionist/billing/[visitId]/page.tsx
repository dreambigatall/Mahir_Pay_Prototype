"use client";

import { useParams } from "next/navigation";
import { LiveInvoiceWorkspace } from "@/components/clinic/live-invoice-workspace";

export default function InvoicePage() { const { visitId } = useParams<{ visitId: string }>(); return <LiveInvoiceWorkspace visitId={visitId} />; }
