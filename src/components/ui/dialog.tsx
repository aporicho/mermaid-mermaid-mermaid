"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Xmark } from "iconoir-react/regular"

import { Button } from "@/components/ui/button"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { cn } from "@/lib/utils"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & { contained?: boolean }
>(({ className, contained = false, style, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      contained ? "absolute" : "fixed",
      "pointer-events-auto inset-0 isolate bg-[hsl(var(--ui-overlay-background)/var(--ui-overlay-opacity))] duration-100 [backdrop-filter:blur(var(--ui-overlay-backdrop-blur))] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className
    )}
    style={{ zIndex: OVERLAY_Z_INDEX.modal, ...style }}
    data-overlay-layer="modal-backdrop"
    data-floating-panel-drag-exclude
    data-editor-floating-menu-ignore
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    container?: HTMLElement | null
    contained?: boolean
    showCloseButton?: boolean
  }
>(({ className, container, contained = false, showCloseButton = true, children, style, ...props }, ref) => {
  const scope = useOverlayPortalContainer(container)
  const resolvedContained = contained || scope.kind === "workspace"

  return (
    <DialogPrimitive.Portal container={scope.portalContainer || undefined}>
      <DialogOverlay contained={resolvedContained} data-overlay-scope-id={scope.scopeId} />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          resolvedContained ? "absolute" : "fixed",
          "pointer-events-auto left-1/2 top-1/2 grid max-h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl border-[length:var(--ui-border-width)] border-border bg-popover p-4 text-popover-foreground shadow-[var(--ui-shadow-dialog)] duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        style={{ zIndex: OVERLAY_Z_INDEX.modal + 1, ...style }}
        data-overlay-layer="modal"
        data-overlay-scope-id={scope.scopeId}
        data-floating-panel-drag-exclude
        data-editor-floating-menu-ignore
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute right-2 top-2" size="icon-sm">
              <Xmark aria-hidden data-icon="inline-start" />
              <span className="sr-only">关闭</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
}

function DialogFooter({ className, showCloseButton = false, children, ...props }: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  return (
    <div data-slot="dialog-footer" className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", className)} {...props}>
      {children}
      {showCloseButton && <DialogPrimitive.Close asChild><Button variant="outline">关闭</Button></DialogPrimitive.Close>}
    </div>
  )
}

const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} data-slot="dialog-title" className={cn("font-heading text-base leading-none font-medium", className)} {...props} />
)
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} data-slot="dialog-description" className={cn("text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground", className)} {...props} />
)
DialogDescription.displayName = DialogPrimitive.Description.displayName

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
