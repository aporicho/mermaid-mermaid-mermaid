import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EditorPanelShell({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("editor-ui-panel grid min-h-0 overflow-hidden text-foreground", className)} {...props} />;
}

export function EditorSectionHeader({ icon, title, description, actions, className, children, ...props }: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      {...props}
      className={cn("editor-ui-panel-header flex min-w-0 items-center justify-between gap-3", className)}
    >
      {children ?? <div className="flex min-w-0 items-center gap-2">{icon}<div className="min-w-0"><div className="type-interface-heading truncate">{title}</div>{description ? <div className="type-interface-metadata truncate text-muted-foreground">{description}</div> : null}</div></div>}
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function EditorPanelBody({ className, padded = true, ...props }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn("min-h-0", padded && "editor-ui-panel-body", className)} {...props} />;
}

export function EditorPanelFooter({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("editor-ui-panel-footer flex items-center justify-between gap-3", className)} data-floating-panel-drag-exclude {...props} />;
}
