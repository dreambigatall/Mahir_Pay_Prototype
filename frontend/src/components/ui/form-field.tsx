import * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  labelClassName,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  labelClassName?: string
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  const field = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  })

  return (
    <div className={cn("grid gap-1.5", className)} data-slot="form-field">
      <Label htmlFor={id} className={cn("text-[13px] font-medium", labelClassName)}>
        {label}
        {required ? (
          <span className="text-danger-text" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {field}
      {hint && !error ? (
        <p id={hintId} className="text-[12px] text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] font-medium text-danger-text">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function FormGroup({
  eyebrow,
  hint,
  className,
  children,
}: {
  eyebrow: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("border-l-2 border-border pl-4", className)} data-slot="form-group">
      <p className="text-[11px] font-semibold tracking-wide text-fg-secondary uppercase">{eyebrow}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-fg-muted">{hint}</p> : null}
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  )
}

export { FormField, FormGroup }
