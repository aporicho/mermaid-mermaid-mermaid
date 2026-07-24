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
        "type-interface-tree grid min-w-0 overflow-x-hidden [--editor-tree-branch:calc(var(--ui-tree-connector-rail-inset)+var(--ui-tree-row-padding-start))] [--editor-tree-indent:var(--ui-tree-level-indent)] [--editor-tree-rail:calc(var(--ui-tree-connector-rail-inset)*-1)] [--editor-tree-row-center:calc(var(--ui-tree-row-height)/2)]",
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
          "before:pointer-events-none before:absolute before:bottom-0 before:left-[var(--editor-tree-rail)] before:top-0 before:z-10 before:border-l-[length:var(--ui-tree-connector-width)] before:[border-left-style:var(--ui-tree-connector-style,solid)] before:border-[hsl(var(--ui-tree-connector)/var(--ui-tree-connector-opacity))]",
          "after:pointer-events-none after:absolute after:left-[var(--editor-tree-rail)] after:top-[var(--editor-tree-row-center)] after:z-10 after:w-[var(--editor-tree-branch)] after:border-t-[length:var(--ui-tree-connector-width)] after:[border-top-style:var(--ui-tree-connector-style,solid)] after:border-[hsl(var(--ui-tree-connector)/var(--ui-tree-connector-opacity))]",
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
        "relative z-0 isolate flex min-h-[var(--ui-tree-row-height)] w-full min-w-0 items-center justify-start gap-[var(--ui-tree-content-gap)] border-0 bg-transparent py-[var(--ui-tree-row-padding-y)] pl-[var(--ui-tree-row-padding-start)] pr-[var(--ui-tree-row-padding-end)] text-left text-[hsl(var(--ui-tree-foreground))] outline-none transition-colors before:pointer-events-none before:absolute before:inset-y-0 before:-left-[100vw] before:right-0 before:-z-10 before:bg-transparent before:transition-colors hover:before:bg-[hsl(var(--ui-tree-hover-background)/var(--ui-tree-hover-opacity))] focus-visible:before:bg-[hsl(var(--ui-tree-focus-background)/var(--ui-tree-focus-opacity))] disabled:pointer-events-none disabled:opacity-[var(--ui-disabled-opacity)] [&_svg]:size-[var(--ui-tree-icon-size)] [&_svg]:text-[hsl(var(--ui-tree-icon))]",
        active && "text-[hsl(var(--ui-tree-selected-foreground))] before:bg-[hsl(var(--ui-tree-selected-background))] [&_svg]:text-[hsl(var(--ui-tree-selected-foreground))]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
