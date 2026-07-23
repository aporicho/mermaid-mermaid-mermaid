import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function WindowTitlebarLayout({
  leadingActions,
  icon,
  title,
  status,
  center,
  actions,
  titleId,
  titleTooltip,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  leadingActions?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  status?: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  titleTooltip?: string;
}) {
  return (
    <header
      {...props}
      className={cn("editor-ui-panel-header flex min-w-0 items-center gap-2", className)}
    >
      {leadingActions ? (
        <div className="flex shrink-0 items-center gap-1" data-window-titlebar-drag-exclude>
          {leadingActions}
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-2" title={titleTooltip}>
        {icon}
        <div id={titleId} className="type-interface-heading min-w-0 truncate">
          {title}
        </div>
        {status}
      </div>
      {center ? (
        <div className="flex min-w-0 flex-1 items-center" data-window-titlebar-drag-exclude>
          {center}
        </div>
      ) : <div className="min-w-4 flex-1" aria-hidden />}
      {actions ? (
        <div className="flex shrink-0 items-center gap-1" data-window-titlebar-drag-exclude>
          {actions}
        </div>
      ) : null}
    </header>
  );
}
