"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => {
  const { portalContainer, scopeId } = useOverlayPortalContainer()
  return (
  <PopoverPrimitive.Portal container={portalContainer || undefined}>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      data-window-drag-exclude
      data-editor-floating-menu-ignore
      className={cn(
        "editor-ui-popover pointer-events-auto w-72 p-0 text-popover-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }}
      data-overlay-layer="popover"
      data-overlay-scope-id={scopeId}
      {...props}
    />
  </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
