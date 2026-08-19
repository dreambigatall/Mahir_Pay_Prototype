import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[24px] leading-[1.3] font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-[13px] text-fg-secondary">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
