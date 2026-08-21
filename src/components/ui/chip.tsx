import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const chipVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1.5 rounded-full font-medium transition-colors border border-transparent whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border-border text-foreground hover:bg-surface-2",
        ghost: "hover:bg-surface-2 hover:text-foreground",
        danger: "bg-danger-bg text-danger-text",
        warning: "bg-warning-bg text-warning-text",
        success: "bg-success-bg text-success-text",
        clinical: "bg-clinical-bg text-clinical-text",
        neutral: "bg-neutral-bg text-neutral-text",
        info: "bg-info-bg text-info-text",
      },
      size: {
        sm: "px-2 py-[2px] text-[10px]",
        default: "px-2.5 py-[3px] text-xs",
        lg: "px-3 py-1 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {
  icon?: React.ReactNode
}

function Chip({ className, variant, size, icon, children, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant, size }), className)} {...props}>
      {icon && <span className="shrink-0 [&>svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  )
}

export { Chip, chipVariants }
