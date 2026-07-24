"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, type = "scroll", scrollHideDelay = 700, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    data-slot="scroll-area"
    className={cn("relative overflow-hidden", className)}
    type={type}
    scrollHideDelay={scrollHideDelay}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="h-full w-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:ring-[length:var(--ui-focus-ring-width)] focus-visible:ring-ring/50">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    data-slot="scroll-area-scrollbar"
    orientation={orientation}
    className={cn(
      "group flex touch-none select-none p-[var(--ui-scrollbar-inset)] transition-colors",
      orientation === "vertical" &&
        "h-full w-[var(--ui-scrollbar-size)] border-l border-l-transparent",
      orientation === "horizontal" &&
        "h-[var(--ui-scrollbar-size)] flex-col border-t border-t-transparent",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb data-slot="scroll-area-thumb" className="relative flex-1 rounded-[var(--ui-scrollbar-radius)] bg-[hsl(var(--muted-foreground)/var(--ui-scrollbar-opacity))] transition-colors group-hover:bg-[hsl(var(--muted-foreground)/var(--ui-scrollbar-hover-opacity))] active:bg-[hsl(var(--foreground)/var(--ui-scrollbar-active-opacity))]" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
