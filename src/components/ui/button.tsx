import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "editor-ui-focus type-interface-control inline-flex items-center justify-center gap-2 whitespace-nowrap border-0 transition-colors disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:[height:var(--ui-icon-size-button)] [&_svg]:[width:var(--ui-icon-size-button)] [&_svg]:[stroke-width:var(--ui-icon-stroke-width)]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "bg-muted/55 text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "editor-ui-control",
        sm: "editor-ui-control-sm",
        lg: "editor-ui-control min-h-[calc(var(--ui-control-height-md)+8px)] px-[calc(var(--ui-control-padding-x)*1.5)]",
        icon: "editor-ui-icon-button rounded-[var(--theme-radius-control-md)]",
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
