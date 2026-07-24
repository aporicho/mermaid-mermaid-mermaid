import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { useAgentSession } from "@/features/mermaid-editor/components/agent/use-agent-session";
import { useEditorAgentDocuments } from "@/features/mermaid-editor/components/agent/use-editor-agent-documents";
import { useEditorCommandActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions";
import { useEditorDesktopEvents } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events";
import { useEditorDraftAutosave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave";
import { EditorFloatingChrome } from "@/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome";
import { EditorOverlays } from "@/features/mermaid-editor/components/mermaid-editor/editor-overlays";
import { EditorWorkspaceSurface } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface";
import { EditorWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels";
import { useEditorDocumentModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-model";
import { useEditorFileWorkflow } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { useEditorExplorerTreeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-explorer-tree-model";
import { useEditorKeyboardShortcuts } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts";
import { useEditorOverlayState, useUnsavedPromptEscape } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-overlay-state";
import { useEditorRecentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-recent-actions";
import { useEditorThemeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model";
import { useEditorWorkspacePanelActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-workspace-panel-actions";
import { useEditorWindowActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions";
import { useMarkdownDocumentPreviews } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-document-previews";
import { useLinkedProjectDocuments } from "@/features/mermaid-editor/components/mermaid-editor/use-linked-project-documents";
import { useMarkdownFoldPersistence } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-fold-persistence";
import { useProjectFileActions } from "@/features/mermaid-editor/components/mermaid-editor/use-project-file-actions";
import { useProjectFileHotReload } from "@/features/mermaid-editor/components/mermaid-editor/use-project-file-hot-reload";
import { createMarkdownDocumentDropHandlers } from "@/features/mermaid-editor/components/mermaid-editor/markdown-document-drop";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import { createEditorRuntime, type RuntimeAgentTextSelection } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorSnapshot } from "@/features/mermaid-editor/lib/editor-types";
import { EditorMotionProvider } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";
import { htmlWindowPanelId, imageWindowPanelId, markdownWindowPanelId, useWorkspacePanels, type DetachedBrowserWindow, type DetachedHtmlWindow, type DetachedImageWindow, type DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";
import { OverlayLayerScopeProvider } from "@/lib/overlay-layer-context";
import { useCanvasNodeGeometryModel } from "@/features/mermaid-editor/components/mermaid-editor/use-canvas-node-geometry-model";
import { useCsvTableFileSync } from "@/features/mermaid-editor/components/mermaid-editor/use-csv-table-file-sync";
import { normalizeFileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import { clampMarkdownTextScale, markdownTextScalePercent } from "@/features/mermaid-editor/lib/markdown-text-scale";
import { imageViewerWatchPath } from "@/features/mermaid-editor/lib/image-viewer";
export function MermaidEditor() {
  useDisableNativeContextMenu();
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
    documentGenerationRef, beginDocumentSession, refreshImageAssets,
    imageDisplaySrcBySrc, currentDocument, previewSource,
    hiddenViewFilters, projectFiles, terminalCwd, terminalContextKey,
    isDirty, isCanvasEditable, canvasViewTooltip
  } = useEditorDocumentModel({ initial, runtime });
  const { explorerTreeState, setExplorerTreeState, activeExplorerTreeState, updateExplorerTreeState } = useEditorExplorerTreeModel({ initialState: initial.explorerTreeState, projectWorkspace });
  const { previewByNodeId: markdownDocumentPreviewByNodeId, requestPreview: requestMarkdownDocumentPreview,
    updatePreviewFromText: updateMarkdownDocumentPreviewFromText, markPreviewMissing: markMarkdownDocumentPreviewMissing } = useMarkdownDocumentPreviews({ runtime, fileRef, projectWorkspace });
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
    nodeActionEditor,
    setNodeActionEditor,
    fileDropFeedback,
    setFileDropFeedback,
    updateFileMenuOpen,
    updateViewFiltersOpen,
    updateSecondaryActionsOpen,
    closeFloatingOverlays: closeFloatingOverlayState
  } = useEditorOverlayState();
  const {
    themeId,
    setThemeId,
    customTheme,
    setCustomTheme,
    editingThemeId,
    editingCustomTheme,
    themeDraftDirty,
    preferences,
    setPreferences,
    activeTheme,
    compiledTheme,
    fontRevision,
    resolvedMotion,
    beginThemeSettings,
    updatePreferences,
    previewTheme,
    discardThemeSettings,
    saveThemeSettings: saveThemeSettingsDraft
  } = useEditorThemeModel({ initial, setStatus });
  const { spec: canvasNodeGeometrySpec, routes: mermaidEdgeRoutes } = useCanvasNodeGeometryModel({ compiledTheme, fontRevision, edgeRouting, graph });
  const [draftPersistenceReady, setDraftPersistenceReady] = useState(runtime.kind !== "desktop");
  const [agentOpen, setAgentOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [detachedMarkdownWindows, setDetachedMarkdownWindows] = useState<DetachedMarkdownWindow[]>([]); const [detachedBrowserWindows, setDetachedBrowserWindows] = useState<DetachedBrowserWindow[]>([]); const [detachedHtmlWindows, setDetachedHtmlWindows] = useState<DetachedHtmlWindow[]>([]); const [detachedImageWindows, setDetachedImageWindows] = useState<DetachedImageWindow[]>([]);
  const [agentTextSelection, setAgentTextSelection] = useState<RuntimeAgentTextSelection | null>(null);
  const [detachedAgentSelections, setDetachedAgentSelections] = useState<Record<string, RuntimeAgentTextSelection | null>>({});
  const markdownFolds = useMarkdownFoldPersistence({ runtime, projectWorkspace, currentFile: fileRef, detachedMarkdownWindows, onStatus: setStatus });
  const {
    activeWorkspacePanel, fullscreenWorkspacePanel,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    workspacePanelStackPosition,
    workspacePanelWindowState
  } = useWorkspacePanels({
    leftCollapsed, rightCollapsed, agentOpen, terminalOpen, themeSettingsOpen, documentKind,
    detachedMarkdownWindows, detachedBrowserWindows, detachedHtmlWindows, detachedImageWindows
  });
  const { openWorkspacePanel, closeWorkspacePanel } = useEditorWorkspacePanelActions({
    bringWorkspacePanelToFront,
    setWorkspacePanelWindowState,
    setLeftCollapsed,
    setRightCollapsed,
    setAgentOpen,
    setTerminalOpen
  });
  const { recordRecentAction } = useEditorRecentActions();
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
    fileRef,
    isCanvasEditable,
    mode,
    editableKind,
    resolvedMotion,
    nodeGeometrySpec: canvasNodeGeometrySpec,
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
    setDiagnostics,
    setStatus,
    setFileWorkflowError,
    recordRecentAction
  });
  function openThemeSettings() {
    beginThemeSettings();
    setThemeSettingsOpen(true);
    bringWorkspacePanelToFront("theme");
  }
  function hideThemeSettings() {
    setWorkspacePanelWindowState("theme", "normal");
    setThemeSettingsOpen(false);
  }
  function saveThemeSettings() {
    saveThemeSettingsDraft();
  }
  const showCsvFileWorkflowError = useCallback((error: unknown, message = "CSV 文件操作失败。") => {
    setFileWorkflowError(normalizeFileWorkflowError(error, message));
  }, [setFileWorkflowError]);
  const { flushPendingWrites: flushLinkedFileWrites, discardPendingWrites: discardLinkedFileWrites, reloadExternalFiles: reloadExternalCsvFiles } = useCsvTableFileSync({ runtime, graph, setGraph, fileRef, projectWorkspace, documentGenerationRef, layoutMode, nodeGeometrySpec: canvasNodeGeometrySpec, showFileWorkflowError: showCsvFileWorkflowError });
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
    fileName, fileRef,
    recentFiles,
    projectWorkspace,
    explorerTreeState,
    lastSavedDocument, documentGenerationRef,
    themeId,
    customTheme,
    preferences,
    currentDocument,
    canvasLiveState,
    isCanvasEditable,
    nodeGeometrySpec: canvasNodeGeometrySpec,
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
    setFileRef,
    setRecentFiles,
    setProjectWorkspace,
    setExplorerTreeState,
    setProjectBusy,
    setLastSavedDocument, beginDocumentSession,
    setFileMenuOpen,
    setFileWorkflowError,
    setUnsavedPrompt,
    setThemeId,
    setCustomTheme,
    setPreferences,
    setStatus,
    setFileDropFeedback,
    flushSourceHistory,
    flushLinkedFileWrites,
    discardLinkedFileWrites,
    applyCanvasDocument,
    applyEditorCommand,
    recordRecentAction
  });
  const { createProjectFile, moveProjectFile } = useProjectFileActions({ runtime, projectWorkspace, fileRef, graph, detachedMarkdownWindows, detachedHtmlWindows, detachedImageWindows, setProjectBusy, setFileRef, setFileName, setRecentFiles, setDetachedMarkdownWindows, setDetachedHtmlWindows, setDetachedImageWindows, refreshProjectWorkspace, openProjectFile, beforeMove: flushLinkedFileWrites, applyEditorCommand, onDetachedMarkdownWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = markdownWindowPanelId(sourceFile); const targetPanelId = markdownWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onDetachedHtmlWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = htmlWindowPanelId(sourceFile); const targetPanelId = htmlWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onDetachedImageWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = imageWindowPanelId(sourceFile); const targetPanelId = imageWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onMarkdownFileMoved: markdownFolds.migrateMarkdownFoldState, setStatus, showFileWorkflowError });
  const { markdownDocuments, htmlDocuments, csvTables } = useLinkedProjectDocuments({
    runtime, graph, viewport, canvasLiveState, projectWorkspace, applyEditorCommand,
    refreshProjectWorkspace, setStatus, showFileWorkflowError,
    updateMarkdownPreviewFromText: updateMarkdownDocumentPreviewFromText
  });
  const markdownDocumentDrop = createMarkdownDocumentDropHandlers({
    isCanvasEditable, workspaceView, viewport, workspaceSurfaceRef, projectWorkspace,
    addProjectMarkdownFile: markdownDocuments.addProjectMarkdownFile,
    addProjectHtmlFile: htmlDocuments.addProjectHtmlFile,
    setStatus, setFileDropFeedback, usesRuntimeFileDrops: runtime.kind === "desktop",
    external: { enter: updateBrowserFileDragFeedback, over: updateBrowserFileDragFeedback, leave: handleBrowserFileDragLeave,
      drop: handleBrowserFileDrop, runtime: handleRuntimeFileDropRequest }
  });
  const { startDesktopWindowDragHandle, toggleDesktopWindowMaximizeHandle } = useEditorDesktopEvents({
    runtime,
    lastWindowFocusAtRef,
    isDirtyRef,
    currentDocumentRef,
    openRuntimeFileRequest,
    handleRuntimeFileDropRequest: markdownDocumentDrop.runtime,
    prepareWindowClose: () => markdownFolds.flushBeforeWindowClose(prepareWindowClose),
    applyLoadedDocument,
    applyStoredEditorState,
    showFileWorkflowError,
    setDraftPersistenceReady,
    setPreferences,
    setRecentFiles,
    setProjectWorkspace,
    setExplorerTreeState,
    setProjectBusy,
    setFileName,
    setFileRef,
    setLastSavedDocument,
    setStatus
  });
  const {
    openProjectMarkdownWindow, openProjectHtmlWindow, openProjectImageWindow, openImageWindow, navigateDetachedImageWindow,
    updateDetachedMarkdownWindow,
    closeDetachedMarkdownWindow,
    closeDetachedBrowserWindow, closeDetachedHtmlWindow, closeDetachedImageWindow,
    saveDetachedMarkdownWindow,
    executeCanvasNodeAction,
    executeNodeActionDraft,
    editCanvasNodeAction,
    saveCanvasNodeAction
  } = useEditorWindowActions({
    runtime,
    fileRef,
    projectWorkspace,
    detachedMarkdownWindows, setDetachedMarkdownWindows,
    detachedBrowserWindows, setDetachedBrowserWindows,
    detachedHtmlWindows, setDetachedHtmlWindows,
    detachedImageWindows, setDetachedImageWindows,
    setRecentFiles,
    setNodeActionEditor,
    setStatus,
    bringWorkspacePanelToFront,
    removeWorkspacePanel,
    setWorkspacePanelWindowState,
    showFileWorkflowError,
    openRuntimeFileRequest,
    openInspectorPanel: () => openWorkspacePanel("inspector"),
    applyEditorCommand,
    recordRecentAction,
    onMarkdownFileSaved: updateMarkdownDocumentPreviewFromText
  });
  useProjectFileHotReload({ runtime, projectWorkspace, fileRef, currentDocumentRef,
    detachedMarkdownWindows, setDetachedMarkdownWindows, setFileRef, setStatus,
    detachedHtmlWindows, setDetachedHtmlWindows, detachedImageWindows, setDetachedImageWindows,
    applyLoadedDocument, refreshProjectWorkspace, discardLinkedFileWrites, reloadExternalCsvFiles,
    updateMarkdownPreviewFromText: updateMarkdownDocumentPreviewFromText,
    markMarkdownPreviewMissing: markMarkdownDocumentPreviewMissing,
    refreshImageAssets, showFileWorkflowError
  });
  const agentDocumentBridge = useEditorAgentDocuments({
    runtime,
    documentKind,
    source,
    currentDocument,
    canvasDocument,
    graph,
    selection,
    textSelection: agentTextSelection,
    fileName,
    fileRef,
    isDirty,
    projectWorkspace,
    projectFiles,
    documentGeneration: documentGenerationRef.current,
    detachedMarkdownWindows,
    detachedSelections: detachedAgentSelections,
    activeWorkspacePanel,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    setFileRef,
    setFileName,
    setRecentFiles,
    setLastSavedDocument,
    setDetachedMarkdownWindows,
    setWorkspaceView,
    setStatus,
    bringWorkspacePanelToFront
  });
  const agentController = useAgentSession({
    runtime,
    enabled: agentOpen,
    cwd: terminalCwd,
    projectRoot: projectWorkspace?.rootPath,
    documentBridge: agentDocumentBridge
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
    fileRef,
    recentFiles,
    projectWorkspace,
    explorerTreeState,
    lastSavedDocument,
    themeId,
    customTheme,
    preferences
  });

  const closeFloatingOverlays = closeFloatingOverlayState;

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
      <OverlayLayerScopeProvider scopeId="application" kind="application">
      <input ref={fileInputRef} type="file" accept=".mmd,.mermaid,.md,.markdown,.canvas.json,text/plain,application/json" className="hidden" onChange={openFallbackFile} />
      <main
        className="relative isolate z-0 h-screen overflow-hidden bg-background"
        onDragEnter={markdownDocumentDrop.enter}
        onDragOver={markdownDocumentDrop.over}
        onDragLeave={markdownDocumentDrop.leave}
        onDrop={markdownDocumentDrop.drop}
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
            markdownDocumentPreviewByNodeId={markdownDocumentPreviewByNodeId}
            markdownSpellcheckEnabled={preferences.markdownSpellcheckEnabled} markdownContentWidth={preferences.markdownContentWidth} markdownTextScale={preferences.markdownTextScale}
            visualTokens={compiledTheme.canvasVisualTokens}
            geometryTokens={compiledTheme.geometry}
            typography={compiledTheme.typography} markdownTokens={compiledTheme.theme.markdown}
            specialNodeTokens={compiledTheme.specialNode}
            fontRevision={fontRevision}
            motion={resolvedMotion}
            source={source}
            previewSource={previewSource}
            diagnostics={diagnostics}
            mermaidThemeVariables={compiledTheme.mermaidThemeVariables}
            onCanvasDocumentChange={applyCanvasDocument}
            onStatus={setStatus}
            onMarkdownChange={applyMarkdownSource} markdownFoldState={markdownFolds.bindingFor(fileRef).foldState} onMarkdownFoldStateChange={markdownFolds.bindingFor(fileRef).onFoldStateChange}
            onTextSelectionChange={setAgentTextSelection}
            onSourceChange={applySource}
            onRunSource={refreshFromSource}
            onEditorCommand={applyEditorCommand}
            onOpenNodeAction={executeCanvasNodeAction} onOpenCanvasImage={(request) => openImageWindow({ ...request, documentFile: fileRef, watchPath: imageViewerWatchPath(request.source, fileRef?.path) })}
            onEditNodeAction={editCanvasNodeAction}
            onPointerWorldChange={recordCanvasPointerWorld}
            onLiveStateChange={updateCanvasLiveState}
            onRequestMarkdownDocumentPreview={requestMarkdownDocumentPreview}
          />
        </div>
        </MotionPresence>
        <EditorWorkspacePanels
          runtime={runtime} documentKind={documentKind}
          leftCollapsed={leftCollapsed} rightCollapsed={rightCollapsed}
          agentOpen={agentOpen} agentController={agentController} terminalOpen={terminalOpen} themeSettingsOpen={themeSettingsOpen}
          activeWorkspacePanel={activeWorkspacePanel} fullscreenWorkspacePanel={fullscreenWorkspacePanel}
          graph={graph} selection={selection}
          projectWorkspace={projectWorkspace} projectFiles={projectFiles}
          explorerTreeState={activeExplorerTreeState} onExplorerTreeStateChange={updateExplorerTreeState}
          projectBusy={projectBusy} fileRef={fileRef}
          terminalCwd={terminalCwd} terminalContextKey={terminalContextKey} activeTheme={activeTheme} editingThemeId={editingThemeId}
          editingCustomTheme={editingCustomTheme} themeDraftDirty={themeDraftDirty}
          terminalTheme={compiledTheme.terminalTheme} detachedMarkdownWindows={detachedMarkdownWindows} detachedBrowserWindows={detachedBrowserWindows} detachedHtmlWindows={detachedHtmlWindows} detachedImageWindows={detachedImageWindows}
          markdownSpellcheckEnabled={preferences.markdownSpellcheckEnabled} markdownContentWidth={preferences.markdownContentWidth}
          markdownTextScale={preferences.markdownTextScale} workspaceTitlebarAutoHide={preferences.workspaceTitlebarAutoHide}
          onMarkdownTextScaleChange={(value) => { const markdownTextScale = clampMarkdownTextScale(value); updatePreferences({ ...preferences, markdownTextScale }, `Markdown 正文字号已设为 ${markdownTextScalePercent(markdownTextScale)}。`); }}
          bringWorkspacePanelToFront={bringWorkspacePanelToFront} workspacePanelStackPosition={workspacePanelStackPosition}
          workspacePanelWindowState={workspacePanelWindowState} setWorkspacePanelWindowState={setWorkspacePanelWindowState}
          closeWorkspacePanel={closeWorkspacePanel}
          hideThemeSettings={hideThemeSettings} discardThemeSettings={discardThemeSettings}
          applyThemeSettings={saveThemeSettings} previewTheme={previewTheme}
          openProjectFolder={openProjectFolder} refreshProjectWorkspace={refreshProjectWorkspace}
          createProjectFile={createProjectFile} moveProjectFile={moveProjectFile} openProjectFile={openProjectFile}
          openProjectMarkdownWindow={openProjectMarkdownWindow} openProjectHtmlWindow={openProjectHtmlWindow} openProjectImageWindow={openProjectImageWindow} onProjectDocumentPointerDrag={markdownDocumentDrop.pointer}
          applyEditorCommand={applyEditorCommand}
          executeCanvasNodeAction={executeCanvasNodeAction}
          editCanvasNodeAction={editCanvasNodeAction}
          closeDetachedMarkdownWindow={closeDetachedMarkdownWindow} closeDetachedBrowserWindow={closeDetachedBrowserWindow}
          closeDetachedHtmlWindow={closeDetachedHtmlWindow} closeDetachedImageWindow={closeDetachedImageWindow} navigateDetachedImageWindow={navigateDetachedImageWindow} saveDetachedMarkdownWindow={saveDetachedMarkdownWindow}
          updateDetachedMarkdownWindow={updateDetachedMarkdownWindow} markdownFoldBindingFor={markdownFolds.bindingFor}
          onDetachedMarkdownSelectionChange={(panelId, selection) => setDetachedAgentSelections((current) => ({ ...current, [panelId]: selection }))}
          onStatus={setStatus}
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
          agentOpen={agentOpen}
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
          onAddTableNode={csvTables.openDialog}
          onAddImageNode={addImageNode}
          onAddMarkdownDocument={markdownDocuments.openDialog}
          onAddHtmlDocument={htmlDocuments.openDialog}
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
          markdownDocumentDialog={markdownDocuments.dialogProps} htmlDocumentDialog={htmlDocuments.dialogProps} csvTableDialog={csvTables.dialogProps}
          projectFiles={projectFiles}
          status={status}
          statusMessages={preferences.statusMessages}
          onCloseFileWorkflowError={() => setFileWorkflowError(null)}
          onResolveUnsavedPrompt={resolveUnsavedPrompt}
          onCloseNodeActionEditor={() => setNodeActionEditor(null)}
          onSaveCanvasNodeAction={saveCanvasNodeAction}
          onExecuteNodeActionDraft={executeNodeActionDraft}
        />
      </main>
      </OverlayLayerScopeProvider>
    </TooltipProvider>
    </EditorMotionProvider>
  );
}
