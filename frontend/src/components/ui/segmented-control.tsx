"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: ReactNode; tone?: "default" | "warning" | "danger" };

/**
 * One-tap choice between a few options (sex, priority, payment method).
 * Faster than a dropdown and shows every option at once.
 */
export function SegmentedControl<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  onBlur,
  error,
  required,
  className,
}: {
  id: string;
  label: string;
  value: T | "";
  options: Array<Option<T>>;
  onChange: (value: T) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  className?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label id={`${id}-label`} className="text-[13px] font-medium" onClick={() => document.getElementById(id)?.querySelector<HTMLButtonElement>("[aria-checked=true], button")?.focus()}>
        {label}
        {required ? <span className="text-danger-text" aria-hidden="true">*</span> : null}
      </Label>
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        tabIndex={-1}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.(); }}
        className={cn(
          "grid h-8 auto-cols-fr grid-flow-col gap-0.5 rounded-lg border border-input bg-background p-0.5 outline-none",
          error && "border-danger-fill ring-1 ring-danger-fill/20",
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
                !selected && "text-fg-secondary hover:bg-surface-1 hover:text-foreground",
                selected && option.tone === "danger" && "bg-danger-fill text-white",
                selected && option.tone === "warning" && "bg-warning-fill text-white",
                selected && (!option.tone || option.tone === "default") && "bg-primary text-primary-foreground shadow-xs",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? <p id={errorId} role="alert" className="text-[12px] font-medium text-danger-text">{error}</p> : null}
    </div>
  );
}
