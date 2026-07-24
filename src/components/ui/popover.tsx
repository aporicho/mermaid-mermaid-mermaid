"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}
function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}
function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => {
  const { portalContainer, scopeId } = useOverlayPortalContainer()
  return (
  <PopoverPrimitive.Portal container={portalContainer || undefined}>
    <PopoverPrimitive.Content
      ref={ref}
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      data-window-drag-exclude
      data-editor-floating-menu-ignore
      className={cn(
        "pointer-events-auto w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border-[length:var(--ui-border-width)] border-border bg-popover p-4 text-popover-foreground shadow-[var(--ui-shadow-popover)] outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
