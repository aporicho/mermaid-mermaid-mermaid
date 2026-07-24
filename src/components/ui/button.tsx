import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button type-interface-control inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px active:opacity-[var(--ui-pressed-opacity)] disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] aria-invalid:border-destructive aria-invalid:ring-[length:var(--ui-focus-ring-width)] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--ui-icon-size-button)]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:opacity-[var(--ui-hover-opacity)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:opacity-[var(--ui-hover-opacity)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[var(--ui-control-height-md)] gap-[var(--ui-control-gap)] px-[var(--ui-control-padding-x)] has-data-[icon=inline-end]:pr-[calc(var(--ui-control-padding-x)*.8)] has-data-[icon=inline-start]:pl-[calc(var(--ui-control-padding-x)*.8)]",
        xs: "h-[calc(var(--ui-control-height-sm)-4px)] gap-[calc(var(--ui-control-gap)*.5)] rounded-[var(--theme-radius-control-sm)] px-[calc(var(--ui-control-padding-x)*.65)] text-xs in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-[calc(var(--ui-icon-size-button)*.75)]",
        sm: "h-[var(--ui-control-height-sm)] gap-[calc(var(--ui-control-gap)*.5)] rounded-[var(--theme-radius-control-sm)] px-[calc(var(--ui-control-padding-x)*.8)] text-[0.8rem] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-[calc(var(--ui-icon-size-button)*.875)]",
        lg: "h-[calc(var(--ui-control-height-md)+4px)] gap-[var(--ui-control-gap)] px-[var(--ui-control-padding-x)]",
        icon: "size-[var(--ui-icon-button-size)]",
        "icon-xs": "size-[calc(var(--ui-control-height-sm)-4px)] rounded-[var(--theme-radius-control-sm)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-[calc(var(--ui-icon-size-button)*.75)]",
        "icon-sm": "size-[var(--ui-control-height-sm)] rounded-[var(--theme-radius-control-sm)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-[calc(var(--ui-icon-size-button)*.875)]",
        "icon-lg": "size-[calc(var(--ui-control-height-md)+4px)]",
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
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
