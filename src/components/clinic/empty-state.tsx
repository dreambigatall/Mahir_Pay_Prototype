import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 px-6 py-16 text-center">
      <Icon className="size-6 text-fg-muted" strokeWidth={1.75} />
      <p className="mt-3 text-[15px] font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-fg-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
