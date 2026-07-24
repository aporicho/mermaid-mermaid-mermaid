"use client";

import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, NavArrowRight } from "iconoir-react/regular";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

function ContextMenu(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) { return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />; }
function ContextMenuTrigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) { return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />; }
function ContextMenuGroup(props: React.ComponentProps<typeof ContextMenuPrimitive.Group>) { return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />; }
function ContextMenuPortal(props: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) { return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />; }
function ContextMenuSub(props: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) { return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />; }
function ContextMenuRadioGroup(props: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) { return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />; }

const itemClass = "type-interface-menu relative flex min-h-[var(--ui-control-height-sm)] cursor-default items-center gap-[calc(var(--ui-control-gap)*.75)] rounded-md px-2 outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-[var(--ui-disabled-opacity)] data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--ui-icon-size-button)]";

const ContextMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubTrigger
    ref={ref}
    data-slot="context-menu-sub-trigger"
    className={cn(itemClass, "data-open:bg-accent data-open:text-accent-foreground", inset && "pl-8", className)}
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
      data-slot="context-menu-sub-content"
      className={cn("pointer-events-auto min-w-32 origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-lg border-[length:var(--ui-border-width)] border-border bg-popover p-1 text-popover-foreground shadow-[var(--ui-shadow-popover)] outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)}
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
        data-slot="context-menu-content"
        className={cn("pointer-events-auto max-h-(--radix-context-menu-content-available-height) min-w-32 origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border-[length:var(--ui-border-width)] border-border bg-popover p-1 text-popover-foreground shadow-[var(--ui-shadow-popover)] outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)}
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
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { inset?: boolean; variant?: "default" | "destructive" }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <ContextMenuPrimitive.Item ref={ref} data-slot="context-menu-item" data-inset={inset} data-variant={variant} className={cn(itemClass, inset && "pl-8", className)} {...props} />
));
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName;

const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem ref={ref} data-slot="context-menu-checkbox-item" checked={checked} className={cn(itemClass, "pl-8", className)} {...props}>
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
  <ContextMenuPrimitive.RadioItem ref={ref} data-slot="context-menu-radio-item" className={cn(itemClass, "pl-8", className)} {...props}>
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
  <ContextMenuPrimitive.Label data-slot="context-menu-label" className={cn("type-interface-metadata px-2 py-1.5 text-muted-foreground", inset && "pl-8", className)} ref={ref} {...props} />
));
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName;

const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator ref={ref} data-slot="context-menu-separator" className={cn("-mx-1 my-1 h-[var(--ui-divider-width)] bg-border", className)} {...props} />
));
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName;

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="context-menu-shortcut" className={cn("type-interface-technical ml-auto tracking-widest text-muted-foreground", className)} {...props} />;
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
