"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & { contained?: boolean }
>(({ className, contained = false, style, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(contained ? "absolute" : "fixed", "pointer-events-auto inset-0 bg-[hsl(var(--ui-overlay-background)/var(--ui-overlay-opacity))] [backdrop-filter:blur(var(--ui-overlay-backdrop-blur))]", className)}
    style={{ zIndex: OVERLAY_Z_INDEX.modal, ...style }}
    data-overlay-layer="modal-backdrop"
    data-floating-panel-drag-exclude
    data-editor-floating-menu-ignore
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { container?: HTMLElement | null; contained?: boolean }
>(({ className, container, contained = false, style, ...props }, ref) => {
  const scope = useOverlayPortalContainer(container);
  const resolvedContained = contained || scope.kind === "workspace";
  return (
    <AlertDialogPrimitive.Portal container={scope.portalContainer || undefined}>
      <AlertDialogOverlay contained={resolvedContained} data-overlay-scope-id={scope.scopeId} />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          resolvedContained ? "absolute" : "fixed",
          "editor-ui-dialog pointer-events-auto left-1/2 top-1/2 grid max-h-[calc(100%-32px)] w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 gap-[var(--theme-panel-padding)] overflow-hidden p-[var(--theme-panel-padding)] text-card-foreground outline-none",
          className
        )}
        style={{ zIndex: OVERLAY_Z_INDEX.modal + 1, ...style }}
        data-overlay-layer="alert-dialog"
        data-overlay-scope-id={scope.scopeId}
        data-floating-panel-drag-exclude
        data-editor-floating-menu-ignore
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 text-left", className)} {...props} />;
}
AlertDialogHeader.displayName = "AlertDialogHeader";

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center justify-end gap-[var(--ui-control-gap)]", className)} {...props} />;
}
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => <AlertDialogPrimitive.Title ref={ref} className={cn("type-interface-heading", className)} {...props} />);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => <AlertDialogPrimitive.Description ref={ref} className={cn("type-interface-body text-muted-foreground", className)} {...props} />);
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> & VariantProps<typeof buttonVariants>
>(({ className, variant = "ghost", size, ...props }, ref) => <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />);
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger
};
