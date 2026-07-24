"use client"

import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import type { VariantProps } from "class-variance-authority"

import { buttonVariants } from "@/components/ui/button"
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context"
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers"
import { cn } from "@/lib/utils"

function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}
function AlertDialogTrigger(props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}
function AlertDialogPortal(props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

const AlertDialogOverlay = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & { contained?: boolean }>(
  ({ className, contained = false, style, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay ref={ref} data-slot="alert-dialog-overlay" className={cn(contained ? "absolute" : "fixed", "pointer-events-auto inset-0 bg-[hsl(var(--ui-overlay-background)/var(--ui-overlay-opacity))] duration-100 [backdrop-filter:blur(var(--ui-overlay-backdrop-blur))] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0", className)} style={{ zIndex: OVERLAY_Z_INDEX.modal, ...style }} data-overlay-layer="modal-backdrop" data-floating-panel-drag-exclude data-editor-floating-menu-ignore {...props} />
  )
)
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Content>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { container?: HTMLElement | null; contained?: boolean; size?: "default" | "sm" }>(
  ({ className, container, contained = false, size = "default", style, ...props }, ref) => {
    const scope = useOverlayPortalContainer(container)
    const resolvedContained = contained || scope.kind === "workspace"
    return (
      <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" container={scope.portalContainer || undefined}>
        <AlertDialogOverlay contained={resolvedContained} data-overlay-scope-id={scope.scopeId} />
        <AlertDialogPrimitive.Content ref={ref} data-slot="alert-dialog-content" data-size={size} className={cn(resolvedContained ? "absolute" : "fixed", "group/alert-dialog-content type-interface-body pointer-events-auto left-1/2 top-1/2 grid max-h-[calc(100%-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl border-[length:var(--ui-border-width)] border-border bg-popover p-4 text-popover-foreground shadow-[var(--ui-shadow-dialog)] duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)} style={{ zIndex: OVERLAY_Z_INDEX.modal + 1, ...style }} data-overlay-layer="alert-dialog" data-overlay-scope-id={scope.scopeId} data-floating-panel-drag-exclude data-editor-floating-menu-ignore {...props} />
      </AlertDialogPrimitive.Portal>
    )
  }
)
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left", className)} {...props} />
}
function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-footer" className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end", className)} {...props} />
}
function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-media" className={cn("mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-6", className)} {...props} />
}

const AlertDialogTitle = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <AlertDialogPrimitive.Title ref={ref} data-slot="alert-dialog-title" className={cn("type-interface-heading sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2", className)} {...props} />
)
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>>(
  ({ className, ...props }, ref) => <AlertDialogPrimitive.Description ref={ref} data-slot="alert-dialog-description" className={cn("type-interface-body text-balance text-muted-foreground md:text-pretty *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground", className)} {...props} />
)
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Action>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & VariantProps<typeof buttonVariants>>(
  ({ className, variant, size, ...props }, ref) => <AlertDialogPrimitive.Action ref={ref} data-slot="alert-dialog-action" className={cn(buttonVariants({ variant, size }), className)} {...props} />
)
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Cancel>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> & VariantProps<typeof buttonVariants>>(
  ({ className, variant = "outline", size, ...props }, ref) => <AlertDialogPrimitive.Cancel ref={ref} data-slot="alert-dialog-cancel" className={cn(buttonVariants({ variant, size }), className)} {...props} />
)
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger }
