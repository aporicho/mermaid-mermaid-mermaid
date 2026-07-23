import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { HtmlWindowPanel } from "@/features/mermaid-editor/components/html-window-panel";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type DetachedHtmlWindow,
  type HtmlWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

export function HtmlWorkspaceWindows({
  runtime,
  htmlWindows,
  titlebarAutoHide,
  activePanel,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeHtmlWindow,
  onStatus
}: {
  runtime: EditorRuntime;
  htmlWindows: DetachedHtmlWindow[];
  titlebarAutoHide: boolean;
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeHtmlWindow: (panelId: HtmlWindowPanelId) => void;
  onStatus: (message: string) => void;
}) {
  return <>{htmlWindows.map((htmlWindow) => (
    <WorkspaceFloatingWindow
      key={htmlWindow.id}
      open
      placement="center-panel"
      panelId={htmlWindow.id}
      titlebarAutoHide={titlebarAutoHide}
      active={activePanel === htmlWindow.id}
      stackIndex={panelStackPosition(htmlWindow.id)}
      onFocusPanel={() => bringPanelToFront(htmlWindow.id)}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.html}
      minSize={WORKSPACE_PANEL_MIN_SIZES.html}
      windowState={panelWindowState(htmlWindow.id)}
      onWindowStateChange={(state) => setPanelWindowState(htmlWindow.id, state)}
      onClose={() => closeHtmlWindow(htmlWindow.id)}
      closeLabel="关闭 HTML 预览"
      tooltipSide="top"
    >
      <HtmlWindowPanel
        htmlWindow={htmlWindow}
        runtime={runtime}
        onFocusPanel={() => bringPanelToFront(htmlWindow.id)}
        onStatus={onStatus}
      />
    </WorkspaceFloatingWindow>
  ))}</>;
}
