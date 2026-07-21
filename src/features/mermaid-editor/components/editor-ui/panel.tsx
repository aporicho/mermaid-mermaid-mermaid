import type { HTMLAttributes, ReactNode } from "react";

import { useWorkspacePanelHeader } from "@/features/mermaid-editor/components/floating-chrome/workspace-panel-header-context";
import { cn } from "@/lib/utils";

export function EditorPanelShell({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("editor-ui-panel grid min-h-0 overflow-hidden text-foreground", className)} {...props} />;
}

export function EditorPanelHeader({ icon, title, description, actions, draggable = true, className, children, ...props }: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  draggable?: boolean;
}) {
  const workspaceHeader = useWorkspacePanelHeader();

  return (
    <header
      {...props}
      className={cn(
        "editor-ui-panel-header flex min-w-0 items-center justify-between gap-3",
        workspaceHeader?.autoHide && "absolute inset-x-0 top-0 z-30 bg-card/[var(--ui-surface-opacity)] shadow-[var(--ui-shadow-toolbar)] [backdrop-filter:blur(var(--ui-backdrop-blur))] transition-[opacity,transform] [transition-duration:var(--motion-duration-fast)] ease-out motion-reduce:transition-none",
        workspaceHeader?.autoHide && (workspaceHeader.visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"),
        className
      )}
      data-floating-panel-drag-handle={draggable || undefined}
      data-workspace-panel-header={workspaceHeader ? "true" : undefined}
      data-workspace-panel-header-mode={workspaceHeader ? (workspaceHeader.autoHide ? "auto-hide" : "fixed") : undefined}
      data-workspace-panel-header-state={workspaceHeader ? (workspaceHeader.autoHide ? (workspaceHeader.visible ? "visible" : "hidden") : "fixed") : undefined}
      onPointerEnter={(event) => {
        workspaceHeader?.onHeaderPointerEnter(event);
        props.onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        workspaceHeader?.onHeaderPointerLeave(event);
        props.onPointerLeave?.(event);
      }}
      onFocusCapture={(event) => {
        workspaceHeader?.onHeaderFocusCapture(event);
        props.onFocusCapture?.(event);
      }}
      onBlurCapture={(event) => {
        workspaceHeader?.onHeaderBlurCapture(event);
        props.onBlurCapture?.(event);
      }}
    >
      {children ?? <div className="flex min-w-0 items-center gap-2">{icon}<div className="min-w-0"><div className="type-interface-heading truncate">{title}</div>{description ? <div className="type-interface-metadata truncate text-muted-foreground">{description}</div> : null}</div></div>}
      {actions ? <div className="shrink-0" data-floating-panel-drag-exclude>{actions}</div> : null}
    </header>
  );
}

export function EditorPanelBody({ className, padded = true, ...props }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return <div className={cn("min-h-0", padded && "editor-ui-panel-body", className)} {...props} />;
}

export function EditorPanelFooter({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <footer className={cn("editor-ui-panel-footer flex items-center justify-between gap-3", className)} data-floating-panel-drag-exclude {...props} />;
}
