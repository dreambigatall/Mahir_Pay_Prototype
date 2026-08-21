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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-heading text-foreground tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm md:text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
