import { Suspense, lazy } from "react";
import type { ExplorerCanvasNodeKind, ExplorerResourceStatus } from "@/features/mermaid-editor/components/explorer-panel";
import { WorkspaceFloatingWindow } from "@/features/mermaid-editor/components/floating-chrome";
import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { DetachedWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/detached-workspace-windows";
import { AgentTerminalWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/agent-terminal-workspace-panels";
import { ExplorerWorkspaceWindow } from "@/features/mermaid-editor/components/mermaid-editor/explorer-workspace-window";
import { NativeWebWorkspaceWindows } from "@/features/mermaid-editor/components/mermaid-editor/native-web-workspace-windows";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import type { EditorRuntime, RuntimeAgentDocumentBridge, RuntimeAgentTextSelection, RuntimeFileRef, RuntimeProjectFileKind, RuntimeProjectResourceKind, RuntimeProjectResourcePlacement } from "@/features/mermaid-editor/lib/editor-runtime";
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
  type DetachedMarkdownWindow, type DetachedTerminalWindow, type DetachedBrowserWindow, type DetachedHtmlWindow, type DetachedImageWindow, type DetachedTextWindow, type DetachedCsvWindow,
  type BrowserWindowPanelId, type MarkdownWindowPanelId,
  type HtmlWindowPanelId, type ImageWindowPanelId, type TextWindowPanelId, type CsvWindowPanelId,
  type ChromeWorkspacePanelId, type TerminalWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import { cn } from "@/lib/utils";
const ThemeSettingsPanel = lazy(() => import("@/features/mermaid-editor/components/theme-settings-panel").then((mod) => ({ default: mod.ThemeSettingsPanel })));

type EditorWorkspacePanelsProps = {
  runtime: EditorRuntime; documentKind: DocumentKind;
  leftCollapsed: boolean; rightCollapsed: boolean;
  agentOpen: boolean; agentDocumentBridge: RuntimeAgentDocumentBridge; terminalOpen: boolean; detachedTerminalWindows: DetachedTerminalWindow[]; themeSettingsOpen: boolean;
  activeWorkspacePanel: WorkspaceFloatingPanelId | null; fullscreenWorkspacePanel: WorkspaceFloatingPanelId | null;
  graph: MermaidGraph; selection: Selection;
  projectWorkspace: ProjectWorkspace | null; projectFiles: ProjectFileEntry[];
  projectResourceStatuses: Record<string, ExplorerResourceStatus | undefined>; explorerTreeState: ExplorerWorkspaceTreeState | null;
  onExplorerTreeStateChange: (state: Omit<ExplorerWorkspaceTreeState, "rootPath" | "updatedAt">) => void;
  projectBusy: boolean; fileRef: RuntimeFileRef | null;
  terminalCwd?: string; terminalContextKey: string;
  activeTheme: EditorTheme; editingThemeId: EditorThemeId; editingCustomTheme: EditorTheme | null;
  themeDraftDirty: boolean; terminalTheme: XtermThemeTokens;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedBrowserWindows: DetachedBrowserWindow[];
  detachedHtmlWindows: DetachedHtmlWindow[]; detachedImageWindows: DetachedImageWindow[];
  detachedTextWindows: DetachedTextWindow[]; detachedCsvWindows: DetachedCsvWindow[];
  markdownSpellcheckEnabled: boolean; markdownContentWidth: number; markdownTextScale: number;
  workspaceTitlebarAutoHide: boolean;
  onMarkdownTextScaleChange: (value: number) => void;
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  workspacePanelStackPosition: (panelId: WorkspaceFloatingPanelId) => number;
  workspacePanelWindowState: (panelId: WorkspaceFloatingPanelId) => FloatingPanelWindowState;
  setWorkspacePanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  closeWorkspacePanel: (panelId: ChromeWorkspacePanelId) => void;
  newTerminalWindow: () => void; openTerminalWindow: (panelId: "terminal" | TerminalWindowPanelId) => void; closeTerminalWindow: (panelId: TerminalWindowPanelId) => void;
  hideThemeSettings: () => void;
  discardThemeSettings: () => void;
  applyThemeSettings: () => void;
  previewTheme: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  openProjectFolder: () => void | Promise<unknown>;
  refreshProjectWorkspace: () => void | Promise<unknown>;
  createProjectFile: (request: { directoryPath: string; fileName: string; kind: RuntimeProjectFileKind }) => void | Promise<unknown>;
  createProjectDirectory: (request: { directoryPath: string; directoryName: string }) => void | Promise<unknown>;
  renameProjectResource: (resource: ProjectResourceEntry, name: string) => void | Promise<unknown>;
  moveProjectFile: (source: ProjectResourceEntry, targetDirectoryPath: string) => void | Promise<unknown>;
  moveProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string, placement?: RuntimeProjectResourcePlacement) => void | Promise<unknown>;
  reorderProjectResources: (parentDirectoryPath: string, kind: RuntimeProjectResourceKind, orderedRelativePaths: string[]) => void | Promise<unknown>;
  copyProjectResources: (resources: ProjectResourceEntry[], targetDirectoryPath: string) => void | Promise<unknown>;
  importProjectResources: (externalPaths: string[], targetDirectoryPath: string) => void | Promise<unknown>;
  deleteProjectResources: (resources: ProjectResourceEntry[]) => void | Promise<unknown>;
  showProjectResourceInFileManager: (resource: ProjectResourceEntry) => void | Promise<unknown>;
  openProjectFile: (file: ProjectFileEntry) => void | Promise<unknown>;
  openProjectMarkdownWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  openProjectHtmlWindow: (file: ProjectFileEntry) => void | Promise<unknown>; openProjectImageWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  openProjectTextWindow: (file: ProjectFileEntry) => void | Promise<unknown>; openProjectCsvWindow: (file: ProjectFileEntry) => void | Promise<unknown>;
  onProjectDocumentPointerDrag: (file: ProjectFileEntry, kind: ExplorerCanvasNodeKind, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") => void;
  applyEditorCommand: (command: EditorCommand) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void | Promise<unknown>;
  editCanvasNodeAction: (node: CanvasNode) => void;
  closeDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void; saveDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId) => void | Promise<unknown>; updateDetachedMarkdownWindow: (panelId: MarkdownWindowPanelId, value: string) => void; openMarkdownFileLink: (href: string, sourceFilePath: string | undefined, context: import("@/features/mermaid-editor/lib/project-resource-open").WorkspaceWindowPlacementAnchor) => boolean;
  closeDetachedBrowserWindow: (panelId: BrowserWindowPanelId) => void;
  closeDetachedHtmlWindow: (panelId: HtmlWindowPanelId) => void; closeDetachedImageWindow: (panelId: ImageWindowPanelId) => void; navigateDetachedImageWindow: (panelId: ImageWindowPanelId, direction: -1 | 1) => void;
  closeDetachedTextWindow: (panelId: TextWindowPanelId) => void; closeDetachedCsvWindow: (panelId: CsvWindowPanelId) => void;
  saveDetachedTextWindow: (panelId: TextWindowPanelId) => void | Promise<unknown>; saveDetachedCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>;
  updateDetachedTextWindow: (panelId: TextWindowPanelId, value: string) => void; updateDetachedCsvWindow: (panelId: CsvWindowPanelId, value: string) => void;
  undoDetachedCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>; redoDetachedCsvWindow: (panelId: CsvWindowPanelId) => void | Promise<unknown>;
  setDetachedCsvHeaderMode: (panelId: CsvWindowPanelId, mode: DetachedCsvWindow["headerMode"]) => void;
  onDetachedMarkdownSelectionChange: (panelId: MarkdownWindowPanelId, selection: RuntimeAgentTextSelection | null) => void;
  markdownFoldBindingFor: (file: RuntimeFileRef) => { foldState: MarkdownFoldSnapshot | null | undefined; onFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void };
  onStatus: (message: string) => void; onAgentActivityChange: (activity: import("@/features/mermaid-editor/components/agent/agent-workspace-types").AgentWorkspaceActivity) => void;
};

export function EditorWorkspacePanels({
  runtime, documentKind,
  leftCollapsed, rightCollapsed,
  agentOpen, agentDocumentBridge, terminalOpen, detachedTerminalWindows, themeSettingsOpen,
  activeWorkspacePanel, fullscreenWorkspacePanel, graph,
  selection, projectWorkspace,
  projectFiles, projectResourceStatuses, explorerTreeState,
  onExplorerTreeStateChange, projectBusy,
  fileRef,
  terminalCwd, terminalContextKey,
  activeTheme,
  editingThemeId,
  editingCustomTheme,
  themeDraftDirty,
  terminalTheme,
  detachedMarkdownWindows, detachedBrowserWindows, detachedHtmlWindows, detachedImageWindows, detachedTextWindows, detachedCsvWindows,
  markdownSpellcheckEnabled, markdownContentWidth, markdownTextScale, workspaceTitlebarAutoHide, onMarkdownTextScaleChange,
  bringWorkspacePanelToFront,
  workspacePanelStackPosition,
  workspacePanelWindowState,
  setWorkspacePanelWindowState,
  closeWorkspacePanel,
  newTerminalWindow, openTerminalWindow, closeTerminalWindow,
  hideThemeSettings,
  discardThemeSettings,
  applyThemeSettings,
  previewTheme,
  openProjectFolder,
  refreshProjectWorkspace,
  createProjectFile, createProjectDirectory, renameProjectResource,
  moveProjectFile, moveProjectResources, reorderProjectResources, copyProjectResources, importProjectResources,
  deleteProjectResources, showProjectResourceInFileManager,
  openProjectFile,
  openProjectMarkdownWindow,
  openProjectHtmlWindow, openProjectImageWindow, openProjectTextWindow, openProjectCsvWindow,
  onProjectDocumentPointerDrag,
  applyEditorCommand,
  executeCanvasNodeAction,
  editCanvasNodeAction,
  closeDetachedMarkdownWindow,
  closeDetachedBrowserWindow,
  closeDetachedHtmlWindow, closeDetachedImageWindow, navigateDetachedImageWindow,
  closeDetachedTextWindow, closeDetachedCsvWindow, saveDetachedTextWindow, saveDetachedCsvWindow,
  updateDetachedTextWindow, updateDetachedCsvWindow, undoDetachedCsvWindow, redoDetachedCsvWindow, setDetachedCsvHeaderMode,
  saveDetachedMarkdownWindow,
  updateDetachedMarkdownWindow, openMarkdownFileLink, markdownFoldBindingFor,
  onDetachedMarkdownSelectionChange, onStatus, onAgentActivityChange
}: EditorWorkspacePanelsProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 isolate", fullscreenWorkspacePanel ? EDITOR_CHROME_CLASSES.fullscreenWorkspaceLayer : EDITOR_CHROME_CLASSES.workspaceLayer)} data-layer-group="workspace-windows" data-workspace-fullscreen-panel={fullscreenWorkspacePanel || undefined}>
      <ExplorerWorkspaceWindow
        open={!leftCollapsed}
        runtimeKind={runtime.kind}
        titlebarAutoHide={workspaceTitlebarAutoHide}
        active={activeWorkspacePanel === "explorer"}
        stackIndex={workspacePanelStackPosition("explorer")}
        onFocusPanel={() => bringWorkspacePanelToFront("explorer")}
        windowState={workspacePanelWindowState("explorer")}
        onWindowStateChange={(state) => setWorkspacePanelWindowState("explorer", state)}
        onClose={() => closeWorkspacePanel("explorer")}
        projectWorkspace={projectWorkspace} projectFiles={projectFiles}
        resourceStatuses={projectResourceStatuses} treeState={explorerTreeState}
        onTreeStateChange={onExplorerTreeStateChange}
        currentFileRef={fileRef} projectBusy={projectBusy}
        onOpenProject={openProjectFolder} onRefreshProject={refreshProjectWorkspace}
        onCreateProjectFile={createProjectFile} onCreateProjectDirectory={createProjectDirectory} onRenameProjectResource={renameProjectResource}
        onMoveProjectFile={moveProjectFile} onMoveProjectResources={moveProjectResources} onReorderProjectResources={reorderProjectResources}
        onCopyProjectResources={copyProjectResources} onImportProjectResources={importProjectResources} onDeleteProjectResources={deleteProjectResources}
        onShowProjectResourceInFileManager={showProjectResourceInFileManager}
        onOpenProjectFile={openProjectFile} onOpenProjectMarkdownWindow={openProjectMarkdownWindow}
        onOpenProjectHtmlWindow={openProjectHtmlWindow} onOpenProjectImageWindow={openProjectImageWindow}
        onOpenProjectTextWindow={openProjectTextWindow} onOpenProjectCsvWindow={openProjectCsvWindow}
        onExportProjectMarkdown={(file) => runtime.exportMarkdownFolder({ sourcePath: file.path, ...(projectWorkspace?.rootPath ? { projectRoot: projectWorkspace.rootPath } : {}) })} onProjectDocumentPointerDrag={onProjectDocumentPointerDrag}
        onStatus={onStatus}
      />
      <AgentTerminalWorkspacePanels
        runtime={runtime} agentOpen={agentOpen}
        terminalOpen={terminalOpen}
        agentDocumentBridge={agentDocumentBridge}
        agentProjectRoot={projectWorkspace?.rootPath}
        detachedTerminalWindows={detachedTerminalWindows}
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
        newTerminalWindow={newTerminalWindow} openTerminalWindow={openTerminalWindow} closeTerminalWindow={closeTerminalWindow}
        onStatus={onStatus} onAgentActivityChange={onAgentActivityChange}
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
        textWindows={detachedTextWindows} csvWindows={detachedCsvWindows}
        markdownContentWidth={markdownContentWidth} markdownTextScale={markdownTextScale}
        workspaceTitlebarAutoHide={workspaceTitlebarAutoHide} onMarkdownTextScaleChange={onMarkdownTextScaleChange}
        activePanel={activeWorkspacePanel}
        bringPanelToFront={bringWorkspacePanelToFront}
        panelStackPosition={workspacePanelStackPosition}
        panelWindowState={workspacePanelWindowState}
        setPanelWindowState={setWorkspacePanelWindowState}
        closeMarkdownWindow={closeDetachedMarkdownWindow}
        saveMarkdownWindow={saveDetachedMarkdownWindow}
        updateMarkdownWindow={updateDetachedMarkdownWindow} openMarkdownFileLink={openMarkdownFileLink} markdownFoldBindingFor={markdownFoldBindingFor}
        onMarkdownSelectionChange={onDetachedMarkdownSelectionChange}
        closeTextWindow={closeDetachedTextWindow} closeCsvWindow={closeDetachedCsvWindow}
        saveTextWindow={saveDetachedTextWindow} saveCsvWindow={saveDetachedCsvWindow}
        updateTextWindow={updateDetachedTextWindow} updateCsvWindow={updateDetachedCsvWindow}
        undoCsvWindow={undoDetachedCsvWindow} redoCsvWindow={redoDetachedCsvWindow} setCsvHeaderMode={setDetachedCsvHeaderMode}
      />
      <NativeWebWorkspaceWindows
        runtime={runtime}
        browserWindows={detachedBrowserWindows}
        htmlWindows={detachedHtmlWindows} imageWindows={detachedImageWindows}
        titlebarAutoHide={workspaceTitlebarAutoHide}
        activePanel={activeWorkspacePanel}
        bringPanelToFront={bringWorkspacePanelToFront}
        panelStackPosition={workspacePanelStackPosition}
        panelWindowState={workspacePanelWindowState}
        setPanelWindowState={setWorkspacePanelWindowState}
        closeBrowserWindow={closeDetachedBrowserWindow}
        closeHtmlWindow={closeDetachedHtmlWindow} closeImageWindow={closeDetachedImageWindow} navigateImageWindow={navigateDetachedImageWindow}
        onStatus={onStatus}
      />
    </div>
  );
}
