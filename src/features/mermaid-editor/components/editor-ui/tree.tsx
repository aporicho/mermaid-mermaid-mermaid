import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const EditorTree = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function EditorTree(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="tree"
      className={cn(
        "grid min-w-0 overflow-x-hidden [--editor-tree-branch:0.75rem] [--editor-tree-indent:1.25rem] [--editor-tree-rail:-0.375rem] [--editor-tree-row-center:calc(var(--ui-control-height-sm)/2)]",
        className
      )}
      {...props}
    />
  );
});

export type EditorTreeItemProps = HTMLAttributes<HTMLDivElement> & {
  root?: boolean;
};

export function EditorTreeItem({ root = false, className, ...props }: EditorTreeItemProps) {
  return (
    <div
      role="none"
      data-editor-tree-item
      data-tree-root={root || undefined}
      className={cn(
        "relative grid min-w-0",
        !root && [
          "before:pointer-events-none before:absolute before:bottom-0 before:left-[var(--editor-tree-rail)] before:top-0 before:z-10 before:border-l-[length:var(--ui-divider-width)] before:border-border/55",
          "after:pointer-events-none after:absolute after:left-[var(--editor-tree-rail)] after:top-[var(--editor-tree-row-center)] after:z-10 after:w-[var(--editor-tree-branch)] after:border-t-[length:var(--ui-divider-width)] after:border-border/55",
          "last:before:bottom-auto last:before:h-[var(--editor-tree-row-center)]"
        ],
        className
      )}
      {...props}
    />
  );
}

export function EditorTreeGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn("grid min-w-0 pl-[var(--editor-tree-indent)]", className)}
      {...props}
    />
  );
}

export type EditorTreeRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export const EditorTreeRow = forwardRef<HTMLButtonElement, EditorTreeRowProps>(function EditorTreeRow(
  { active = false, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="treeitem"
      className={cn(
        "relative z-0 flex min-h-[var(--ui-control-height-sm)] w-full min-w-0 isolate items-center justify-start gap-1.5 border-0 bg-transparent py-1 pl-1.5 pr-2 text-left text-foreground outline-none transition-colors before:pointer-events-none before:absolute before:inset-y-0 before:-left-[100vw] before:right-0 before:-z-10 before:bg-transparent before:transition-colors hover:before:bg-accent/55 focus-visible:before:bg-accent/70 disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] [&_svg]:text-icon",
        active && "text-accent-foreground before:bg-accent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
