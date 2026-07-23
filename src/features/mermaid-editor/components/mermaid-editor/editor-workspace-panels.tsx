import { Suspense, lazy } from "react";

import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import type { AgentController } from "@/features/mermaid-editor/components/agent/use-agent-session";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { DetachedWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows";
import { AgentTerminalWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/agent-terminal-workspace-panels";
import { NativeWebWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/native-web-workspace-windows";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorRuntime, RuntimeAgentTextSelection, RuntimeFileRef, RuntimeProjectFileKind } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
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
  type DetachedBrowserWindow,
  type DetachedHtmlWindow,
  type BrowserWindowPanelId,
  type MarkdownWindowPanelId,
  type HtmlWindowPanelId,
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
  agentOpen: boolean;
  agentController: AgentController;
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
  terminalContextKey: string;
  activeTheme: EditorTheme;
  editingThemeId: EditorThemeId;
  editingCustomTheme: EditorTheme | null;
  themeDraftDirty: boolean;
  terminalTheme: XtermThemeTokens;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedBrowserWindows: DetachedBrowserWindow[];
  detachedHtmlWindows: DetachedHtmlWindow[];
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
  openProjectHtmlWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: "markdown" | "html", point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  applyEditorCommand: (command: EditorCommand) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void | Promise<unknown>;
  editCanvasNodeAction: (node: CanvasNode) => void;
  closeDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void; saveDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>; updateDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void;
  closeDetachedBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  closeDetachedHtmlWindow: (panelId: HtmlWindowPanelId) => void;
  onDetachedMarkdownSelectionChange: (panelId: MarkdownWindowPanelId, selection: RuntimeAgentTextSelection | null) => void;
  markdownFoldBindingFor: (file: RuntimeFileRef) => { foldState: MarkdownFoldSnapshot | null | undefined; onFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void };
  onStatus: (message: string) => void;
};

export function EditorWorkspacePanels({
  runtime, documentKind,
  leftCollapsed, rightCollapsed,
  agentOpen, agentController, terminalOpen, themeSettingsOpen,
  activeWorkspacePanel, graph,
  selection, projectWorkspace,
  projectFiles, explorerTreeState,
  onExplorerTreeStateChange, projectBusy,
  fileRef,
  terminalCwd, terminalContextKey,
  activeTheme,
  editingThemeId,
  editingCustomTheme,
  themeDraftDirty,
  terminalTheme,
  detachedMarkdownWindows, detachedBrowserWindows, detachedHtmlWindows,
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
  openProjectHtmlWindow,
  onProjectDocumentPointerDrag,
  applyEditorCommand,
  executeCanvasNodeAction,
  editCanvasNodeAction,
  closeDetachedMarkdownWindow,
  closeDetachedBrowserWindow,
  closeDetachedHtmlWindow,
  saveDetachedMarkdownWindow,
  updateDetachedMarkdownWindow, markdownFoldBindingFor,
  onDetachedMarkdownSelectionChange,
  onStatus
}: EditorWorkspacePanelsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 isolate z-[1]" data-layer-group="workspace-windows">
      <WorkspaceFloatingWindow
        open={!leftCollapsed}
        placement="left-panel"
        panelId="explorer"
        titlebarAutoHide={workspaceTitlebarAutoHide}
        active={activeWorkspacePanel === "explorer"}
        stackIndex={workspacePanelStackPosition("explorer")}
        onFocusPanel={() => bringWorkspacePanelToFront("explorer")}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.explorer}
        minSize={WORKSPACE_PANEL_MIN_SIZES.explorer}
        allowFullscreen={false}
        windowState={workspacePanelWindowState("explorer")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("explorer", state)}
        onClose={() => closeWorkspacePanel("explorer")}
        closeLabel="关闭资源管理器"
        tooltipSide="right"
        className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative")}
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
          onOpenProjectHtmlWindow={(file) => void openProjectHtmlWindow(file)}
          onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
          onStatus={onStatus}
        />
      </WorkspaceFloatingWindow>
      <AgentTerminalWorkspacePanels
        runtime={runtime}
        agentOpen={agentOpen}
        terminalOpen={terminalOpen}
        agentController={agentController}
        terminalCwd={terminalCwd}
        terminalContextKey={terminalContextKey}
        activeTheme={activeTheme}
        terminalTheme={terminalTheme}
        titlebarAutoHide={workspaceTitlebarAutoHide}
        activePanel={activeWorkspacePanel}
        stackPosition={workspacePanelStackPosition}
        windowState={workspacePanelWindowState}
        setWindowState={setWorkspacePanelWindowState}
        bringToFront={bringWorkspacePanelToFront}
        closePanel={closeWorkspacePanel}
        onStatus={onStatus}
      />
      <WorkspaceFloatingWindow
        open={!rightCollapsed && documentKind === "mermaid"}
        placement="right-panel"
        panelId="inspector"
        titlebarAutoHide={workspaceTitlebarAutoHide}
        active={activeWorkspacePanel === "inspector"}
        stackIndex={workspacePanelStackPosition("inspector")}
        onFocusPanel={() => bringWorkspacePanelToFront("inspector")}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.inspector}
        minSize={WORKSPACE_PANEL_MIN_SIZES.inspector}
        allowFullscreen={false}
        windowState={workspacePanelWindowState("inspector")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("inspector", state)}
        onClose={() => closeWorkspacePanel("inspector")}
        closeLabel="关闭检查器"
        tooltipSide="left"
        className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative")}
      >
        <InspectorPanel
          graph={graph} selection={selection} onEditorCommand={applyEditorCommand}
          onOpenNodeAction={executeCanvasNodeAction} onEditNodeAction={editCanvasNodeAction}
        />
      </WorkspaceFloatingWindow>
      <WorkspaceFloatingWindow
        open={themeSettingsOpen}
        placement="right-panel"
        panelId="theme"
        titlebarAutoHide={workspaceTitlebarAutoHide}
        active={activeWorkspacePanel === "theme"}
        stackIndex={workspacePanelStackPosition("theme")}
        onFocusPanel={() => bringWorkspacePanelToFront("theme")}
        defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.theme}
        minSize={WORKSPACE_PANEL_MIN_SIZES.theme}
        allowFullscreen={false}
        windowState={workspacePanelWindowState("theme")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("theme", state)}
        onClose={hideThemeSettings}
        closeLabel="隐藏主题面板"
        tooltipSide="left"
        className="bg-card"
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
          />
        </Suspense>
      </WorkspaceFloatingWindow>
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
        updateMarkdownWindow={updateDetachedMarkdownWindow} markdownFoldBindingFor={markdownFoldBindingFor}
        onMarkdownSelectionChange={onDetachedMarkdownSelectionChange}
      />
      <NativeWebWorkspaceWindows
        runtime={runtime}
        browserWindows={detachedBrowserWindows}
        htmlWindows={detachedHtmlWindows}
        titlebarAutoHide={workspaceTitlebarAutoHide}
        activePanel={activeWorkspacePanel}
        bringPanelToFront={bringWorkspacePanelToFront}
        panelStackPosition={workspacePanelStackPosition}
        panelWindowState={workspacePanelWindowState}
        setPanelWindowState={setWorkspacePanelWindowState}
        closeBrowserWindow={closeDetachedBrowserWindow}
        closeHtmlWindow={closeDetachedHtmlWindow}
        onStatus={onStatus}
      />
    </div>
  );
}
