"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const sheetVariants = cva(
  "pointer-events-auto bg-card text-card-foreground outline-none transition-transform duration-200 ease-out",
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
>(({ side, className, container, ...props }, ref) => {
  const scope = useOverlayPortalContainer(container);
  const contained = scope.kind === "workspace";
  return (
  <DialogPrimitive.Portal container={scope.portalContainer || undefined}>
    <DialogPrimitive.Overlay
      className={cn(contained ? "absolute" : "fixed", "pointer-events-auto inset-0 bg-foreground/10 backdrop-blur-[1px]")}
      style={{ zIndex: OVERLAY_Z_INDEX.modal }}
      data-overlay-layer="modal-backdrop"
      data-overlay-scope-id={scope.scopeId}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(contained ? "absolute" : "fixed", sheetVariants({ side }), className)}
      style={{ zIndex: OVERLAY_Z_INDEX.modal + 1 }}
      data-overlay-layer="sheet"
      data-overlay-scope-id={scope.scopeId}
      data-floating-panel-drag-exclude
      data-editor-floating-menu-ignore
      {...props}
    />
  </DialogPrimitive.Portal>
  );
});
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
