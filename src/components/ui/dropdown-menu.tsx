"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, NavArrowRight } from "iconoir-react/regular";

import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";
import { useOverlayRegistration } from "@/lib/use-overlay-registration";
import { cn } from "@/lib/utils";

function DropdownMenu({ open, defaultOpen, onOpenChange, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [localOpen, setLocalOpen] = React.useState(defaultOpen ?? false);
  const resolvedOpen = open ?? localOpen;
  useOverlayRegistration("dropdown-menu", resolvedOpen);
  return <DropdownMenuPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={(nextOpen) => { setLocalOpen(nextOpen); onOpenChange?.(nextOpen); }} {...props} />;
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Content>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>>(
  ({ className, sideOffset = 6, style, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn("editor-ui-popover min-w-48 p-1 text-popover-foreground outline-none", className)} style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }} data-window-drag-exclude data-editor-floating-menu-ignore {...props} />
    </DropdownMenuPrimitive.Portal>
  )
);
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const itemClass = "editor-ui-focus type-interface-menu relative flex min-h-[var(--ui-control-height-sm)] cursor-default select-none items-center gap-2 rounded-[var(--theme-radius-control-sm)] px-2 outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-[var(--ui-disabled-opacity)] [&_svg]:shrink-0 [&_svg]:text-icon";

const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Item>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => <DropdownMenuPrimitive.Item ref={ref} className={cn(itemClass, inset && "pl-8", className)} {...props} />
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>>(
  ({ className, children, checked, ...props }, ref) => (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} checked={checked} className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 grid size-4 place-items-center"><DropdownMenuPrimitive.ItemIndicator><Check className="size-4" /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
);
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>>(
  ({ className, children, ...props }, ref) => (
    <DropdownMenuPrimitive.RadioItem ref={ref} className={cn(itemClass, "pl-8", className)} {...props}>
      <span className="absolute left-2 grid size-4 place-items-center"><DropdownMenuPrimitive.ItemIndicator><span className="size-1.5 rounded-full bg-current" /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
);
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Label>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => <DropdownMenuPrimitive.Label ref={ref} className={cn("type-interface-metadata px-2 py-1.5 text-muted-foreground", inset && "pl-8", className)} {...props} />
);
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>>(
  ({ className, ...props }, ref) => <DropdownMenuPrimitive.Separator ref={ref} className={cn("my-1 h-[var(--ui-divider-width)] bg-border", className)} {...props} />
);
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuSubTrigger = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }>(
  ({ className, inset, children, ...props }, ref) => <DropdownMenuPrimitive.SubTrigger ref={ref} className={cn(itemClass, inset && "pl-8", className)} {...props}>{children}<NavArrowRight className="ml-auto size-4" /></DropdownMenuPrimitive.SubTrigger>
);
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.SubContent>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>>(
  ({ className, style, ...props }, ref) => <DropdownMenuPrimitive.SubContent ref={ref} className={cn("editor-ui-popover min-w-40 p-1 text-popover-foreground outline-none", className)} style={{ zIndex: OVERLAY_Z_INDEX.dropdown, ...style }} {...props} />
);
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup };
