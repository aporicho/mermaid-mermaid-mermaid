import type { HTMLAttributes, ReactNode, Ref } from "react";

import { ButtonGroup } from "@/components/ui/button-group";
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
  headerRef,
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
  headerRef?: Ref<HTMLElement>;
}) {
  return (
    <header
      ref={headerRef}
      {...props}
      data-slot="window-titlebar"
      className={cn("editor-ui-panel-header flex min-w-0 items-center gap-2 [container-type:inline-size]", className)}
    >
      {leadingActions ? (
        <ButtonGroup className="shrink-0" data-window-titlebar-drag-exclude>
          {leadingActions}
        </ButtonGroup>
      ) : null}
      <div className="flex min-w-0 items-center gap-2" title={titleTooltip}>
        {icon}
        <div id={titleId} className="type-interface-heading min-w-0 truncate">
          {title}
        </div>
        {status}
      </div>
      {center ? (
        <div className="flex min-w-0 flex-1 items-center">
          {center}
        </div>
      ) : <div className="min-w-4 flex-1" aria-hidden />}
      {actions ? (
        <ButtonGroup className="shrink-0" data-window-titlebar-drag-exclude>
          {actions}
        </ButtonGroup>
      ) : null}
    </header>
  );
}
