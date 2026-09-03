"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { getPatient, getVisit } from "@/lib/api/encounters";
import type { BackendPatient } from "@/lib/api/patients";
import { sendVisitToDoctor, type BackendVisit } from "@/lib/api/workflow";
import { announceCoreDataChanged } from "@/lib/core-events";
import { ageFromDob } from "@/lib/format";

export default function ReceptionistVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<BackendVisit | null>(null);
  const [patient, setPatient] = useState<BackendPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const visitResponse = await getVisit(visitId);
      const patientResponse = await getPatient(visitResponse.item.patient_id);
      setVisit(visitResponse.item);
      setPatient(patientResponse.item);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Visit could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => { void load(); }, [load]);

  async function sendToDoctor() {
    if (!visit) return;
    setSending(true);
    try {
      const response = await sendVisitToDoctor(visit.id);
      setVisit(response.item);
      announceCoreDataChanged();
      toast.success("Sent to doctor queue", {
        description: response.item.doctor_name
          ? `${response.item.patient_name} is waiting for ${response.item.doctor_name}.`
          : `${response.item.patient_name} is waiting for consultation.`,
      });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Could not send the patient to the doctor.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  }

  if (error || !visit || !patient) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger-fill/30 bg-danger-fill/10 p-4 text-sm text-danger-text">
          <AlertCircle className="size-4" aria-hidden="true" />{error || "Visit was not found."}
        </div>
        <Button asChild variant="outline"><Link href="/receptionist"><ArrowLeft className="size-4" />Back to queue</Link></Button>
      </div>
    );
  }

  const awaitingTriage = visit.status === "awaiting_triage";
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={name}
        description={`${patient.medical_record_number} · ${ageFromDob(patient.date_of_birth)} yrs · ${patient.sex}`}
      />
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-medium">{visit.reason}</p>
          <Chip variant="neutral">{visit.status.replaceAll("_", " ")}</Chip>
        </div>
        <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="text-[12px] text-fg-muted">Visit</dt>
            <dd className="font-mono">{visit.visit_number}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Doctor</dt>
            <dd>{visit.doctor_name ? `Dr. ${visit.doctor_name}` : "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Phone</dt>
            <dd>{patient.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-fg-muted">Priority</dt>
            <dd className="capitalize">{visit.priority}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/receptionist"><ArrowLeft className="size-4" />Back to queue</Link></Button>
          {awaitingTriage ? (
            <Button type="button" className="gap-1.5" disabled={sending} onClick={() => void sendToDoctor()}>
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />}
              {sending ? "Sending…" : "Send to doctor"}
            </Button>
          ) : null}
          {(visit.status === "ready_for_billing" || visit.status === "billed") ? (
            <Button asChild variant="outline"><Link href={`/receptionist/billing/${visit.id}`}>Open invoice</Link></Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
