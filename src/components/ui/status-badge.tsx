import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const roles = {
  danger: "bg-danger-bg text-danger-text",
  warning: "bg-warning-bg text-warning-text",
  success: "bg-success-bg text-success-text",
  clinical: "bg-clinical-bg text-clinical-text",
  neutral: "bg-neutral-bg text-neutral-text",
  info: "bg-info-bg text-info-text",
} as const;

export type StatusRole = keyof typeof roles;

export function StatusBadge({
  role,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { role: StatusRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-medium",
        roles[role],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
