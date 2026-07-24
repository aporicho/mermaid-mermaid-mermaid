import type { ComponentProps, ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { EmbeddedBrowserSurface } from "@/features/mermaid-editor/components/embedded-browser-surface";
import {
  WorkspaceNativeSurfaceFrame,
  WorkspaceWindowHeader,
  type WorkspaceWindowAction
} from "@/features/mermaid-editor/components/floating-chrome";

export function NativeWebWindowPanel({
  icon,
  title,
  titleTooltip,
  status,
  loading,
  center,
  actions,
  overflowActions,
  surface
}: {
  icon: ReactNode;
  title: ReactNode;
  titleTooltip?: string;
  status?: string;
  loading: boolean;
  center?: ReactNode;
  actions?: ReactNode;
  overflowActions?: readonly WorkspaceWindowAction[];
  surface: ComponentProps<typeof EmbeddedBrowserSurface>;
}) {
  return <div className="flex h-full min-h-0 flex-col bg-card">
    <WorkspaceWindowHeader
      icon={icon}
      title={title}
      titleTooltip={titleTooltip}
      status={status
        ? <span className="type-interface-status hidden max-w-40 truncate text-muted-foreground xl:block" aria-live="polite">{status}</span>
        : loading
          ? <span className="type-interface-status hidden items-center gap-1.5 text-muted-foreground xl:flex"><Spinner />载入中</span>
          : null}
      center={center}
      actions={actions}
      overflowActions={overflowActions}
    />
    <WorkspaceNativeSurfaceFrame>
      <EmbeddedBrowserSurface {...surface} />
    </WorkspaceNativeSurfaceFrame>
  </div>;
}
