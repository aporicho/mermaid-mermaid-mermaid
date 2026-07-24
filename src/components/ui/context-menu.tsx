"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, NavArrowRight } from "iconoir-react/regular";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const itemClass = "editor-ui-focus type-interface-menu relative flex min-h-[var(--ui-control-height-sm)] cursor-default select-none items-center gap-2 rounded-[var(--theme-radius-control-sm)] px-2 outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--ui-disabled-opacity)] [&_svg]:size-[var(--ui-icon-size-button)] [&_svg]:shrink-0 [&_svg]:text-icon";

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(itemClass, "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground", inset && "pl-8", className)}
    {...props}
  >
    {children}
    <NavArrowRight aria-hidden className="ml-auto" />
  </ContextMenuPrimitive.SubTrigger>
));
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName;

const ContextMenuSubContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, style, ...props }, ref) => {
  const { scopeId } = useOverlayPortalContainer();
  return (
    <ContextMenuPrimitive.SubContent
      ref={ref}
      className={cn("editor-ui-popover pointer-events-auto min-w-40 p-1 text-popover-foreground outline-none", className)}
      style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }}
      data-overlay-layer="context-menu"
      data-overlay-scope-id={scopeId}
      data-window-drag-exclude
      data-editor-floating-menu-ignore
      {...props}
    />
  );
});
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName;

const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, style, ...props }, ref) => {
  const { portalContainer, scopeId } = useOverlayPortalContainer();
  return (
    <ContextMenuPrimitive.Portal container={portalContainer || undefined}>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={cn("editor-ui-popover pointer-events-auto max-h-[--radix-context-menu-content-available-height] min-w-48 overflow-y-auto overflow-x-hidden p-1 text-popover-foreground outline-none", className)}
        style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }}
        data-overlay-layer="context-menu"
        data-overlay-scope-id={scopeId}
        data-window-drag-exclude
        data-editor-floating-menu-ignore
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
});
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName;

const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} className={cn(itemClass, inset && "pl-8", className)} {...props} />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem ref={ref} checked={checked} className={cn(itemClass, "pl-8", className)} {...props}>
    <span className="absolute left-2 grid size-[var(--ui-icon-size-button)] place-items-center">
      <ContextMenuPrimitive.ItemIndicator><Check aria-hidden /></ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName;

const ContextMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, "pl-8", className)} {...props}>
    <span className="absolute left-2 grid size-[var(--ui-icon-size-button)] place-items-center">
      <ContextMenuPrimitive.ItemIndicator><span className="size-1.5 rounded-full bg-current" /></ContextMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName;

const ContextMenuLabel = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Label className={cn("type-interface-metadata px-2 py-1.5 text-muted-foreground", inset && "pl-8", className)} ref={ref} {...props} />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} className={cn("my-1 h-[var(--ui-divider-width)] bg-border", className)} {...props} />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("type-interface-technical ml-auto text-muted-foreground", className)} {...props} />;
}
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
};
