"use client";

import { useMemo } from "react";
import type { Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

type StageConfig = {
  id: string;
  label: string;
  count: number;
  percent: number;
  color: string;
  bgColor: string;
  textColor: string;
};

export function ClinicFlowBar({ visits }: { visits: Visit[] }) {
  const total = visits.length;

  const stages = useMemo<StageConfig[]>(() => {
    const checkedIn = visits.filter((v) => v.status === "registered").length;
    const inConsult = visits.filter((v) => v.status === "in-consultation").length;
    const lab = visits.filter(
      (v) => v.status === "awaiting-lab" || v.status === "lab-complete",
    ).length;
    const billing = visits.filter(
      (v) => v.status === "medication-prescribed" || v.status === "ready-for-billing",
    ).length;
    const completed = visits.filter((v) => v.status === "billed").length;

    const calcPercent = (count: number) =>
      total === 0 ? 0 : Math.round((count / total) * 100);

    return [
      {
        id: "checked-in",
        label: "Checked in",
        count: checkedIn,
        percent: calcPercent(checkedIn),
        color: "bg-neutral-fill",
        bgColor: "bg-neutral-bg",
        textColor: "text-neutral-text",
      },
      {
        id: "consultation",
        label: "In consultation",
        count: inConsult,
        percent: calcPercent(inConsult),
        color: "bg-clinical-fill",
        bgColor: "bg-clinical-bg",
        textColor: "text-clinical-text",
      },
      {
        id: "lab",
        label: "Awaiting lab",
        count: lab,
        percent: calcPercent(lab),
        color: "bg-warning-fill",
        bgColor: "bg-warning-bg",
        textColor: "text-warning-text",
      },
      {
        id: "billing",
        label: "Ready for billing",
        count: billing,
        percent: calcPercent(billing),
        color: "bg-warning-fill",
        bgColor: "bg-warning-bg",
        textColor: "text-warning-text",
      },
      {
        id: "completed",
        label: "Completed",
        count: completed,
        percent: calcPercent(completed),
        color: "bg-success-fill",
        bgColor: "bg-success-bg",
        textColor: "text-success-text",
      },
    ];
  }, [visits, total]);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">
            Outpatient flow distribution
          </h3>
          <p className="text-[12px] text-fg-muted">
            Live patient journey through today’s operational pipeline ({total} visits total)
          </p>
        </div>
      </div>

      {/* Multi-segment Progress Bar */}
      <div className="mt-3.5 flex h-3 w-full overflow-hidden rounded-full bg-surface-1">
        {stages.map((stage) => {
          if (stage.count === 0) return null;
          return (
            <div
              key={stage.id}
              style={{ width: `${Math.max(stage.percent, 4)}%` }}
              className={cn("h-full transition-all duration-300", stage.color)}
              title={`${stage.label}: ${stage.count} (${stage.percent}%)`}
            />
          );
        })}
      </div>

      {/* Segment Legend & Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-1/50 px-2.5 py-2"
          >
            <span className={cn("size-2 shrink-0 rounded-full", stage.color)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-1">
                <p className="truncate text-[12px] text-fg-secondary">{stage.label}</p>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                  {stage.count}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
