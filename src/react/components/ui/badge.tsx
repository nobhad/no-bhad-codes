import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@react/lib/utils"

const badgeVariants = cva(
  "tw-badge",
  {
    variants: {
      variant: {
        default: "",
        secondary: "tw-:opacity-70",
        destructive: "",
        outline: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
