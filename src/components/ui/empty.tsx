import * as React from "react";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center", className)} {...props} />;
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-md flex-col items-center gap-1.5", className)} {...props} />;
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid size-10 place-items-center rounded-[var(--theme-radius-control-lg)] bg-muted text-muted-foreground", className)} {...props} />;
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("type-interface-heading text-foreground", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("type-interface-metadata text-muted-foreground", className)} {...props} />;
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-md flex-wrap items-center justify-center gap-2", className)} {...props} />;
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
