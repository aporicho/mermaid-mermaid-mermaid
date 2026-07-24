import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { ImageWindowPanel } from "@/features/mermaid-editor/components/image-window-panel";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type DetachedImageWindow,
  type ImageWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

export function ImageWorkspaceWindows({
  runtime,
  imageWindows,
  titlebarAutoHide,
  activePanel,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeImageWindow,
  navigateImageWindow,
  onStatus
}: {
  runtime: EditorRuntime;
  imageWindows: DetachedImageWindow[];
  titlebarAutoHide: boolean;
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeImageWindow: (panelId: ImageWindowPanelId) => void;
  navigateImageWindow: (panelId: ImageWindowPanelId, direction: -1 | 1) => void;
  onStatus: (message: string) => void;
}) {
  return <>{imageWindows.map((imageWindow) => (
    <WorkspaceFloatingWindow
      key={imageWindow.id}
      open
      placement="center-panel"
      panelId={imageWindow.id}
      titlebarAutoHide={titlebarAutoHide}
      active={activePanel === imageWindow.id}
      stackIndex={panelStackPosition(imageWindow.id)}
      onFocusPanel={() => bringPanelToFront(imageWindow.id)}
      defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.image}
      minSize={WORKSPACE_PANEL_MIN_SIZES.image}
      windowState={panelWindowState(imageWindow.id)}
      onWindowStateChange={(state) => setPanelWindowState(imageWindow.id, state)}
      onClose={() => closeImageWindow(imageWindow.id)}
      closeLabel="关闭图片查看器"
      tooltipSide="top"
    >
      <ImageWindowPanel
        imageWindow={imageWindow}
        runtime={runtime}
        active={activePanel === imageWindow.id}
        onNavigate={(direction) => navigateImageWindow(imageWindow.id, direction)}
        onStatus={onStatus}
      />
    </WorkspaceFloatingWindow>
  ))}</>;
}
