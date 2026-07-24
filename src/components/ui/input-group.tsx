import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex min-h-[var(--ui-control-height-md)] w-full min-w-0 items-center rounded-lg border-[length:var(--ui-border-width)] border-input bg-transparent outline-none transition-[color,box-shadow] has-disabled:bg-input/50 has-disabled:opacity-[var(--ui-disabled-opacity)] has-[>textarea]:h-auto dark:bg-input/30 dark:has-disabled:bg-input/80",
        "has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
        "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[length:var(--ui-focus-ring-width)] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
        "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-[length:var(--ui-focus-ring-width)] has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "type-interface-control flex h-auto cursor-text select-none items-center justify-center gap-2 py-[var(--ui-control-padding-y)] text-muted-foreground group-data-[disabled=true]/input-group:opacity-[var(--ui-disabled-opacity)] [&_svg]:size-[var(--ui-icon-size-button)]",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-[var(--ui-control-padding-x)]",
        "inline-end": "order-last pr-[var(--ui-control-padding-x)]",
        "block-start": "order-first w-full justify-start px-[var(--ui-control-padding-x)] pt-[var(--ui-control-padding-y)]",
        "block-end": "order-last w-full justify-start px-[var(--ui-control-padding-x)] pb-[var(--ui-control-padding-y)]"
      }
    },
    defaultVariants: { align: "inline-start" }
  }
);

function InputGroupAddon({ className, align = "inline-start", ...props }: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        event.currentTarget.parentElement?.querySelector<HTMLElement>("input, textarea")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva("flex items-center gap-2 shadow-none", {
  variants: {
    size: {
      xs: "min-h-[calc(var(--ui-control-height-sm)-4px)] px-2",
      sm: "min-h-[var(--ui-control-height-sm)] px-2.5",
      "icon-xs": "size-[calc(var(--ui-control-height-sm)-4px)] p-0",
      "icon-sm": "size-[var(--ui-control-height-sm)] p-0"
    }
  },
  defaultVariants: { size: "xs" }
});

function InputGroupButton({ className, type = "button", variant = "ghost", size = "xs", ...props }: Omit<React.ComponentProps<typeof Button>, "size"> & VariantProps<typeof inputGroupButtonVariants>) {
  return <Button type={type} data-size={size} variant={variant} className={cn(inputGroupButtonVariants({ size }), className)} {...props} />;
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="input-group-text" className={cn("type-interface-control flex items-center gap-2 text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-[var(--ui-icon-size-button)]", className)} {...props} />;
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return <Input data-slot="input-group-control" className={cn("min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent", className)} {...props} />;
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <Textarea data-slot="input-group-control" className={cn("flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent", className)} {...props} />;
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea };
