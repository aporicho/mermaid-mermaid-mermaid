"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, NavArrowRight } from "iconoir-react/regular";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayPortalContainer } from "@/lib/overlay-layer-context";
import { cn } from "@/lib/utils";

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) { return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />; }
function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) { return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />; }
function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) { return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />; }
function DropdownMenuPortal(props: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) { return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />; }
function DropdownMenuSub(props: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) { return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />; }
function DropdownMenuRadioGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) { return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />; }

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  ({ className, sideOffset = 6, style, ...props }, ref) => {
    const { portalContainer, scopeId } = useOverlayPortalContainer();
    return (
    <DropdownMenuPrimitive.Portal container={portalContainer || undefined}>
      <DropdownMenuPrimitive.Content ref={ref} data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn("pointer-events-auto max-h-(--radix-dropdown-menu-content-available-height) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border-[length:var(--ui-border-width)] border-border bg-popover p-1 text-popover-foreground shadow-[var(--ui-shadow-popover)] outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)} style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }} data-overlay-layer="dropdown" data-overlay-scope-id={scopeId} data-window-drag-exclude data-editor-floating-menu-ignore {...props} />
    </DropdownMenuPrimitive.Portal>
    );
  }
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const itemClass = "type-interface-menu relative flex min-h-[var(--ui-control-height-sm)] cursor-default items-center gap-[calc(var(--ui-control-gap)*.75)] rounded-md px-2 outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-[var(--ui-disabled-opacity)] data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--ui-icon-size-button)]";

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; variant?: "default" | "destructive" }>(
  ({ className, inset, variant = "default", ...props }, ref) => <DropdownMenuPrimitive.Item ref={ref} data-slot="dropdown-menu-item" data-inset={inset} data-variant={variant} className={cn(itemClass, inset && "pl-8", className)} {...props} />
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>>(
  ({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} data-slot="dropdown-menu-checkbox-item" checked={checked} className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 grid size-[var(--ui-icon-size-button)] place-items-center"><DropdownMenuPrimitive.ItemIndicator><Check /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem ref={ref} data-slot="dropdown-menu-radio-item" className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 grid size-4 place-items-center"><DropdownMenuPrimitive.ItemIndicator><span className="size-1.5 rounded-full bg-current" /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
);
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => <DropdownMenuPrimitive.Label ref={ref} data-slot="dropdown-menu-label" className={cn("type-interface-metadata px-2 py-1.5 text-muted-foreground", inset && "pl-8", className)} {...props} />
);
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-[var(--ui-divider-width)] bg-border", className)} {...props} />
);
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuSubTrigger = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => <DropdownMenuPrimitive.SubTrigger ref={ref} data-slot="dropdown-menu-sub-trigger" className={cn(itemClass, "data-open:bg-accent data-open:text-accent-foreground", inset && "pl-8", className)} {...props}>{children}<NavArrowRight className="ml-auto" /></DropdownMenuPrimitive.SubTrigger>
);
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.SubContent>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>>(
  ({ className, style, ...props }, ref) => {
    const { scopeId } = useOverlayPortalContainer();
    return <DropdownMenuPrimitive.SubContent ref={ref} data-slot="dropdown-menu-sub-content" className={cn("pointer-events-auto min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg border-[length:var(--ui-border-width)] border-border bg-popover p-1 text-popover-foreground shadow-[var(--ui-shadow-popover)] outline-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)} style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }} data-overlay-layer="dropdown" data-overlay-scope-id={scopeId} {...props} />;
  }
);
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) { return <span data-slot="dropdown-menu-shortcut" className={cn("type-interface-technical ml-auto tracking-widest text-muted-foreground", className)} {...props} />; }

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuShortcut };
