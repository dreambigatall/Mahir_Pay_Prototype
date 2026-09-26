import * as React from "react"
import { AlertCircle } from "lucide-react"

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

/**
 * Red banner at the top of a form listing what needs fixing.
 * Each item jumps to its field. Shown only after a submit attempt or a server error.
 */
function FormErrorSummary({
  message,
  items = [],
  labels = {},
  idFor,
  className,
}: {
  message?: string
  items?: Array<{ name: string; message: string }>
  labels?: Record<string, string>
  idFor?: (name: string) => string
  className?: string
}) {
  if (!message && items.length === 0) return null
  return (
    <div
      role="alert"
      className={cn("rounded-lg border border-danger-fill/40 bg-danger-fill/10 px-3 py-2.5 text-[13px] text-danger-text", className)}
      data-slot="form-error-summary"
    >
      <p className="flex items-center gap-2 font-medium">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        {message ?? (items.length === 1 ? "1 field needs your attention" : `${items.length} fields need your attention`)}
      </p>
      {items.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-6">
          {items.map((item) => {
            // Field name only when we have one — the full message is already shown under the field.
            const text = labels[item.name] ?? item.message
            return (
              <li key={item.name}>
                {idFor ? (
                  <button
                    type="button"
                    title={item.message}
                    className="rounded-full border border-danger-fill/30 bg-background px-2 py-0.5 text-[12px] font-medium transition-colors hover:border-danger-fill hover:bg-danger-fill/5"
                    onClick={() => document.getElementById(idFor(item.name))?.focus()}
                  >
                    {text}
                  </button>
                ) : (
                  <span className="rounded-full border border-danger-fill/30 bg-background px-2 py-0.5 text-[12px] font-medium">{text}</span>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export { FormErrorSummary, FormField, FormGroup }
