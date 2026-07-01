import { BrowserWindowPanel, MarkdownWindowPanel } from "@/features/mermaid-editor/components/detached-window-panels";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type BrowserWindowPanelId,
  type DetachedBrowserWindow,
  type DetachedMarkdownWindow,
  type MarkdownWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";

type DetachedWorkspaceWindowsProps = {
  markdownWindows: DetachedMarkdownWindow[];
  browserWindows: DetachedBrowserWindow[];
  runtime: EditorRuntime;
  activePanel: WorkspaceFloatingPanelId | null;
  browserDomOverlayActive: boolean;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  panelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  panelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeMarkdownWindow: (panelId: MarkdownWindowPanelId) => void;
  saveMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>;
  updateMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
  closeBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  updateBrowserWindow: (panelId: BrowserWindowPanelId, url: string) => void;
  onStatus: (message: string) => void;
  onBrowserError: (url: string, message: string) => void;
};

export function DetachedWorkspaceWindows({
  markdownWindows,
  browserWindows,
  runtime,
  activePanel,
  browserDomOverlayActive,
  bringPanelToFront,
  panelStackPosition,
  panelWindowState,
  setPanelWindowState,
  closeMarkdownWindow,
  saveMarkdownWindow,
  updateMarkdownWindow,
  closeBrowserWindow,
  updateBrowserWindow,
  onStatus,
  onBrowserError
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
      {browserWindows.map((browserWindow) => (
        <FloatingPanel
          key={browserWindow.id}
          open
          placement="center-panel"
          kind="workspace"
          dismissMode="explicit"
          panelId={browserWindow.id}
          active={activePanel === browserWindow.id}
          stackIndex={panelStackPosition(browserWindow.id)}
          onFocusPanel={() => bringPanelToFront(browserWindow.id)}
          resetDragOnOpen={false}
          defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.browser}
          minSize={WORKSPACE_PANEL_MIN_SIZES.browser}
          windowState={panelWindowState(browserWindow.id)}
          onWindowStateChange={(state) => setPanelWindowState(browserWindow.id, state)}
          className="relative h-full w-full min-h-0 overflow-hidden rounded-lg"
        >
          <BrowserWindowPanel
            panelId={browserWindow.id}
            title={browserWindow.title}
            url={browserWindow.url}
            runtime={runtime}
            active={activePanel === browserWindow.id}
            domOverlayActive={browserDomOverlayActive}
            windowState={panelWindowState(browserWindow.id)}
            onWindowStateChange={(state) => setPanelWindowState(browserWindow.id, state)}
            onNavigate={(url) => updateBrowserWindow(browserWindow.id, url)}
            onClose={() => closeBrowserWindow(browserWindow.id)}
            onStatus={onStatus}
            onBrowserError={onBrowserError}
          />
        </FloatingPanel>
      ))}
    </>
  );
}
