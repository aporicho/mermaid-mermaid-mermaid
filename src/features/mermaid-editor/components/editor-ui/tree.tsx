import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const EditorTree = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function EditorTree(
  { className, ...props },
  ref
) {
  return <div ref={ref} role="tree" className={cn("grid min-w-0", className)} {...props} />;
});

export function EditorTreeGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        "ml-4 grid min-w-0 border-l-[length:var(--ui-divider-width)] border-border/55",
        className
      )}
      {...props}
    />
  );
}

export type EditorTreeRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  branch?: boolean;
};

export const EditorTreeRow = forwardRef<HTMLButtonElement, EditorTreeRowProps>(function EditorTreeRow(
  { active = false, branch = false, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      role="treeitem"
      className={cn(
        "relative flex min-h-[var(--ui-control-height-sm)] w-full min-w-0 items-center justify-start gap-1.5 border-0 bg-transparent py-1 pr-2 text-left text-foreground outline-none transition-colors hover:bg-accent/55 focus-visible:bg-accent/70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:text-icon",
        active && "bg-accent text-accent-foreground",
        branch && "ml-0 before:absolute before:left-0 before:top-1/2 before:w-2 before:border-t-[length:var(--ui-divider-width)] before:border-border/55",
        branch ? "pl-2" : "pl-1.5",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
