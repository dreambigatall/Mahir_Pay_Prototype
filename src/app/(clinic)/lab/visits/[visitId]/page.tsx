"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  FlaskConical,
  Printer,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/clinic/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/textarea";
import { useClinic } from "@/lib/clinic-store";
import { ageFromDob } from "@/lib/format";
import { getPresetForTest } from "@/lib/lab-presets";
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
  const router = useRouter();
  const {
    labRequests,
    ready,
    markVisitLabsInProgress,
    submitVisitLabResults,
  } = useClinic();

  const requests = labRequests.filter((item) => item.visitId === visitId);
  const visit = getVisit(visitId);
  const patient = visit ? getPatient(visit.patientId) : undefined;
  const doctor = requests[0] ? getStaff(requests[0].doctorId) : undefined;
  const allReady =
    requests.length > 0 && requests.every((item) => item.status === "result-ready");
  const hasRequested = requests.some((item) => item.status === "requested");

  const initialDrafts = useMemo(() => {
    const drafts: Record<string, ResultDraft> = {};
    for (const request of labRequests) {
      if (request.visitId !== visitId) continue;
      const preset = getPresetForTest(request.testName);
      drafts[request.id] = {
        resultValue: request.resultValue ?? "",
        resultUnit: request.resultUnit || preset?.defaultUnit || "",
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

  function handlePresetClick(
    requestId: string,
    presetValue: string,
    presetFlag: "normal" | "abnormal",
  ) {
    updateDraft(requestId, {
      resultValue: presetValue,
      resultFlag: presetFlag,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2 text-[13px] text-fg-muted">
        <Link
          href="/lab"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to lab board</span>
        </Link>
      </div>

      <PageHeader
        title={`${patient.name} — Lab diagnostics`}
        description={`${patient.patientId} · ${ageFromDob(patient.dateOfBirth)} ${patient.gender === "F" ? "Female" : "Male"} · Ordered by ${doctor?.name ?? "Attending GP"}`}
        action={
          allReady ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="size-3.5" />
                Print diagnostic report
              </Button>
              <Chip variant="success" icon={<CheckCircle2 />} className="font-medium">
                Results verified
              </Chip>
            </div>
          ) : (
            <Button
              className="gap-1.5"
              onClick={() => {
                const missing = requests.filter(
                  (request) => !drafts[request.id]?.resultValue.trim(),
                );
                if (missing.length > 0) {
                  toast.error("Please enter a result value for all tests", {
                    description: `Missing: ${missing.map((item) => item.testName).join(", ")}`,
                  });
                  return;
                }
                submitVisitLabResults(visitId, drafts);
                toast.success("Diagnostic results verified & submitted", {
                  description: `Results for ${patient.name} are now available to ${doctor?.name ?? "the consulting doctor"}.`,
                });
                router.push("/lab");
              }}
            >
              <FileCheck className="size-4" />
              Submit results
            </Button>
          )
        }
      />

      {/* Clinical Indication Banner */}
      {requests[0]?.clinicalNotes && (
        <div className="rounded-xl border border-border bg-surface-1/70 p-3.5 text-[13px] flex items-start gap-2.5">
          <FlaskConical className="size-4 text-clinical-fill mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-foreground">Clinical Indication: </span>
            <span className="text-fg-secondary">{requests[0].clinicalNotes}</span>
          </div>
        </div>
      )}

      {/* Requisition Tests List */}
      <div className="space-y-4">
        {requests.map((request) => {
          const draft = drafts[request.id] ?? {
            resultValue: "",
            resultUnit: "",
            resultFlag: "normal" as const,
            resultNotes: "",
          };

          const preset = getPresetForTest(request.testName);

          return (
            <section
              key={request.id}
              className="rounded-xl border border-border bg-surface-2 p-5"
            >
              {/* Test Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-foreground">
                    {request.testName}
                  </h2>
                  {preset?.referenceRange && (
                    <span className="rounded bg-surface-1 px-2 py-0.5 text-[11px] font-mono text-fg-muted border border-border">
                      Ref: {preset.referenceRange}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {request.urgency === "urgent" ? (
                    <Chip variant="warning">Urgent / STAT</Chip>
                  ) : (
                    <Chip variant="neutral">Routine</Chip>
                  )}
                </div>
              </div>

              {/* Quick Presets Buttons */}
              {preset && !allReady && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-fg-muted flex items-center gap-1">
                    <Sparkles className="size-3 text-warning-fill" />
                    Quick presets:
                  </span>
                  {preset.presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        handlePresetClick(request.id, p.value, p.flag)
                      }
                      className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[12px] font-medium text-fg-secondary hover:border-border-strong hover:text-foreground transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Value & Unit Inputs */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label
                    htmlFor={`${request.id}-value`}
                    className="text-[13px] font-normal text-fg-secondary"
                  >
                    Observed result value *
                  </Label>
                  <Input
                    id={`${request.id}-value`}
                    className="tabular-nums font-mono bg-background text-[14px]"
                    placeholder="e.g. 5.4 or Negative"
                    value={draft.resultValue}
                    disabled={allReady}
                    onChange={(event) =>
                      updateDraft(request.id, {
                        resultValue: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label
                    htmlFor={`${request.id}-unit`}
                    className="text-[13px] font-normal text-fg-secondary"
                  >
                    Measurement unit
                  </Label>
                  <Input
                    id={`${request.id}-unit`}
                    placeholder="g/dL, mmol/L, %…"
                    value={draft.resultUnit}
                    disabled={allReady}
                    className="bg-background text-[13px]"
                    onChange={(event) =>
                      updateDraft(request.id, {
                        resultUnit: event.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Normal vs Abnormal Flag */}
              <div className="mt-3.5 grid gap-1.5">
                <Label className="text-[13px] font-normal text-fg-secondary">
                  Clinical flag interpretation
                </Label>
                <RadioGroup
                  value={draft.resultFlag}
                  onValueChange={(value) =>
                    updateDraft(request.id, {
                      resultFlag: value as LabResultFlag,
                    })
                  }
                  className="flex gap-4"
                  disabled={allReady}
                >
                  <label
                    htmlFor={`${request.id}-normal`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] hover:border-border-strong"
                  >
                    <RadioGroupItem value="normal" id={`${request.id}-normal`} />
                    <span className="font-medium text-foreground">Normal (Within range)</span>
                  </label>

                  <label
                    htmlFor={`${request.id}-abnormal`}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-danger-fill/30 bg-danger-bg/40 px-3 py-1.5 text-[13px] text-danger-text hover:border-danger-fill"
                  >
                    <RadioGroupItem value="abnormal" id={`${request.id}-abnormal`} />
                    <span className="font-semibold">Abnormal / Critical</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Technician Notes */}
              <div className="mt-3.5 grid gap-1.5">
                <Label
                  htmlFor={`${request.id}-notes`}
                  className="text-[13px] font-normal text-fg-secondary"
                >
                  Technician remarks & commentary
                </Label>
                <Textarea
                  id={`${request.id}-notes`}
                  placeholder="Additional diagnostic findings, morphology observations, or specimen comments…"
                  value={draft.resultNotes}
                  disabled={allReady}
                  className="bg-background text-[13px]"
                  rows={2}
                  onChange={(event) =>
                    updateDraft(request.id, {
                      resultNotes: event.target.value,
                    })
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
