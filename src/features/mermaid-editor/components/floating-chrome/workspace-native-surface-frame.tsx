import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useWorkspacePanelHeader } from "./workspace-panel-header-context";
import { useWorkspaceWindowChrome } from "./workspace-window-chrome-context";

export function WorkspaceNativeSurfaceFrame({ className, children }: { className?: string; children: ReactNode }) {
  const chrome = useWorkspaceWindowChrome();
  const workspaceHeader = useWorkspacePanelHeader();
  if (!chrome || !workspaceHeader) throw new Error("WorkspaceNativeSurfaceFrame must be rendered inside WorkspaceFloatingWindow.");

  const topInset = workspaceNativeSurfaceTopInset(workspaceHeader.autoHide, workspaceHeader.visible, workspaceHeader.headerHeightPx);
  const style = {
    paddingTop: topInset,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0
  } satisfies CSSProperties;

  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1 transition-[padding] [transition-duration:var(--motion-duration-fast)] motion-reduce:transition-none", className)}
      style={style}
      data-workspace-native-surface-frame
      data-workspace-native-surface-header={workspaceHeader.autoHide ? (workspaceHeader.visible ? "visible" : "hidden") : "fixed"}
      data-workspace-native-surface-window-state={chrome.windowState}
    >
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export function workspaceNativeSurfaceTopInset(autoHide: boolean, headerVisible: boolean, headerHeightPx = 0) {
  if (!autoHide) return "0px";
  if (!headerVisible) return "0px";
  return headerHeightPx > 0 ? `${headerHeightPx}px` : "var(--theme-panel-header-height)";
}
