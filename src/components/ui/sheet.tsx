"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayRegistration } from "@/lib/use-overlay-registration";
import { cn } from "@/lib/utils";

function Sheet({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen ?? false);
  const resolvedOpen = open ?? localOpen;
  useOverlayRegistration("dialog", resolvedOpen);
  return <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={(next) => { setLocalOpen(next); onOpenChange?.(next); }} {...props} />;
}

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const sheetVariants = cva(
  "fixed bg-card text-card-foreground outline-none transition-transform duration-200 ease-out",
  {
    variants: {
      side: {
        left: "inset-y-0 left-0 h-full border-r data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
        right: "inset-y-0 right-0 h-full border-l data-[state=closed]:translate-x-full data-[state=open]:translate-x-0",
        top: "inset-x-0 top-0 w-full border-b data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0",
        bottom: "inset-x-0 bottom-0 w-full border-t data-[state=closed]:translate-y-full data-[state=open]:translate-y-0"
      }
    },
    defaultVariants: { side: "right" }
  }
);

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & VariantProps<typeof sheetVariants> & { container?: HTMLElement | null }
>(({ side, className, container, ...props }, ref) => (
  <DialogPrimitive.Portal container={container || undefined}>
    <DialogPrimitive.Overlay
      className="fixed inset-0 bg-foreground/10 backdrop-blur-[1px]"
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      style={{ zIndex: OVERLAY_Z_INDEX.modal + 1 }}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
      {...props}
    />
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
