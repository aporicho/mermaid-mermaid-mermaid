import { Suspense, lazy } from "react";
import { Xmark } from "iconoir-react/regular";

import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import { FloatingPanel } from "@/features/mermaid-editor/components/floating-chrome";
import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { DetachedWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import { WorkspacePanelControls } from "@/features/mermaid-editor/components/workspace-panel-controls";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorRuntime, RuntimeFileRef, RuntimeProjectFileKind } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasNode, MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTheme, EditorThemeId, XtermThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type { ExplorerWorkspaceTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ProjectFileEntry, ProjectResourceEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type DetachedMarkdownWindow,
  type MarkdownWindowPanelId,
  type ChromeWorkspacePanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import { cn } from "@/lib/utils";
const ThemeSettingsPanel = lazy(() => import("@/features/mermaid-editor/components/theme-settings-panel").then((mod) => ({ default: mod.ThemeSettingsPanel })));

type EditorWorkspacePanelsProps = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  terminalOpen: boolean;
  themeSettingsOpen: boolean;
  activeWorkspacePanel: WorkspaceFloatingPanelId | null;
  graph: MermaidGraph;
  selection: Selection;
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  explorerTreeState: ExplorerWorkspaceTreeState | null;
  onExplorerTreeStateChange: (state: Omit<ExplorerWorkspaceTreeState, "rootPath" | "updatedAt">) => void;
  projectBusy: boolean;
  fileRef: RuntimeFileRef | null;
  terminalCwd?: string;
  activeTheme: EditorTheme;
  editingThemeId: EditorThemeId;
  editingCustomTheme: EditorTheme | null;
  themeDraftDirty: boolean;
  terminalTheme: XtermThemeTokens;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  markdownSpellcheckEnabled: boolean; markdownContentWidth: number; markdownTextScale: number;
  workspaceTitlebarAutoHide: boolean;
  onMarkdownTextScaleChange: (value: number) => void;
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  workspacePanelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  workspacePanelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setWorkspacePanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeWorkspacePanel: (panelId: ChromeWorkspacePanelId) => void;
  hideThemeSettings: () => void;
  discardThemeSettings: () => void;
  applyThemeSettings: () => void;
  previewTheme: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  openProjectFolder: () => void | Promise<unknown>;
  refreshProjectWorkspace: () => void | Promise<unknown>;
  createProjectFile: (request: { directoryPath: string; fileName: string; kind: RuntimeProjectFileKind }) => void | Promise<unknown>; moveProjectFile: (source: ProjectResourceEntry, targetDirectoryPath: string) => void | Promise<unknown>;
  openProjectFile: (file: ProjectFileEntry) => void | Promise<unknown>;
  openProjectMarkdownWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  onMarkdownDocumentPointerDrag: (file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  applyEditorCommand: (command: EditorCommand) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void | Promise<unknown>;
  editCanvasNodeAction: (node: CanvasNode) => void;
  closeDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void;
  saveDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>;
  updateDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
  onStatus: (message: string) => void;
};

export function EditorWorkspacePanels({
  runtime, documentKind,
  leftCollapsed, rightCollapsed,
  terminalOpen, themeSettingsOpen,
  activeWorkspacePanel, graph,
  selection, projectWorkspace,
  projectFiles, explorerTreeState,
  onExplorerTreeStateChange, projectBusy,
  fileRef,
  terminalCwd,
  activeTheme,
  editingThemeId,
  editingCustomTheme,
  themeDraftDirty,
  terminalTheme,
  detachedMarkdownWindows,
  markdownSpellcheckEnabled, markdownContentWidth, markdownTextScale, workspaceTitlebarAutoHide, onMarkdownTextScaleChange,
  bringWorkspacePanelToFront,
  workspacePanelStackPosition,
  workspacePanelWindowState,
  setWorkspacePanelWindowState,
  closeWorkspacePanel,
  hideThemeSettings,
  discardThemeSettings,
  applyThemeSettings,
  previewTheme,
  openProjectFolder,
  refreshProjectWorkspace,
  createProjectFile, moveProjectFile,
  openProjectFile,
  openProjectMarkdownWindow,
  onMarkdownDocumentPointerDrag,
  applyEditorCommand,
  executeCanvasNodeAction,
  editCanvasNodeAction,
  closeDetachedMarkdownWindow,
  saveDetachedMarkdownWindow,
  updateDetachedMarkdownWindow,
  onStatus
}: EditorWorkspacePanelsProps) {
  return (
    <>
      <FloatingPanel
        open={!leftCollapsed}
        placement="left-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="explorer"
        titlebarAutoHide={workspaceTitlebarAutoHide}
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
          treeState={explorerTreeState}
          onTreeStateChange={onExplorerTreeStateChange}
          currentFileRef={fileRef}
          projectBusy={projectBusy}
          onOpenProject={() => void openProjectFolder()}
          onRefreshProject={() => void refreshProjectWorkspace()}
          onCreateProjectFile={(request) => void createProjectFile(request)} onMoveProjectFile={(source, targetDirectoryPath) => void moveProjectFile(source, targetDirectoryPath)}
          onOpenProjectFile={(file) => void openProjectFile(file)}
          onOpenProjectMarkdownWindow={(file) => void openProjectMarkdownWindow(file)}
          onMarkdownDocumentPointerDrag={onMarkdownDocumentPointerDrag}
          onStatus={onStatus}
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
        titlebarAutoHide={workspaceTitlebarAutoHide}
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
        <InspectorPanel
          graph={graph} selection={selection} onEditorCommand={applyEditorCommand}
          onOpenNodeAction={executeCanvasNodeAction} onEditNodeAction={editCanvasNodeAction}
          windowControls={
            <WorkspacePanelControls
              windowState={workspacePanelWindowState("inspector")} onWindowStateChange={(state) => setWorkspacePanelWindowState("inspector", state)}
              onClose={() => closeWorkspacePanel("inspector")}
              closeLabel="关闭检查器" closeTooltipSide="left" closeIcon={<Xmark />}
            />
          }
        />
      </FloatingPanel>
      <FloatingPanel
        open={themeSettingsOpen}
        placement="right-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="theme"
        titlebarAutoHide={workspaceTitlebarAutoHide}
        active={activeWorkspacePanel === "theme"}
        stackIndex={workspacePanelStackPosition("theme")}
        onFocusPanel={() => bringWorkspacePanelToFront("theme")}
        resetDragOnOpen={false}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.theme}
        minSize={WORKSPACE_PANEL_MIN_SIZES.theme}
        windowState={workspacePanelWindowState("theme")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("theme", state)}
        className="grid h-full w-full min-h-0 overflow-hidden bg-card"
      >
        <Suspense fallback={null}>
          <ThemeSettingsPanel
            runtime={runtime}
            themeId={editingThemeId}
            customTheme={editingCustomTheme}
            activeTheme={activeTheme}
            hasDraft={themeDraftDirty}
            onPreview={previewTheme}
            onDiscard={discardThemeSettings}
            onApply={applyThemeSettings}
            windowControls={
              <WorkspacePanelControls
                windowState={workspacePanelWindowState("theme")}
                onWindowStateChange={(state) => setWorkspacePanelWindowState("theme", state)}
                onClose={hideThemeSettings}
                closeLabel="隐藏主题面板"
                closeTooltipSide="left"
                closeIcon={<Xmark />}
              />
            }
          />
        </Suspense>
      </FloatingPanel>
      <FloatingPanel
        open={terminalOpen}
        placement="bottom-panel"
        kind="workspace"
        dismissMode="explicit"
        panelId="terminal"
        titlebarAutoHide={workspaceTitlebarAutoHide}
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
        markdownWindows={detachedMarkdownWindows} markdownSpellcheckEnabled={markdownSpellcheckEnabled}
        markdownContentWidth={markdownContentWidth} markdownTextScale={markdownTextScale}
        workspaceTitlebarAutoHide={workspaceTitlebarAutoHide} onMarkdownTextScaleChange={onMarkdownTextScaleChange}
        activePanel={activeWorkspacePanel}
        bringPanelToFront={bringWorkspacePanelToFront}
        panelStackPosition={workspacePanelStackPosition}
        panelWindowState={workspacePanelWindowState}
        setPanelWindowState={setWorkspacePanelWindowState}
        closeMarkdownWindow={closeDetachedMarkdownWindow}
        saveMarkdownWindow={saveDetachedMarkdownWindow}
        updateMarkdownWindow={updateDetachedMarkdownWindow}
      />
    </>
  );
}
