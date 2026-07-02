import { Xmark } from "iconoir-react/regular";

import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { DetachedWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import { WorkspacePanelControls, WorkspacePanelHeader } from "@/features/mermaid-editor/components/workspace-panel-controls";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorRuntime, RuntimeEmbeddedBrowserHandle, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTheme, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type BrowserWindowPanelId,
  type DetachedBrowserWindow,
  type DetachedMarkdownWindow,
  type MarkdownWindowPanelId,
  type StaticWorkspacePanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import { cn } from "@/lib/utils";

type EditorWorkspacePanelsProps = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  activeWorkspacePanel: WorkspaceFloatingPanelId | null;
  browserDomOverlayActive: boolean;
  graph: MermaidGraph;
  selection: Selection;
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  projectBusy: boolean;
  fileRef: RuntimeFileRef | null;
  terminalCwd?: string;
  activeTheme: EditorTheme;
  terminalTheme: XtermThemeTokens;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedBrowserWindows: DetachedBrowserWindow[];
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  workspacePanelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  workspacePanelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setWorkspacePanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeWorkspacePanel: (panelId: StaticWorkspacePanelId) => void;
  openProjectFolder: () => void | Promise<unknown>;
  refreshProjectWorkspace: () => void | Promise<unknown>;
  closeProjectWorkspace: () => void | Promise<unknown>;
  openProjectFile: (file: ProjectFileEntry) => void | Promise<unknown>;
  openProjectMarkdownWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  applyEditorCommand: (command: EditorCommand) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void | Promise<unknown>;
  editCanvasNodeAction: (node: CanvasNode) => void;
  closeDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void;
  saveDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>;
  updateDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
  closeDetachedBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  updateDetachedBrowserWindow: (panelId: BrowserWindowPanelId, url: string) => void;
  onStatus: (message: string) => void;
  onBrowserError: (url: string, message: string) => void;
  onBrowserHandleChange: (panelId: BrowserWindowPanelId, handle: RuntimeEmbeddedBrowserHandle | null) => void;
};

