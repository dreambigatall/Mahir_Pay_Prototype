import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "default" | "warning" | "success" | "danger" | "clinical";

const iconTone: Record<Tone, string> = {
  default: "text-fg-muted",
  warning: "text-warning-fill",
  success: "text-success-fill",
  danger: "text-danger-fill",
  clinical: "text-clinical-fill",
};

/** A metric that doubles as a filter: click to show only those patients, click again to clear. */
export function StatFilter({
  label,
  hint,
  value,
  icon: Icon,
  tone = "default",
  active,
  onClick,
}: {
  label: string;
  hint: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-surface-2 p-3.5 text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium text-fg-secondary">
        <span>{label}</span>
        <Icon className={cn("size-4", iconTone[tone])} aria-hidden="true" />
      </div>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-fg-muted">{active ? "Showing only these · click to clear" : hint}</p>
    </button>
  );
}
