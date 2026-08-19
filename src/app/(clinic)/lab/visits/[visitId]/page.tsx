"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { getPatient, getStaff, getVisit } from "@/lib/mock-data";
import type { LabResultFlag } from "@/lib/types";

type ResultDraft = {
  resultValue: string;
  resultUnit: string;
  resultFlag: LabResultFlag;
  resultNotes: string;
};

export default function LabVisitPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const { labRequests, ready, markVisitLabsInProgress, submitVisitLabResults } =
    useClinic();
  const requests = labRequests.filter((item) => item.visitId === visitId);
  const visit = getVisit(visitId);
  const patient = visit ? getPatient(visit.patientId) : undefined;
  const doctor = requests[0] ? getStaff(requests[0].doctorId) : undefined;
  const allReady = requests.length > 0 && requests.every((item) => item.status === "result-ready");
  const hasRequested = requests.some((item) => item.status === "requested");

  const initialDrafts = useMemo(() => {
    const drafts: Record<string, ResultDraft> = {};
    for (const request of labRequests) {
      if (request.visitId !== visitId) continue;
      drafts[request.id] = {
        resultValue: request.resultValue ?? "",
        resultUnit: request.resultUnit ?? "",
        resultFlag: request.resultFlag ?? "normal",
        resultNotes: request.resultNotes ?? "",
      };
    }
    return drafts;
  }, [labRequests, visitId]);

  const [drafts, setDrafts] = useState<Record<string, ResultDraft>>({});

  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  useEffect(() => {
    if (!ready || !hasRequested) return;
    markVisitLabsInProgress(visitId);
  }, [ready, visitId, hasRequested, markVisitLabsInProgress]);

  if (!ready) return <div className="min-h-[40vh]" />;
  if (!visit || !patient || requests.length === 0) notFound();

  function updateDraft(id: string, patch: Partial<ResultDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title={patient.name}
        description={`${patient.patientId} · ${requests.length} ${requests.length === 1 ? "test" : "tests"} from ${doctor?.name ?? "the doctor"}`}
        action={
          allReady ? (
            <StatusBadge role="success">Results submitted</StatusBadge>
          ) : (
            <Button
              onClick={() => {
                const missing = requests.filter(
                  (request) => !drafts[request.id]?.resultValue.trim(),
                );
                if (missing.length > 0) {
                  toast.message("Enter a result for every test", {
                    description: missing.map((item) => item.testName).join(", "),
                  });
                  return;
                }
                submitVisitLabResults(visitId, drafts);
                toast.success("Results sent to the doctor", {
                  description: `${patient.name} now has values on the visit record.`,
                });
              }}
            >
              Submit results
            </Button>
          )
        }
      />

      {requests[0]?.clinicalNotes ? (
        <p className="rounded-xl border border-border bg-surface-1 px-4 py-3 text-[13px] text-fg-secondary">
          Clinical notes: {requests[0].clinicalNotes}
        </p>
      ) : null}

      <div className="space-y-3">
        {requests.map((request) => {
          const draft = drafts[request.id] ?? {
            resultValue: "",
            resultUnit: "",
            resultFlag: "normal" as const,
            resultNotes: "",
          };
          return (
            <section
              key={request.id}
              className="rounded-xl border border-border bg-surface-2 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[18px] font-semibold">{request.testName}</h2>
                {request.urgency === "urgent" ? (
                  <StatusBadge role="danger">Urgent</StatusBadge>
                ) : (
                  <StatusBadge role="neutral">Routine</StatusBadge>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`${request.id}-value`} className="font-normal">
                    Result value
                  </Label>
                  <Input
                    id={`${request.id}-value`}
                    className="tabular-nums"
                    placeholder="e.g. 5.4 or Positive"
                    value={draft.resultValue}
                    disabled={allReady}
                    onChange={(event) =>
                      updateDraft(request.id, { resultValue: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`${request.id}-unit`} className="font-normal">
                    Unit
                  </Label>
                  <Input
                    id={`${request.id}-unit`}
                    placeholder="g/dL, mg/dL, %…"
                    value={draft.resultUnit}
                    disabled={allReady}
                    onChange={(event) =>
                      updateDraft(request.id, { resultUnit: event.target.value })
                    }
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <p className="text-[14px]">Flag</p>
                <RadioGroup
                  value={draft.resultFlag}
                  onValueChange={(value) =>
                    updateDraft(request.id, { resultFlag: value as LabResultFlag })
                  }
                  className="flex gap-4"
                  disabled={allReady}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="normal" id={`${request.id}-normal`} />
                    <Label htmlFor={`${request.id}-normal`} className="font-normal">
                      Normal
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="abnormal" id={`${request.id}-abnormal`} />
                    <Label htmlFor={`${request.id}-abnormal`} className="font-normal">
                      Abnormal
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="mt-3 grid gap-1.5">
                <Label htmlFor={`${request.id}-notes`} className="font-normal">
                  Technician notes
                </Label>
                <Textarea
                  id={`${request.id}-notes`}
                  placeholder="Reference range, comments…"
                  value={draft.resultNotes}
                  disabled={allReady}
                  onChange={(event) =>
                    updateDraft(request.id, { resultNotes: event.target.value })
                  }
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
