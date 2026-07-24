import * as React from "react";

import { cn } from "@/lib/utils";

function Marker({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)} role="status" {...props} />;
}

function MarkerContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />;
}

export { Marker, MarkerContent };
