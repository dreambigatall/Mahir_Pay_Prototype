"use client";

import { Check } from "lucide-react";

import { isDoseOverdue } from "@/lib/courses";
import { CLINIC_TODAY, formatShortDate } from "@/lib/format";
import type { CourseDose } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CourseDoseGrid({
  doses,
  selectedId,
  onSelect,
}: {
  doses: CourseDose[];
  selectedId?: string;
  onSelect?: (dose: CourseDose) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {doses.map((dose) => {
        const overdue = isDoseOverdue(dose);
        const isToday = dose.scheduledDate === CLINIC_TODAY;
        const given = dose.status === "given";
        const checkedIn = dose.status === "checked-in";
        const missed = dose.status === "missed";

        const className = cn(
              "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center transition-colors",
              given && "border-success-fill/30 bg-success-bg/50",
              checkedIn && "border-clinical-fill/40 bg-clinical-bg",
              missed && "border-danger-fill/30 bg-danger-bg/40",
              overdue && !given && !missed && "border-warning-fill/40 bg-warning-bg/50",
              !given &&
                !checkedIn &&
                !missed &&
                !overdue &&
                "border-border bg-surface-1",
              isToday && "ring-1 ring-foreground/20",
              selectedId === dose.id && "border-foreground/50",
            );

        if (!onSelect) {
          return (
            <div key={dose.id} className={className}>
              <span className="text-[10px] font-medium uppercase text-fg-muted">
                D{dose.dayNumber}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  given
                    ? "bg-success-fill text-white"
                    : checkedIn
                      ? "bg-clinical-fill text-white"
                      : missed
                        ? "bg-danger-fill text-white"
                        : "bg-surface-2 text-fg-secondary",
                )}
              >
                {given ? <Check className="size-3.5" strokeWidth={2.5} /> : dose.dayNumber}
              </span>
              <span className="text-[9px] leading-tight text-fg-muted">
                {formatShortDate(dose.scheduledDate).replace(",", "")}
              </span>
            </div>
          );
        }

        return (
          <button
            key={dose.id}
            type="button"
            onClick={() => onSelect(dose)}
            className={className}
          >
            <span className="text-[10px] font-medium uppercase text-fg-muted">
              D{dose.dayNumber}
            </span>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[12px] font-semibold",
                given
                  ? "bg-success-fill text-white"
                  : checkedIn
                    ? "bg-clinical-fill text-white"
                    : missed
                      ? "bg-danger-fill text-white"
                      : "bg-surface-2 text-fg-secondary",
              )}
            >
              {given ? <Check className="size-3.5" strokeWidth={2.5} /> : dose.dayNumber}
            </span>
            <span className="text-[9px] leading-tight text-fg-muted">
              {formatShortDate(dose.scheduledDate).replace(",", "")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
