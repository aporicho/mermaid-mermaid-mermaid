"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "group/toggle type-interface-control inline-flex items-center justify-center gap-[calc(var(--ui-control-gap)*.5)] rounded-lg whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-ring/50 active:opacity-[var(--ui-pressed-opacity)] disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] aria-pressed:bg-muted data-[state=on]:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--ui-icon-size-button)]",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-[length:var(--ui-border-width)] border-input bg-transparent hover:bg-muted"
      },
      size: {
        default: "h-[var(--ui-control-height-md)] min-w-[var(--ui-control-height-md)] px-[var(--ui-control-padding-x)]",
        sm: "h-[var(--ui-control-height-sm)] min-w-[var(--ui-control-height-sm)] rounded-[var(--theme-radius-control-sm)] px-[calc(var(--ui-control-padding-x)*.8)] [&_svg:not([class*='size-'])]:size-[calc(var(--ui-icon-size-button)*.875)]",
        lg: "h-[calc(var(--ui-control-height-md)+4px)] min-w-[calc(var(--ui-control-height-md)+4px)] px-[var(--ui-control-padding-x)]"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant = "default", size = "default", ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} data-slot="toggle" data-variant={variant} data-size={size} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
