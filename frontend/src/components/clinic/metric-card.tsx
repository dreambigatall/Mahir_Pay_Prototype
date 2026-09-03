export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-1 p-4">
      <p className="text-[13px] text-fg-secondary">{label}</p>
      <p className="mt-1 text-[24px] leading-[1.2] font-semibold tabular-nums">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-fg-muted">{hint}</p> : null}
    </div>
  );
}
