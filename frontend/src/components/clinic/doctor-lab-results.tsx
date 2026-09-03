"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { useClinic } from "@/lib/clinic-store";
import type { LabRequest } from "@/lib/types";

export function DoctorLabResults({ requests }: { requests: LabRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-[13px] text-fg-muted">
        No investigations requested yet. Use Order lab / imaging and pick from the catalog.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <ResultItem key={request.id} request={request} />
      ))}
    </div>
  );
}

function ResultItem({ request }: { request: LabRequest }) {
  const { reviewLabResult } = useClinic();
  const [note, setNote] = useState("");

  if (request.status !== "result-ready" && request.status !== "reviewed") {
    return (
      <div className="group flex items-center justify-between rounded-lg hover:bg-surface-1/50 px-3 py-2 -mx-3 transition-colors">
        <p className="text-[14px] font-medium text-foreground">{request.testName}</p>
        <Chip variant="warning">Awaiting result</Chip>
      </div>
    );
  }

  const value = [request.resultValue, request.resultUnit]
    .filter(Boolean)
    .join(" ");
  const abnormal = request.resultFlag === "abnormal";
  const isReviewed = request.status === "reviewed";

  return (
    <div className="group rounded-lg hover:bg-surface-1/50 px-3 py-3 -mx-3 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[14px] font-medium text-foreground">{request.testName}</p>
          {value && <p className="mt-0.5 text-[14px] tabular-nums font-mono text-fg-secondary">{value}</p>}
          {request.resultNotes ? (
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-fg-secondary">
              {request.resultNotes}
            </p>
          ) : null}
          
          {!isReviewed && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                placeholder="Add review note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-8 max-w-[200px] text-[13px]"
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => {
                  reviewLabResult(request.id, note.trim());
                  toast.success("Result marked as reviewed");
                }}
              >
                Acknowledge
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Chip variant={abnormal ? "danger" : "success"}>
            {abnormal ? "Abnormal" : "Normal"}
          </Chip>
          {isReviewed && (
            <Chip variant="info">Reviewed</Chip>
          )}
        </div>
      </div>
    </div>
  );
}
