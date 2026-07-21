"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayRegistration } from "@/lib/use-overlay-registration";
import { cn } from "@/lib/utils";

function Dialog({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen ?? false);
  const resolvedOpen = open ?? localOpen;
  useOverlayRegistration("dialog", resolvedOpen);
  return <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={(nextOpen) => { setLocalOpen(nextOpen); onOpenChange?.(nextOpen); }} {...props} />;
}

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { container?: HTMLElement | null; contained?: boolean }
>(({ className, container, contained = false, style, ...props }, ref) => (
  <DialogPrimitive.Portal container={container || undefined}>
    <DialogPrimitive.Overlay
      className={cn(contained ? "absolute" : "fixed", "inset-0 grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]")}
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        contained ? "absolute" : "fixed",
        "editor-ui-dialog left-1/2 top-1/2 max-h-[calc(100%-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-card-foreground outline-none",
        className
      )}
      style={{ zIndex: OVERLAY_Z_INDEX.modal + 1, ...style }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
      {...props}
    />
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription };
