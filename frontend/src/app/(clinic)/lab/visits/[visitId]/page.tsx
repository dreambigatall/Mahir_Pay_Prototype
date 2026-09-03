"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { listDiagnosticWorklist } from "@/lib/api/diagnostics";

export default function LegacyLabVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const router = useRouter();
  useEffect(() => { void listDiagnosticWorklist().then((response) => { const order = response.items.find((item) => item.visit_id === visitId); router.replace(order ? `/lab/requests/${order.id}` : "/lab"); }).catch(() => router.replace("/lab")); }, [router, visitId]);
  return <div className="flex min-h-48 items-center justify-center text-sm text-fg-muted"><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />Opening laboratory order…</div>;
}