export function EditorWorkspacePanels({
  runtime,
  documentKind,
  leftCollapsed,
  rightCollapsed,
  terminalOpen,
  activeWorkspacePanel,
  browserDomOverlayActive,
  graph,
  selection,
  projectWorkspace,
  projectFiles,
  projectBusy,
  fileRef,
  terminalCwd,
  activeTheme,
  terminalTheme,
  detachedMarkdownWindows,
  detachedBrowserWindows,
  bringWorkspacePanelToFront,
  workspacePanelStackPosition,
  workspacePanelWindowState,
  setWorkspacePanelWindowState,
  closeWorkspacePanel,
  openProjectFolder,
  refreshProjectWorkspace,
  closeProjectWorkspace,
  openProjectFile,
  openProjectMarkdownWindow,
  applyEditorCommand,
  executeCanvasNodeAction,
  editCanvasNodeAction,
  closeDetachedMarkdownWindow,
  saveDetachedMarkdownWindow,
  updateDetachedMarkdownWindow,
  closeDetachedBrowserWindow,
  updateDetachedBrowserWindow,
  onStatus,
  onBrowserError,
  onBrowserHandleChange
}: EditorWorkspacePanelsProps) {
  return (
    <>
      <FloatingPanel
        open={!leftCollapsed}
        placement="left-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="explorer"
        active={activeWorkspacePanel === "explorer"}
        stackIndex={workspacePanelStackPosition("explorer")}
        onFocusPanel={() => bringWorkspacePanelToFront("explorer")}
        resetDragOnOpen={false}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.explorer}
        minSize={WORKSPACE_PANEL_MIN_SIZES.explorer}
        windowState={workspacePanelWindowState("explorer")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("explorer", state)}
        className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative h-full w-full")}
      >
        <ExplorerPanel
          runtimeKind={runtime.kind}
          projectWorkspace={projectWorkspace}
          projectFiles={projectFiles}
          currentFileRef={fileRef}
          projectBusy={projectBusy}
          onOpenProject={() => void openProjectFolder()}
          onRefreshProject={() => void refreshProjectWorkspace()}
          onCloseProject={() => void closeProjectWorkspace()}
          onOpenProjectFile={(file) => void openProjectFile(file)}
          onOpenProjectMarkdownWindow={(file) => void openProjectMarkdownWindow(file)}
          windowState={workspacePanelWindowState("explorer")}
          onWindowStateChange={(state) => setWorkspacePanelWindowState("explorer", state)}
          onCollapse={() => closeWorkspacePanel("explorer")}
        />
      </FloatingPanel>
      <FloatingPanel
        open={!rightCollapsed && documentKind === "mermaid"}
        placement="right-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="inspector"
        active={activeWorkspacePanel === "inspector"}
        stackIndex={workspacePanelStackPosition("inspector")}
        onFocusPanel={() => bringWorkspacePanelToFront("inspector")}
        resetDragOnOpen={false}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.inspector}
        minSize={WORKSPACE_PANEL_MIN_SIZES.inspector}
        windowState={workspacePanelWindowState("inspector")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("inspector", state)}
        className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative grid h-full w-full min-h-0")}
      >
        <WorkspacePanelHeader
          windowState={workspacePanelWindowState("inspector")}
          onWindowStateChange={(state) => setWorkspacePanelWindowState("inspector", state)}
          onCollapse={() => closeWorkspacePanel("inspector")}
        />
        <div className="grid min-h-0">
          <InspectorPanel
            graph={graph}
            selection={selection}
            onEditorCommand={applyEditorCommand}
            onOpenNodeAction={executeCanvasNodeAction}
            onEditNodeAction={editCanvasNodeAction}
          />
        </div>
      </FloatingPanel>
      <FloatingPanel
        open={terminalOpen}
        placement="bottom-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="terminal"
        active={activeWorkspacePanel === "terminal"}
        stackIndex={workspacePanelStackPosition("terminal")}
        onFocusPanel={() => bringWorkspacePanelToFront("terminal")}
        resetDragOnOpen={false}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.terminal}
        minSize={WORKSPACE_PANEL_MIN_SIZES.terminal}
        windowState={workspacePanelWindowState("terminal")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("terminal", state)}
        className="grid h-full w-full overflow-hidden"
      >
        <TerminalPanel
          runtime={runtime}
          cwd={terminalCwd}
          theme={activeTheme}
          terminalTheme={terminalTheme}
          onClose={() => closeWorkspacePanel("terminal")}
          onStatus={onStatus}
          windowControls={
            <WorkspacePanelControls
              windowState={workspacePanelWindowState("terminal")}
              onWindowStateChange={(state) => setWorkspacePanelWindowState("terminal", state)}
              onClose={() => closeWorkspacePanel("terminal")}
              closeLabel="关闭终端"
              closeTooltipSide="top"
              closeIcon={<Xmark />}
            />
          }
        />
      </FloatingPanel>
      <DetachedWorkspaceWindows
        markdownWindows={detachedMarkdownWindows}
        browserWindows={detachedBrowserWindows}
        runtime={runtime}
        activePanel={activeWorkspacePanel}
        browserDomOverlayActive={browserDomOverlayActive}
        bringPanelToFront={bringWorkspacePanelToFront}
        panelStackPosition={workspacePanelStackPosition}
        panelWindowState={workspacePanelWindowState}
        setPanelWindowState={setWorkspacePanelWindowState}
        closeMarkdownWindow={closeDetachedMarkdownWindow}
        saveMarkdownWindow={saveDetachedMarkdownWindow}
        updateMarkdownWindow={updateDetachedMarkdownWindow}
        closeBrowserWindow={closeDetachedBrowserWindow}
        updateBrowserWindow={updateDetachedBrowserWindow}
        onStatus={onStatus}
        onBrowserError={onBrowserError}
        onBrowserHandleChange={onBrowserHandleChange}
      />
    </>
  );
}
