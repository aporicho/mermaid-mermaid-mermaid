"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Xmark } from "iconoir-react/regular"

import { Button } from "@/components/ui/button"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { cn } from "@/lib/utils"

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) { return <DialogPrimitive.Root data-slot="sheet" {...props} /> }
function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) { return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} /> }
function SheetClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) { return <DialogPrimitive.Close data-slot="sheet-close" {...props} /> }
function SheetPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) { return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} /> }

const SheetOverlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { contained?: boolean }>(
  ({ className, contained = false, style, ...props }, ref) => <DialogPrimitive.Overlay ref={ref} data-slot="sheet-overlay" className={cn(contained ? "absolute" : "fixed", "pointer-events-auto inset-0 bg-[hsl(var(--ui-overlay-background)/var(--ui-overlay-opacity))] duration-100 [backdrop-filter:blur(var(--ui-overlay-backdrop-blur))] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0", className)} style={{ zIndex: OVERLAY_Z_INDEX.modal, ...style }} data-overlay-layer="modal-backdrop" data-floating-panel-drag-exclude data-editor-floating-menu-ignore {...props} />
)
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const SheetContent = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "top" | "right" | "bottom" | "left"; container?: HTMLElement | null; showCloseButton?: boolean }>(
  ({ side = "right", className, container, showCloseButton = true, children, style, ...props }, ref) => {
    const scope = useOverlayPortalContainer(container)
    const contained = scope.kind === "workspace"
    return (
      <DialogPrimitive.Portal data-slot="sheet-portal" container={scope.portalContainer || undefined}>
        <SheetOverlay contained={contained} data-overlay-scope-id={scope.scopeId} />
        <DialogPrimitive.Content ref={ref} data-slot="sheet-content" data-side={side} className={cn(contained ? "absolute" : "fixed", "type-interface-body pointer-events-auto flex flex-col gap-4 bg-popover bg-clip-padding text-popover-foreground shadow-[var(--ui-shadow-dialog)] transition duration-200 ease-in-out outline-none data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10", className)} style={{ ...style, zIndex: OVERLAY_Z_INDEX.modal + 1 }} data-overlay-layer="sheet" data-overlay-scope-id={scope.scopeId} data-floating-panel-drag-exclude data-editor-floating-menu-ignore {...props}>
          {children}
          {showCloseButton && <DialogPrimitive.Close data-slot="sheet-close" asChild><Button variant="ghost" className="absolute right-3 top-3" size="icon-sm"><Xmark aria-hidden data-icon="inline-start" /><span className="sr-only">关闭</span></Button></DialogPrimitive.Close>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    )
  }
)
SheetContent.displayName = DialogPrimitive.Content.displayName

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} /> }
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} /> }

const SheetTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} data-slot="sheet-title" className={cn("type-interface-heading text-foreground", className)} {...props} />
)
SheetTitle.displayName = DialogPrimitive.Title.displayName
const SheetDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} data-slot="sheet-description" className={cn("type-interface-body text-muted-foreground", className)} {...props} />
)
SheetDescription.displayName = DialogPrimitive.Description.displayName

export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
