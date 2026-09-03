import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-fg-muted hover:border-border-strong focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-clinical-bg disabled:cursor-not-allowed disabled:bg-surface-1 disabled:text-fg-disabled aria-invalid:border-danger-fill aria-invalid:ring-1 aria-invalid:ring-danger-bg md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
