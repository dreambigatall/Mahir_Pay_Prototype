import { StatusBadge } from "@/components/ui/status-badge";
import type { LabRequest } from "@/lib/types";

export function DoctorLabResults({ requests }: { requests: LabRequest[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-[13px] text-fg-muted">
        No lab requests yet. Use Order lab test and pick from the catalog.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => {
        if (request.status !== "result-ready" || !request.resultValue) {
          return (
            <div
              key={request.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <p className="text-[14px]">{request.testName}</p>
              <StatusBadge role="warning">Awaiting result</StatusBadge>
            </div>
          );
        }

        const value = [request.resultValue, request.resultUnit]
          .filter(Boolean)
          .join(" ");
        const abnormal = request.resultFlag === "abnormal";

        return (
          <div
            key={request.id}
            className="rounded-lg border border-border px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-medium">{request.testName}</p>
                <p className="mt-0.5 text-[14px] tabular-nums">{value}</p>
                {request.resultNotes ? (
                  <p className="mt-1 text-[12px] text-fg-secondary">
                    {request.resultNotes}
                  </p>
                ) : null}
              </div>
              <StatusBadge role={abnormal ? "danger" : "success"}>
                {abnormal ? "Abnormal" : "Normal"}
              </StatusBadge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
