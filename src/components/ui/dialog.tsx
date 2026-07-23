"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { container?: HTMLElement | null; contained?: boolean }
>(({ className, container, contained = false, style, ...props }, ref) => {
  const scope = useOverlayPortalContainer(container);
  const resolvedContained = contained || scope.kind === "workspace";
  return (
  <DialogPrimitive.Portal container={scope.portalContainer || undefined}>
    <DialogPrimitive.Overlay
      className={cn(resolvedContained ? "absolute" : "fixed", "pointer-events-auto inset-0 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]")}
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      data-overlay-layer="modal-backdrop"
      data-overlay-scope-id={scope.scopeId}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        resolvedContained ? "absolute" : "fixed",
        "editor-ui-dialog pointer-events-auto left-1/2 top-1/2 max-h-[calc(100%-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-card-foreground outline-none",
        className
      )}
      style={{ zIndex: OVERLAY_Z_INDEX.modal + 1, ...style }}
      data-overlay-layer="modal"
      data-overlay-scope-id={scope.scopeId}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
      {...props}
    />
  </DialogPrimitive.Portal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
