import { forwardRef, type HTMLAttributes } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const EditorToolbar = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }>(function EditorToolbar({ className, orientation = "horizontal", ...props }, ref) {
  return <div ref={ref} role="toolbar" aria-orientation={orientation} className={cn("editor-ui-toolbar", orientation === "vertical" && "flex-col", className)} {...props} />;
});

export function EditorToolbarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="group" className={cn("flex items-center gap-[calc(var(--ui-control-gap)*.5)]", className)} {...props} />;
}

export function EditorSegmentedControl({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-1 rounded-[var(--theme-radius-control-md)] bg-muted p-1", className)} {...props} />;
}

export function EditorSegmentedControlItem({ active, className, ...props }: ButtonProps & { active: boolean }) {
  return <Button variant={active ? "secondary" : "ghost"} size="sm" className={cn("flex-1", className)} aria-pressed={active} {...props} />;
}
