import { BrowserWindowPanel } from "@/features/mermaid-editor/components/browser-window-panel";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type BrowserWindowPanelId,
  type DetachedBrowserWindow,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

export function BrowserWorkspaceWindows({
  runtime,
  browserWindows,
  titlebarAutoHide,
  activePanel,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeBrowserWindow,
  onStatus
}: {
  runtime: EditorRuntime;
  browserWindows: DetachedBrowserWindow[];
  titlebarAutoHide: boolean;
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  onStatus: (message: string) => void;
}) {
  return <>{browserWindows.map((browserWindow) => (
    <WorkspaceFloatingWindow
      key={browserWindow.id}
      open
      placement="center-panel"
      panelId={browserWindow.id}
      titlebarAutoHide={titlebarAutoHide}
      active={activePanel === browserWindow.id}
      stackIndex={panelStackPosition(browserWindow.id)}
      onFocusPanel={() => bringPanelToFront(browserWindow.id)}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.browser}
      minSize={WORKSPACE_PANEL_MIN_SIZES.browser}
      windowState={panelWindowState(browserWindow.id)}
      onWindowStateChange={(state) => setPanelWindowState(browserWindow.id, state)}
      onClose={() => closeBrowserWindow(browserWindow.id)}
      closeLabel="关闭内置浏览器"
      tooltipSide="top"
    >
      <BrowserWindowPanel
        browserWindow={browserWindow}
        runtime={runtime}
        onFocusPanel={() => bringPanelToFront(browserWindow.id)}
        onStatus={onStatus}
      />
    </WorkspaceFloatingWindow>
  ))}</>;
}
