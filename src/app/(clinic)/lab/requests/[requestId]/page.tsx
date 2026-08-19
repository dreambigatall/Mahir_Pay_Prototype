"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { useClinic } from "@/lib/clinic-store";

export default function LegacyLabRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const { labRequests, ready } = useClinic();
  const request = labRequests.find((item) => item.id === requestId);

  useEffect(() => {
    if (!ready) return;
    if (request) router.replace(`/lab/visits/${request.visitId}`);
  }, [ready, request, router]);

  return <div className="min-h-[40vh]" />;
}
