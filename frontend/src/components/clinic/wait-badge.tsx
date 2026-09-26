import { Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Minutes after which a waiting patient needs attention (amber) or is overdue (red). */
export const WAIT_WARN_MINUTES = 20;
export const WAIT_LATE_MINUTES = 45;

export function waitTone(minutes: number): "ok" | "warn" | "late" {
  if (minutes >= WAIT_LATE_MINUTES) return "late";
  if (minutes >= WAIT_WARN_MINUTES) return "warn";
  return "ok";
}

export function formatWait(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function WaitBadge({ minutes, label = "Waiting", className }: { minutes: number; label?: string; className?: string }) {
  const tone = waitTone(minutes);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        tone === "late" && "bg-danger-fill/15 text-danger-text",
        tone === "warn" && "bg-warning-fill/15 text-warning-text",
        tone === "ok" && "bg-surface-1 text-fg-secondary",
        className,
      )}
      title={tone === "late" ? "Overdue — see this patient first" : tone === "warn" ? "Waiting longer than target" : undefined}
    >
      <Clock3 className="size-3" aria-hidden="true" />
      {label} {formatWait(minutes)}
    </span>
  );
}
