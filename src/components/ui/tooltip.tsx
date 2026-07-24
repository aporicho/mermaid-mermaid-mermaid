"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, style, ...props }, ref) => {
  const { portalContainer, scopeId } = useOverlayPortalContainer()
  return (
  <TooltipPrimitive.Portal container={portalContainer || undefined}>
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    style={{ zIndex: OVERLAY_Z_INDEX.tooltip, ...style }}
    className={cn(
      "editor-ui-popover pointer-events-auto type-interface-tooltip overflow-hidden px-3 py-1.5 text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
      className
    )}
    data-overlay-layer="tooltip"
    data-overlay-scope-id={scopeId}
    {...props}
  />
  </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
