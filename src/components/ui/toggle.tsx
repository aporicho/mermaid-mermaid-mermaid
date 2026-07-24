"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "editor-ui-focus type-interface-control inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-[var(--ui-icon-size-button)] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent hover:bg-accent hover:text-accent-foreground",
        outline: "border-[length:var(--ui-border-width)] border-input bg-background hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "editor-ui-control min-w-[var(--ui-control-height-md)]",
        sm: "editor-ui-control-sm min-w-[var(--ui-control-height-sm)]",
        lg: "editor-ui-control min-h-[calc(var(--ui-control-height-md)+8px)] min-w-[calc(var(--ui-control-height-md)+8px)]"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
