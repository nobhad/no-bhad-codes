import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@react/lib/utils"

const buttonVariants = cva(
  "tw-btn",
  {
    variants: {
      variant: {
        default: "btn-primary",
        destructive: "btn-danger",
        outline: "btn-secondary",
        secondary: "btn-secondary",
        ghost: "btn-ghost",
        link: "btn-ghost tw-:underline-offset-4 tw-:hover:underline",
      },
      size: {
        default: "",
        sm: "tw-:text-sm tw-:px-3 tw-:py-1",
        lg: "tw-:text-lg tw-:px-8 tw-:py-3",
        icon: "btn-icon",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
