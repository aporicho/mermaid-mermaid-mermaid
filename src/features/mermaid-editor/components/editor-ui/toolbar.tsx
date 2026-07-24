import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const EditorToolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }>(function EditorToolbar({ className, orientation = "horizontal", ...props }, ref) {
  return <div ref={ref} role="toolbar" aria-orientation={orientation} className={cn("editor-ui-toolbar", orientation === "vertical" && "flex-col", className)} {...props} />;
});

export function EditorToolbarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="group" className={cn("flex items-center gap-[calc(var(--ui-control-gap)*.5)]", className)} {...props} />;
}
