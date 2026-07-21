"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { useOverlayRegistration } from "@/lib/use-overlay-registration"

function Popover({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen ?? false)
  const resolvedOpen = open ?? localOpen
  useOverlayRegistration("popover", resolvedOpen)

  return <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={(nextOpen) => { setLocalOpen(nextOpen); onOpenChange?.(nextOpen) }} {...props} />
}
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      data-window-drag-exclude
      data-editor-floating-menu-ignore
      className={cn(
        "editor-ui-popover w-72 p-0 text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
