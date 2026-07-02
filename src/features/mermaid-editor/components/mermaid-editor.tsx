import { useEffect, useMemo, useRef, useState } from "react";

import { MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { useEditorAiCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-ai-commands";
import { useEditorCommandActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions";
import { useEditorDesktopEvents } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events";
import { useEditorDraftAutosave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave";
import { useEditorEmbeddedBrowserHandles } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-embedded-browser-handles";
import { EditorFloatingChrome } from "@/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome";
import { EditorOverlays } from "@/features/mermaid-editor/components/mermaid-editor/editor-overlays";
import { EditorWorkspaceSurface } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface";
import { EditorWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels";
import { useEditorDocumentModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-model";
import { useEditorFileWorkflow } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { useEditorKeyboardShortcuts } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts";
import { useEditorOverlayState, useUnsavedPromptEscape } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-overlay-state";
import { useEditorRecentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-recent-actions";
import { useEditorThemeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model";
import { useEditorWorkspacePanelActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-workspace-panel-actions";
import { useEditorWindowActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import { createEditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorSnapshot } from "@/features/mermaid-editor/lib/editor-types";
import { EditorMotionProvider } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";
import {
  useWorkspacePanels,
  type DetachedBrowserWindow,
  type DetachedMarkdownWindow
} from "@/features/mermaid-editor/lib/workspace-panels";
import { useGlobalOverlayActivity } from "@/lib/overlay-layers";

export function MermaidEditor() {
  useDisableNativeContextMenu();
  const globalDomOverlayActive = useGlobalOverlayActivity();

  const runtime = useMemo(() => createEditorRuntime(), []);
  const initial = useMemo(loadInitialState, []);
  const {
    documentKind,
    setDocumentKind,
    source,
    setSource,
    canvasDocument,
    setCanvasDocument,
    graph,
    setGraph,
    diagramType,
    setDiagramType,
    editableKind,
    setEditableKind,
    selection,
    setSelection,
    viewport,
    setViewport,
    edgeRouting,
    setEdgeRouting,
    layoutMode,
    setLayoutMode,
    mode,
    setMode,
    spacePanning,
    setSpacePanning,
    history,
    setHistory,
    clipboard,
    setClipboard,
    diagnostics,
    setDiagnostics,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    workspaceView,
    setWorkspaceView,
    viewFilters,
    setViewFilters,
    fileName,
    setFileName,
    fileTheme,
    setFileTheme,
    fileRef,
    setFileRef,
    recentFiles,
    setRecentFiles,
    projectWorkspace,
    setProjectWorkspace,
    projectBusy,
    setProjectBusy,
    lastSavedDocument,
    setLastSavedDocument,
    imageDisplaySrcBySrc,
    currentDocument,
    previewSource,
    hiddenViewFilters,
    projectFiles,
    mermaidEdgeRoutes,
    terminalCwd,
    isDirty,
    isCanvasEditable,
    canvasViewTooltip
  } = useEditorDocumentModel({ initial, runtime });
  const {
    status,
    setStatus,
    fileMenuOpen,
    setFileMenuOpen,
    fileWorkflowError,
    setFileWorkflowError,
    unsavedPrompt,
    setUnsavedPrompt,
    secondaryActionsOpen,
    viewFiltersOpen,
    themeSettingsOpen,
    nodeActionEditor,
    setNodeActionEditor,
    fileDropFeedback,
    setFileDropFeedback,
    browserDomOverlayActive,
    updateFileMenuOpen,
    updateViewFiltersOpen,
    updateSecondaryActionsOpen,
    openThemeSettingsOverlay,
    closeThemeSettingsOverlay,
    closeFloatingOverlays: closeFloatingOverlayState
  } = useEditorOverlayState({ globalDomOverlayActive });
  const {
    themeId,
    setThemeId,
    customTheme,
    setCustomTheme,
    preferences,
    setPreferences,
    activeTheme,
    compiledTheme,
    resolvedMotion,
    beginThemeSettings,
    updatePreferences,
    previewTheme,
    cancelThemeSettings: cancelThemeSettingsDraft,
    saveThemeSettings: saveThemeSettingsDraft
  } = useEditorThemeModel({ initial, setFileTheme, setStatus });
  const [draftPersistenceReady, setDraftPersistenceReady] = useState(runtime.kind !== "desktop");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [detachedMarkdownWindows, setDetachedMarkdownWindows] = useState<DetachedMarkdownWindow[]>([]);
  const [detachedBrowserWindows, setDetachedBrowserWindows] = useState<DetachedBrowserWindow[]>([]);
  const { setEmbeddedBrowserHandle, closeEmbeddedBrowser, closeAllEmbeddedBrowsers } = useEditorEmbeddedBrowserHandles();
  const {
    activeWorkspacePanel,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    workspacePanelStackPosition,
    workspacePanelWindowState
  } = useWorkspacePanels({
    leftCollapsed,
    rightCollapsed,
    terminalOpen,
    documentKind,
    detachedMarkdownWindows,
    detachedBrowserWindows
  });
  const { openWorkspacePanel, closeWorkspacePanel } = useEditorWorkspacePanelActions({
    bringWorkspacePanelToFront,
    setWorkspacePanelWindowState,
    setLeftCollapsed,
    setRightCollapsed,
    setTerminalOpen
  });
  const { recentActions, recordRecentAction } = useEditorRecentActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceSurfaceRef = useRef<HTMLDivElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const lastWindowFocusAtRef = useRef(Date.now());
  const isDirtyRef = useRef(false);
  const currentDocumentRef = useRef("");
  const isDesktopChrome = runtime.kind === "desktop";

  useEffect(() => {
    isDirtyRef.current = isDirty;
    currentDocumentRef.current = currentDocument;
  }, [currentDocument, isDirty]);

  const {
    canvasLiveState,
    updateCanvasLiveState,
    recordCanvasPointerWorld,
    applyEditorCommand,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    snapshot,
    updateViewFilter,
    resetViewFilters,
    addNode,
    addImageNode,
    createGroupFromSelection,
    updateDirection,
    updateEdgeRouting,
    updateLayoutMode,
    refreshFromSource,
    performDelete,
    performUndo,
    performRedo,
    performCopy,
    performPaste,
    changeWorkspaceView,
    changeToolMode,
    syncAutoLayout,
    resetCanvasView
  } = useEditorCommandActions({
    runtime,
    documentKind,
    source,
    canvasDocument,
    graph,
    history,
    clipboard,
    selection,
    viewport,
    edgeRouting,
    layoutMode,
    workspaceView,
    viewFilters,
    fileTheme,
    fileRef,
    isCanvasEditable,
    mode,
    editableKind,
    resolvedMotion,
    sourceEditBaseRef,
    sourceEditTimerRef,
    lastWindowFocusAtRef,
    setDocumentKind,
    setSource,
    setCanvasDocument,
    setGraph,
    setDiagramType,
    setEditableKind,
    setMode,
    setClipboard,
    setHistory,
    setSelection,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setWorkspaceView,
    setViewFilters,
    setFileTheme,
    setThemeId,
    setCustomTheme,
    setDiagnostics,
    setStatus,
    setFileWorkflowError,
    recordRecentAction
  });

  function openThemeSettings() {
    beginThemeSettings(); openThemeSettingsOverlay();
  }

  function cancelThemeSettings() {
    cancelThemeSettingsDraft(); closeThemeSettingsOverlay();
  }

  function saveThemeSettings() {
    saveThemeSettingsDraft(); closeThemeSettingsOverlay();
  }

  const {
    showFileWorkflowError,
    resolveUnsavedPrompt,
    prepareWindowClose,
    applyLoadedDocument,
    applyStoredEditorState,
    openMermaidFile,
    newMermaidFile,
    newMarkdownFile,
    newCanvasFile,
    openFallbackFile,
    openRuntimeFileRequest,
    openProjectFolder,
    refreshProjectWorkspace,
    closeProjectWorkspace,
    updateBrowserFileDragFeedback,
    handleBrowserFileDragLeave,
    handleBrowserFileDrop,
    handleRuntimeFileDropRequest,
    openRecentFile,
    openProjectFile,
    saveMermaidFile,
    saveMermaidFileAs
  } = useEditorFileWorkflow({
    runtime,
    fileInputRef,
    workspaceSurfaceRef,
    isDirtyRef,
    documentKind,
    source,
    canvasDocument,
    graph,
    diagramType,
    editableKind,
    viewport,
    edgeRouting,
    layoutMode,
    selection,
    diagnostics,
    leftCollapsed,
    rightCollapsed,
    workspaceView,
    viewFilters,
    fileName,
    fileTheme,
    fileRef,
    recentFiles,
    projectWorkspace,
    lastSavedDocument,
    themeId,
    customTheme,
    preferences,
    currentDocument,
    canvasLiveState,
    isCanvasEditable,
    setDocumentKind,
    setSource,
    setCanvasDocument,
    setGraph,
    setDiagramType,
    setEditableKind,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setSelection,
    setDiagnostics,
    setHistory,
    setLeftCollapsed,
    setRightCollapsed,
    setWorkspaceView,
    setViewFilters,
    setFileName,
    setFileTheme,
    setFileRef,
    setRecentFiles,
    setProjectWorkspace,
    setProjectBusy,
    setLastSavedDocument,
    setFileMenuOpen,
    setFileWorkflowError,
    setUnsavedPrompt,
    setThemeId,
    setCustomTheme,
    setPreferences,
    setStatus,
    setFileDropFeedback,
    flushSourceHistory,
    applyCanvasDocument,
    applyEditorCommand,
    recordRecentAction
  });

  const { startDesktopWindowDragHandle, toggleDesktopWindowMaximizeHandle } = useEditorDesktopEvents({
    runtime,
    lastWindowFocusAtRef,
    isDirtyRef,
    currentDocumentRef,
    openRuntimeFileRequest,
    handleRuntimeFileDropRequest,
    prepareWindowClose,
    beforeDesktopWindowClose: closeAllEmbeddedBrowsers,
    applyLoadedDocument,
    applyStoredEditorState,
    showFileWorkflowError,
    setDraftPersistenceReady,
    setPreferences,
    setRecentFiles,
    setProjectWorkspace,
    setProjectBusy,
    setFileName,
    setFileRef,
    setLastSavedDocument,
    setStatus
  });

  const {
    openProjectMarkdownWindow,
    updateDetachedMarkdownWindow,
    closeDetachedMarkdownWindow,
    saveDetachedMarkdownWindow,
    updateDetachedBrowserWindow,
    closeDetachedBrowserWindow,
    recordBrowserWebviewError,
    executeCanvasNodeAction,
    executeNodeActionDraft,
    editCanvasNodeAction,
    saveCanvasNodeAction
  } = useEditorWindowActions({
    runtime,
    fileRef,
    projectWorkspace,
    detachedMarkdownWindows,
    setDetachedMarkdownWindows,
    setDetachedBrowserWindows,
    setRecentFiles,
    setNodeActionEditor,
    setStatus,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    showFileWorkflowError,
    openRuntimeFileRequest,
    openInspectorPanel: () => openWorkspacePanel("inspector"),
    closeEmbeddedBrowser,
    applyEditorCommand,
    recordRecentAction
  });

  useEditorAiCommands({
    runtime,
    sourceEditBaseRef,
    isDirtyRef,
    source,
    currentDocument,
    documentKind,
    graph,
    selection,
    viewport,
    fileName,
    fileRef,
    fileTheme,
    isDirty,
    diagramType,
    editableKind,
    mode,
    workspaceView,
    edgeRouting,
    layoutMode,
    diagnostics,
    viewFilters,
    canvasLiveState,
    recentActions,
    preferences,
    snapshot,
    flushSourceHistory,
    recordRecentAction,
    setHistory,
    setSource,
    setGraph,
    setDiagramType,
    setEditableKind,
    setViewport,
    setEdgeRouting,
    setLayoutMode,
    setFileTheme,
    setThemeId,
    setCustomTheme,
    setWorkspaceView,
    setSelection,
    setDiagnostics,
    setFileName,
    setFileRef,
    setRecentFiles,
    setLastSavedDocument,
    setStatus
  });

  useUnsavedPromptEscape(unsavedPrompt, resolveUnsavedPrompt);

  useEditorDraftAutosave({
    ready: draftPersistenceReady,
    runtime,
    documentKind,
    source,
    canvasDocument,
    graph,
    viewport,
    edgeRouting,
    layoutMode,
    leftCollapsed,
    rightCollapsed,
    workspaceView,
    viewFilters,
    fileName,
    fileTheme,
    fileRef,
    recentFiles,
    projectWorkspace,
    lastSavedDocument,
    themeId,
    customTheme,
    preferences
  });

  function closeFloatingOverlays() {
    return closeFloatingOverlayState({ onCancelThemeSettings: cancelThemeSettingsDraft });
  }

  useEditorKeyboardShortcuts({
    graph,
    selection,
    isCanvasEditable,
    closeFloatingOverlays,
    saveMermaidFile,
    saveMermaidFileAs,
    createGroupFromSelection,
    editCanvasNodeAction,
    executeCanvasNodeAction,
    performRedo,
    performUndo,
    performCopy,
    performPaste,
    performDelete,
    setSpacePanning,
    applyEditorCommand
  });

  const nodeActionEditorNode = nodeActionEditor ? graph.nodes.find((node) => node.id === nodeActionEditor.nodeId) : undefined;

  return (
    <EditorMotionProvider value={resolvedMotion}>
    <TooltipProvider delayDuration={180}>
      <input ref={fileInputRef} type="file" accept=".mmd,.mermaid,.md,.markdown,.canvas.json,text/plain,application/json" className="hidden" onChange={openFallbackFile} />
      <main
        className="relative h-screen overflow-hidden bg-background"
        onDragEnter={updateBrowserFileDragFeedback}
        onDragOver={updateBrowserFileDragFeedback}
        onDragLeave={handleBrowserFileDragLeave}
        onDrop={handleBrowserFileDrop}
      >
        <h1 className="sr-only">Mermaid Canvas Editor</h1>
        <MotionPresence
          key={`${workspaceView}:${documentKind}:${editableKind}`}
          present
          variant="workspace"
          className="absolute inset-0 z-0"
        >
        <div ref={workspaceSurfaceRef} className="h-full min-h-0">
          <EditorWorkspaceSurface
            documentKind={documentKind}
            canvasDocument={canvasDocument}
            fileRef={fileRef}
            fileName={fileName}
            runtime={runtime}
            workspaceView={workspaceView}
            isCanvasEditable={isCanvasEditable}
            graph={graph}
            selection={selection}
            viewport={viewport}
            mode={mode}
            spacePanning={spacePanning}
            viewFilters={viewFilters}
            edgeRouting={edgeRouting}
            mermaidEdgeRoutes={mermaidEdgeRoutes}
            layoutMode={layoutMode}
            imageDisplaySrcBySrc={imageDisplaySrcBySrc}
            visualTokens={compiledTheme.canvasVisualTokens}
            geometryTokens={compiledTheme.geometry}
            motion={resolvedMotion}
            source={source}
            previewSource={previewSource}
            diagnostics={diagnostics}
            mermaidThemeVariables={compiledTheme.mermaidThemeVariables}
            onCanvasDocumentChange={applyCanvasDocument}
            onStatus={setStatus}
            onMarkdownChange={applyMarkdownSource}
            onSourceChange={applySource}
            onRunSource={refreshFromSource}
            onEditorCommand={applyEditorCommand}
            onOpenNodeAction={executeCanvasNodeAction}
            onEditNodeAction={editCanvasNodeAction}
            onPointerWorldChange={recordCanvasPointerWorld}
            onLiveStateChange={updateCanvasLiveState}
          />
        </div>
        </MotionPresence>
        <EditorWorkspacePanels
          runtime={runtime}
          documentKind={documentKind}
          leftCollapsed={leftCollapsed}
          rightCollapsed={rightCollapsed}
          terminalOpen={terminalOpen}
          activeWorkspacePanel={activeWorkspacePanel}
          browserDomOverlayActive={browserDomOverlayActive}
          graph={graph}
          selection={selection}
          projectWorkspace={projectWorkspace}
          projectFiles={projectFiles}
          projectBusy={projectBusy}
          fileRef={fileRef}
          terminalCwd={terminalCwd}
          activeTheme={activeTheme}
          terminalTheme={compiledTheme.terminalTheme}
          detachedMarkdownWindows={detachedMarkdownWindows}
          detachedBrowserWindows={detachedBrowserWindows}
          bringWorkspacePanelToFront={bringWorkspacePanelToFront}
          workspacePanelStackPosition={workspacePanelStackPosition}
          workspacePanelWindowState={workspacePanelWindowState}
          setWorkspacePanelWindowState={setWorkspacePanelWindowState}
          closeWorkspacePanel={closeWorkspacePanel}
          openProjectFolder={openProjectFolder}
          refreshProjectWorkspace={refreshProjectWorkspace}
          closeProjectWorkspace={closeProjectWorkspace}
          openProjectFile={openProjectFile}
          openProjectMarkdownWindow={openProjectMarkdownWindow}
          applyEditorCommand={applyEditorCommand}
          executeCanvasNodeAction={executeCanvasNodeAction}
          editCanvasNodeAction={editCanvasNodeAction}
          closeDetachedMarkdownWindow={closeDetachedMarkdownWindow}
          saveDetachedMarkdownWindow={saveDetachedMarkdownWindow}
          updateDetachedMarkdownWindow={updateDetachedMarkdownWindow}
          closeDetachedBrowserWindow={closeDetachedBrowserWindow}
          updateDetachedBrowserWindow={updateDetachedBrowserWindow}
          onStatus={setStatus}
          onBrowserError={recordBrowserWebviewError}
          onBrowserHandleChange={setEmbeddedBrowserHandle}
        />
        <EditorFloatingChrome
          runtime={runtime}
          isDesktopChrome={isDesktopChrome}
          documentKind={documentKind}
          editableKind={editableKind}
          workspaceView={workspaceView}
          canvasViewTooltip={canvasViewTooltip}
          fileMenuOpen={fileMenuOpen}
          viewFiltersOpen={viewFiltersOpen}
          secondaryActionsOpen={secondaryActionsOpen}
          leftCollapsed={leftCollapsed}
          rightCollapsed={rightCollapsed}
          terminalOpen={terminalOpen}
          recentFiles={recentFiles}
          projectBusy={projectBusy}
          isDirty={isDirty}
          viewFilters={viewFilters}
          hiddenViewFilters={hiddenViewFilters}
          isCanvasEditable={isCanvasEditable}
          direction={graph.direction}
          edgeRouting={edgeRouting}
          layoutMode={layoutMode}
          preferences={preferences}
          mode={mode}
          onFileMenuOpenChange={updateFileMenuOpen}
          onViewFiltersOpenChange={updateViewFiltersOpen}
          onSecondaryActionsOpenChange={updateSecondaryActionsOpen}
          onNewMermaidFile={newMermaidFile}
          onNewMarkdownFile={newMarkdownFile}
          onNewCanvasFile={newCanvasFile}
          onOpenFile={openMermaidFile}
          onOpenRecent={openRecentFile}
          onOpenProject={openProjectFolder}
          onSaveFile={saveMermaidFile}
          onSaveAs={saveMermaidFileAs}
          onStartDesktopWindowDrag={startDesktopWindowDragHandle}
          onToggleDesktopWindowMaximize={toggleDesktopWindowMaximizeHandle}
          onWorkspaceViewChange={changeWorkspaceView}
          onViewFiltersChange={updateViewFilter}
          onResetViewFilters={resetViewFilters}
          onOpenWorkspacePanel={openWorkspacePanel}
          onAddNode={addNode}
          onAddImageNode={addImageNode}
          onCreateGroup={() => createGroupFromSelection()}
          onDirectionChange={updateDirection}
          onEdgeRoutingChange={updateEdgeRouting}
          onLayoutModeChange={updateLayoutMode}
          onPreferencesChange={updatePreferences}
          onRefreshSource={refreshFromSource}
          onSyncAutoLayout={syncAutoLayout}
          onResetView={resetCanvasView}
          onOpenThemeSettings={openThemeSettings}
          onToolModeChange={changeToolMode}
        />
        <EditorOverlays
          fileDropFeedback={fileDropFeedback}
          fileWorkflowError={fileWorkflowError}
          unsavedPrompt={unsavedPrompt}
          nodeActionEditorNode={nodeActionEditorNode}
          projectFiles={projectFiles}
          status={status}
          statusMessages={preferences.statusMessages}
          themeSettingsOpen={themeSettingsOpen}
          themeId={themeId}
          customTheme={customTheme}
          activeTheme={activeTheme}
          onCloseFileWorkflowError={() => setFileWorkflowError(null)}
          onResolveUnsavedPrompt={resolveUnsavedPrompt}
          onCloseNodeActionEditor={() => setNodeActionEditor(null)}
          onSaveCanvasNodeAction={saveCanvasNodeAction}
          onExecuteNodeActionDraft={executeNodeActionDraft}
          onPreviewTheme={previewTheme}
          onCancelThemeSettings={cancelThemeSettings}
          onSaveThemeSettings={saveThemeSettings}
        />
      </main>
    </TooltipProvider>
    </EditorMotionProvider>
  );
}
