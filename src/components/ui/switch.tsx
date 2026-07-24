"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { size?: "sm" | "default" }>(
  ({ className, size = "default", ...props }, ref) => (
    <SwitchPrimitive.Root ref={ref} data-slot="switch" data-size={size} className={cn("peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-ring/50 data-[size=default]:h-[calc(var(--ui-icon-button-size)*.575)] data-[size=default]:w-[var(--ui-icon-button-size)] data-[size=sm]:h-[calc(var(--ui-icon-size-button)*.875)] data-[size=sm]:w-[calc(var(--ui-icon-size-button)*1.5)] data-checked:bg-primary data-unchecked:bg-input data-disabled:cursor-not-allowed data-disabled:opacity-[var(--ui-disabled-opacity)] dark:data-unchecked:bg-input/80", className)} {...props}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-[var(--ui-icon-size-button)] group-data-[size=sm]/switch:size-[calc(var(--ui-icon-size-button)*.75)] group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground" />
    </SwitchPrimitive.Root>
  )
)
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
