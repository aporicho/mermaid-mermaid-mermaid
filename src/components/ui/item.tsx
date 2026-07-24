import * as React from "react";

import { cn } from "@/lib/utils";

function Item({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item" className={cn("group/item flex min-w-0 items-center gap-3 rounded-lg px-3 py-2", className)} {...props} />;
}

function ItemMedia({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-media" className={cn("flex shrink-0 items-center justify-center text-muted-foreground", className)} {...props} />;
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-content" className={cn("min-w-0 flex-1", className)} {...props} />;
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-title" className={cn("truncate text-sm font-medium", className)} {...props} />;
}

function ItemDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-description" className={cn("truncate text-xs text-muted-foreground", className)} {...props} />;
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("ml-auto flex shrink-0 items-center gap-1", className)} {...props} />;
}

export { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle };
