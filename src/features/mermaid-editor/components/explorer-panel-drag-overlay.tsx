import { forwardRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export const ExplorerDragOverlay = forwardRef<HTMLDivElement, {
  icon: ReactNode;
  label: string;
  count: number;
  width?: number;
  height?: number;
}>(function ExplorerDragOverlay({ icon, label, count, width, height }, ref) {
  const overlay = (
    <div
      ref={ref}
      data-project-resource-drag-overlay
      className={cn(
        "type-interface-tree pointer-events-none fixed left-0 top-0 z-[1000] isolate flex items-center gap-[var(--ui-tree-content-gap)] rounded-sm border bg-popover py-[var(--ui-tree-row-padding-y)] pl-[var(--ui-tree-row-padding-start)] pr-[var(--ui-tree-row-padding-end)] text-left text-[hsl(var(--ui-tree-foreground))] shadow-lg",
        "will-change-transform [&_svg]:size-[var(--ui-tree-icon-size)] [&_svg]:shrink-0 [&_svg]:text-[hsl(var(--ui-tree-icon))]"
      )}
      style={{
        width: width && width > 0 ? `${width}px` : undefined,
        minHeight: height && height > 0 ? `${height}px` : undefined,
        transform: "translate3d(-9999px, -9999px, 0)"
      }}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      {count > 1 ? <span className="ml-1 shrink-0 rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">{count}</span> : null}
    </div>
  );
  return typeof document === "undefined" ? overlay : createPortal(overlay, document.body);
});

export function ExplorerInsertionIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="presentation"
      data-project-resource-insertion
      className="h-2 min-w-0"
    />
  );
}
