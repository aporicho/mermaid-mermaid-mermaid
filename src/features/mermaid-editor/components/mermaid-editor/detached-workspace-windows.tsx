import { MarkdownWindowPanel } from "@/features/mermaid-editor/components/detached-window-panels";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type DetachedMarkdownWindow,
  type MarkdownWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

type DetachedWorkspaceWindowsProps = {
  markdownWindows: DetachedMarkdownWindow[];
  activePanel: WorkspaceFloatingPanelId | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeMarkdownWindow: (panelId: MarkdownWindowPanelId) => void;
  saveMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>;
  updateMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
};

export function DetachedWorkspaceWindows({
  markdownWindows,
  activePanel,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeMarkdownWindow,
  saveMarkdownWindow,
  updateMarkdownWindow
}: DetachedWorkspaceWindowsProps) {
  return (
    <>
      {markdownWindows.map((markdownWindow) => (
        <FloatingPanel
          key={markdownWindow.id}
          open
          placement="center-panel"
          kind="workspace"
          dismissMode="explicit"
          panelId={markdownWindow.id}
          active={activePanel === markdownWindow.id}
          stackIndex={panelStackPosition(markdownWindow.id)}
          onFocusPanel={() => bringPanelToFront(markdownWindow.id)}
          resetDragOnOpen={false}
          defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.markdown}
          minSize={WORKSPACE_PANEL_MIN_SIZES.markdown}
          windowState={panelWindowState(markdownWindow.id)}
          onWindowStateChange={(state) => setPanelWindowState(markdownWindow.id, state)}
          className="relative h-full w-full min-h-0 overflow-hidden rounded-lg"
        >
          <MarkdownWindowPanel
            title={markdownWindow.title}
            path={markdownWindow.file.path}
            value={markdownWindow.value}
            dirty={markdownWindow.value !== markdownWindow.savedValue}
            windowState={panelWindowState(markdownWindow.id)}
            onWindowStateChange={(state) => setPanelWindowState(markdownWindow.id, state)}
            onClose={() => closeMarkdownWindow(markdownWindow.id)}
            onSave={() => void saveMarkdownWindow(markdownWindow.id)}
            onChange={(value) => updateMarkdownWindow(markdownWindow.id, value)}
          />
        </FloatingPanel>
      ))}
    </>
  );
}
