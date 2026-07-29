import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { useEditorAgentDocuments } from "@/features/mermaid-editor/components/agent/use-editor-agent-documents";
import { useEditorCommandActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-command-actions";
import { useEditorDesktopEvents } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events";
import { useEditorDraftAutosave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave";
import { EditorFloatingChrome } from "@/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome";
import { EditorOverlays } from "@/features/mermaid-editor/components/mermaid-editor/editor-overlays";
import { EditorWorkspaceSurface } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface";
import { EditorWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels";
import { useEditorDocumentModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-model";
import { useEditorDocumentSession } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-session";
import { useDocumentHubWorkspace } from "@/features/mermaid-editor/components/mermaid-editor/use-document-hub-workspace";
import { useEditorFileWorkflow } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { useEditorExplorerTreeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-explorer-tree-model";
import { useEditorKeyboardShortcuts } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts";
import { useEditorOverlayState } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-overlay-state";
import { useEditorRecentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-recent-actions";
import { useEditorThemeModel } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-theme-model";
import { useTerminalWorkspaceWindowActions, useTerminalWorkspaceWindowState } from "@/features/mermaid-editor/components/mermaid-editor/use-terminal-workspace-windows";
import { useEditorWorkspacePanelActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-workspace-panel-actions";
import { useEditorWindowActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions";
import { useEditorAuxiliaryDocumentController } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-auxiliary-document-controller";
import { useMarkdownFileLinkOpener } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-file-link-opener";
import { useMarkdownDocumentPreviews } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-document-previews";
import { useTextDocumentPreviews } from "@/features/mermaid-editor/components/mermaid-editor/use-text-document-previews";
import { useLinkedProjectDocuments } from "@/features/mermaid-editor/components/mermaid-editor/use-linked-project-documents";
import { useMarkdownFoldPersistence } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-fold-persistence";
import { useProjectFileActions } from "@/features/mermaid-editor/components/mermaid-editor/use-project-file-actions";
import { useProjectFileHotReload } from "@/features/mermaid-editor/components/mermaid-editor/use-project-file-hot-reload";
import { useProjectResourceStatuses } from "@/features/mermaid-editor/components/mermaid-editor/use-project-resource-statuses";
import { createMarkdownDocumentDropHandlers } from "@/features/mermaid-editor/components/mermaid-editor/markdown-document-drop";
import { TooltipProvider } from "@/components/ui/tooltip";
import { loadInitialState } from "@/features/mermaid-editor/lib/editor-state";
import { createEditorRuntime, type RuntimeAgentTextSelection } from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorSnapshot } from "@/features/mermaid-editor/lib/editor-types";
import { EditorMotionProvider } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { htmlWindowPanelId, imageWindowPanelId, markdownWindowPanelId, useWorkspacePanels, type DetachedBrowserWindow, type DetachedCsvWindow, type DetachedHtmlWindow, type DetachedImageWindow, type DetachedMarkdownWindow, type DetachedTextWindow } from "@/features/mermaid-editor/lib/workspace-panels";
import { OverlayLayerScopeProvider } from "@/lib/overlay-layer-context";
import { useCanvasNodeGeometryModel } from "@/features/mermaid-editor/components/mermaid-editor/use-canvas-node-geometry-model";
import { useCsvTableFileSync } from "@/features/mermaid-editor/components/mermaid-editor/use-csv-table-file-sync";
import { normalizeFileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import { clampMarkdownTextScale, markdownTextScalePercent } from "@/features/mermaid-editor/lib/markdown-text-scale";
import { imageViewerWatchPath } from "@/features/mermaid-editor/lib/image-viewer";
export function MermaidEditor() {
  const runtime = useMemo(() => createEditorRuntime(), []);
  const initial = useMemo(loadInitialState, []);
  const {
    documentKind, setDocumentKind,
    source, setSource,
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
  const { previewByNodeId: textDocumentPreviewByNodeId, requestPreview: requestTextDocumentPreview, updatePreviewFromText: updateTextDocumentPreviewFromText } = useTextDocumentPreviews({ runtime, fileRef, projectWorkspace });
  const {
    status,
    setStatus,
    fileMenuOpen,
    setFileMenuOpen,
    fileWorkflowError,
    setFileWorkflowError,
    unsavedPrompt,
    setUnsavedPrompt,
    fileConflictPrompt,
    setFileConflictPrompt,
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
  const terminalWindowState = useTerminalWorkspaceWindowState(); const { terminalOpen, setTerminalOpen, detachedTerminalWindows } = terminalWindowState;
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [detachedMarkdownWindows, setDetachedMarkdownWindows] = useState<DetachedMarkdownWindow[]>([]); const [detachedBrowserWindows, setDetachedBrowserWindows] = useState<DetachedBrowserWindow[]>([]); const [detachedHtmlWindows, setDetachedHtmlWindows] = useState<DetachedHtmlWindow[]>([]); const [detachedImageWindows, setDetachedImageWindows] = useState<DetachedImageWindow[]>([]);
  const [detachedTextWindows, setDetachedTextWindows] = useState<DetachedTextWindow[]>([]); const [detachedCsvWindows, setDetachedCsvWindows] = useState<DetachedCsvWindow[]>([]);
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
    leftCollapsed, rightCollapsed, agentOpen, terminalOpen, themeSettingsOpen, documentKind, detachedTerminalWindows,
    detachedMarkdownWindows, detachedBrowserWindows, detachedHtmlWindows, detachedImageWindows, detachedTextWindows, detachedCsvWindows
  });
  const { openWorkspacePanel, closeWorkspacePanel } = useEditorWorkspacePanelActions({
    bringWorkspacePanelToFront,
    setWorkspacePanelWindowState,
    setLeftCollapsed,
    setRightCollapsed,
    setAgentOpen,
    setTerminalOpen
  });
  const { anyTerminalWindowOpen, closeTerminalWindow, newTerminalWindow, openTerminalWindow } = useTerminalWorkspaceWindowActions({ state: terminalWindowState, bringToFront: bringWorkspacePanelToFront, setWindowState: setWorkspacePanelWindowState });
  const { recordRecentAction } = useEditorRecentActions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceSurfaceRef = useRef<HTMLDivElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const lastWindowFocusAtRef = useRef(Date.now());
  const isDirtyRef = useRef(false);
  const currentDocumentRef = useRef("");
  const auxiliaryCloseActionsRef = useRef<{ dirtyNames: string[]; saveAll: () => Promise<boolean>; discardAll: () => Promise<void> }>({ dirtyNames: [], saveAll: async () => true, discardAll: async () => undefined });
  const applyLoadedDocumentRef = useRef<((text: string, name: string, file: import("@/features/mermaid-editor/lib/editor-runtime").RuntimeFileRef) => void) | null>(null);
  const isDesktopChrome = runtime.kind === "desktop";
  useEffect(() => { isDirtyRef.current = isDirty; currentDocumentRef.current = currentDocument; }, [currentDocument, isDirty]);
  const documentSession = useEditorDocumentSession({
    initialSession: initial.editorSession,
    activeDocument: { documentKind, fileName, fileRef, content: currentDocument, savedContent: lastSavedDocument }
  });
  useEffect(() => {
    isDirtyRef.current = isDirty || documentSession.dirtyBuffers.length > 0 || detachedTextWindows.some((window) => window.value !== window.savedValue) || detachedCsvWindows.some((window) => window.value !== window.savedValue);
  }, [detachedCsvWindows, detachedTextWindows, documentSession.dirtyBuffers.length, isDirty]);
  const {
    canvasLiveState, updateCanvasLiveState, recordCanvasPointerWorld,
    applyEditorCommand, applySource, applyMarkdownSource, flushSourceHistory,
    updateViewFilter, resetViewFilters, addNode, addImageNode, createGroupFromSelection,
    updateDirection, updateEdgeRouting, updateLayoutMode, refreshFromSource,
    performDelete, performUndo, performRedo, performCopy, performPaste,
    changeWorkspaceView, syncAutoLayout, resetCanvasView
  } = useEditorCommandActions({
    runtime,
    documentKind,
    source,
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
    editableKind,
    resolvedMotion,
    nodeGeometrySpec: canvasNodeGeometrySpec,
    sourceEditBaseRef,
    sourceEditTimerRef,
    lastWindowFocusAtRef,
    setDocumentKind,
    setSource,
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
  function saveThemeSettings() { saveThemeSettingsDraft(); }
  const showCsvFileWorkflowError = useCallback((error: unknown, message = "CSV 文件操作失败。") => {
    setFileWorkflowError(normalizeFileWorkflowError(error, message));
  }, [setFileWorkflowError]);
  const { flushPendingWrites: flushLinkedFileWrites, discardPendingWrites: discardLinkedFileWrites, reloadExternalFiles: reloadExternalCsvFiles } = useCsvTableFileSync({ runtime, graph, setGraph, fileRef, projectWorkspace, documentGenerationRef, layoutMode, nodeGeometrySpec: canvasNodeGeometrySpec, showFileWorkflowError: showCsvFileWorkflowError });
  const {
    showFileWorkflowError, resolveUnsavedPrompt, resolveFileConflictPrompt, prepareWindowClose,
    applyLoadedDocument, applyStoredEditorState,
    openMermaidFile, newMermaidFile, newMarkdownFile, openFallbackFile,
    openRuntimeFileRequest, openProjectFolder, refreshProjectWorkspace, invalidateProjectWorkspaceRequests,
    updateBrowserFileDragFeedback, handleBrowserFileDragLeave, handleBrowserFileDrop, importImageAssetRequest, handleRuntimeFileDropRequest,
    openRecentFile, openProjectFile, saveMermaidFile, saveMermaidFileAs,
    saveDocumentBufferById, saveAutoSaveEligibleDocuments
  } = useEditorFileWorkflow({
    runtime,
    fileInputRef,
    workspaceSurfaceRef,
    isDirtyRef,
    documentKind,
    source,
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
    editorSession: documentSession.session, detachedMarkdownWindows, detachedTextWindows, detachedCsvWindows,
    captureActiveDocumentBuffer: documentSession.captureActiveDocument, activateDocumentBuffer: documentSession.activateDocument,
    registerDocumentBuffer: documentSession.registerDocument, beginUntitledDocumentBuffer: documentSession.beginUntitledDocument,
    findFileDocumentBuffer: documentSession.findFileBuffer, markActiveDocumentBufferSaved: documentSession.markActiveBufferSaved,
    markDocumentBufferSaved: documentSession.markBufferSaved, updateDocumentBuffer: documentSession.updateBuffer,
    replaceEditorDocumentSession: documentSession.replaceSession, discardAllDocumentChanges: documentSession.discardAllChanges,
    reloadDocumentFromDisk: (text, name, file) => applyLoadedDocumentRef.current?.(text, name, file),
    canvasLiveState,
    isCanvasEditable,
    nodeGeometrySpec: canvasNodeGeometrySpec,
    setDocumentKind,
    setSource,
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
    setFileConflictPrompt,
    setThemeId,
    setCustomTheme,
    setPreferences,
    setStatus,
    setFileDropFeedback,
    flushSourceHistory,
    flushLinkedFileWrites,
    discardLinkedFileWrites,
    listAdditionalDirtyDocuments: () => auxiliaryCloseActionsRef.current.dirtyNames,
    saveAdditionalDocuments: () => auxiliaryCloseActionsRef.current.saveAll(),
    discardAdditionalDocuments: () => auxiliaryCloseActionsRef.current.discardAll(),
    applyEditorCommand,
    recordRecentAction
  });
  applyLoadedDocumentRef.current = (text, name, file) => applyLoadedDocument(text, name, file, "watch");
  const documentHubWorkspace = useDocumentHubWorkspace({ runtime, documentSession, preferences, saveAutoSaveEligibleDocuments,
    setDetachedMarkdownWindows, setFileRef, setFileName, applyLoadedDocument, setStatus, showFileWorkflowError });
  const {
    copyProjectResources,
    createProjectDirectory,
    createProjectFile,
    deleteProjectResources,
    importProjectResources,
    moveProjectFile,
    moveProjectResources,
    renameProjectResource,
    reorderProjectResources,
    showProjectResourceInFileManager
  } = useProjectFileActions({ runtime, projectWorkspace, fileRef, graph, detachedMarkdownWindows, detachedHtmlWindows, detachedImageWindows, setProjectBusy, setFileRef, setFileName, setRecentFiles, setDetachedMarkdownWindows, setDetachedHtmlWindows, setDetachedImageWindows, refreshProjectWorkspace, openProjectFile, beforeMove: flushLinkedFileWrites, applyEditorCommand, onDetachedMarkdownWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = markdownWindowPanelId(sourceFile); const targetPanelId = markdownWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onDetachedHtmlWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = htmlWindowPanelId(sourceFile); const targetPanelId = htmlWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onDetachedImageWindowMoved: (sourceFile, targetFile) => { const sourcePanelId = imageWindowPanelId(sourceFile); const targetPanelId = imageWindowPanelId(targetFile); const windowState = workspacePanelWindowState(sourcePanelId); removeWorkspacePanel(sourcePanelId); bringWorkspacePanelToFront(targetPanelId); setWorkspacePanelWindowState(targetPanelId, windowState); }, onMarkdownFileMoved: markdownFolds.migrateMarkdownFoldState, setStatus, showFileWorkflowError });
  const { markdownDocuments, htmlDocuments, textDocuments, csvTables } = useLinkedProjectDocuments({
    runtime, graph, viewport, canvasLiveState, projectWorkspace, applyEditorCommand,
    refreshProjectWorkspace, setStatus, showFileWorkflowError,
    updateMarkdownPreviewFromText: updateMarkdownDocumentPreviewFromText
  });
  const markdownDocumentDrop = createMarkdownDocumentDropHandlers({
    isCanvasEditable, workspaceView, viewport, workspaceSurfaceRef, projectWorkspace,
    addProjectMarkdownFile: markdownDocuments.addProjectMarkdownFile,
    addProjectHtmlFile: htmlDocuments.addProjectHtmlFile,
    addProjectTextFile: textDocuments.addProjectTextFile,
    addProjectCsvFile: csvTables.addProjectCsvFile,
    importProjectImageFileAtWindowPoint: (file, point) => { void importImageAssetRequest(file, point); },
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
    setDetachedMarkdownWindows,
    setDetachedTextWindows,
    setDetachedCsvWindows,
    setStatus,
    reconcileProjectWorkspace: () => { if (projectWorkspace?.rootPath) void refreshProjectWorkspace(projectWorkspace.rootPath); }
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
    findFileDocumentBuffer: documentSession.findFileBuffer,
    registerDocumentBuffer: documentSession.registerDocument,
    updateDocumentBuffer: documentSession.updateBuffer,
    saveDocumentBufferById,
    onMarkdownFileSaved: updateMarkdownDocumentPreviewFromText
  });
  const { windows: auxiliaryWindows, executeNodeAction: executeWorkspaceNodeAction } = useEditorAuxiliaryDocumentController({
    runtime, preferences, textWindows: detachedTextWindows, setTextWindows: setDetachedTextWindows,
    csvWindows: detachedCsvWindows, setCsvWindows: setDetachedCsvWindows, fileRef, projectWorkspace,
    bringPanelToFront: bringWorkspacePanelToFront, removePanel: removeWorkspacePanel,
    setPanelWindowState: setWorkspacePanelWindowState, executeCanvasNodeAction,
    closeActionsRef: auxiliaryCloseActionsRef, onTextFileSaved: updateTextDocumentPreviewFromText, onStatus: setStatus, onError: showFileWorkflowError
  });
  const openMarkdownFileLink = useMarkdownFileLinkOpener({ projectWorkspace, openMarkdownWindow: openProjectMarkdownWindow, openHtmlWindow: openProjectHtmlWindow, openImageWindow: openProjectImageWindow, openTextWindow: auxiliaryWindows.openTextWindow, openCsvWindow: auxiliaryWindows.openCsvWindow });
  useProjectFileHotReload({ runtime, projectWorkspace, setProjectWorkspace, fileRef,
    detachedMarkdownWindows, setDetachedMarkdownWindows, setStatus,
    detachedHtmlWindows, setDetachedHtmlWindows, detachedImageWindows, setDetachedImageWindows,
    refreshProjectWorkspace, invalidateProjectWorkspaceRequests, reloadExternalCsvFiles,
    updateMarkdownPreviewFromText: updateMarkdownDocumentPreviewFromText,
    markMarkdownPreviewMissing: markMarkdownDocumentPreviewMissing,
    refreshImageAssets, showFileWorkflowError
  });
  const agentDocumentBridge = useEditorAgentDocuments({
    runtime, documentKind, source, currentDocument, graph, selection, textSelection: agentTextSelection,
    fileName, fileRef, isDirty, projectWorkspace, projectFiles,
    documentGeneration: documentGenerationRef.current,
    detachedMarkdownWindows, detachedSelections: detachedAgentSelections, activeWorkspacePanel,
    applySource, applyMarkdownSource, flushSourceHistory,
    setFileRef, setFileName, setRecentFiles, setLastSavedDocument, setDetachedMarkdownWindows,
    setWorkspaceView, setStatus, bringWorkspacePanelToFront,
    findFileDocumentBuffer: documentSession.findFileBuffer,
    updateDocumentBuffer: documentSession.updateBuffer,
    saveDocumentBufferById
  });
  useEditorDraftAutosave({
    ready: draftPersistenceReady,
    runtime,
    documentKind,
    source,
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
    preferences,
    editorSession: documentSession.session,
    detachedMarkdownWindows,
    detachedTextWindows,
    detachedCsvWindows
  });
  const closeFloatingOverlays = closeFloatingOverlayState;
  const projectResourceStatuses = useProjectResourceStatuses(documentSession.session.buffers);
  useEditorKeyboardShortcuts({
    graph,
    selection,
    isCanvasEditable,
    closeFloatingOverlays,
    saveMermaidFile,
    saveMermaidFileAs,
    createGroupFromSelection,
    editCanvasNodeAction,
    executeCanvasNodeAction: executeWorkspaceNodeAction,
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
      <input ref={fileInputRef} type="file" accept=".mmd,.mermaid,.md,.markdown,.txt,.csv,text/plain,text/csv" className="hidden" onChange={openFallbackFile} />
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
            fileRef={fileRef}
            fileName={fileName}
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
            textDocumentPreviewByNodeId={textDocumentPreviewByNodeId}
            markdownSpellcheckEnabled={preferences.markdownSpellcheckEnabled} markdownContentWidth={preferences.markdownContentWidth} markdownTextScale={preferences.markdownTextScale}
            visualTokens={compiledTheme.canvasVisualTokens}
            geometryTokens={compiledTheme.geometry}
            typography={compiledTheme.typography} markdownTokens={compiledTheme.theme.markdown}
            specialNodeTokens={compiledTheme.specialNode}
            fontRevision={fontRevision}
            motion={resolvedMotion}
            source={source}
            isDirty={isDirty} canUndo={history.undoStack.length > 0} canRedo={history.redoStack.length > 0}
            previewSource={previewSource}
            diagnostics={diagnostics}
            mermaidThemeVariables={compiledTheme.mermaidThemeVariables}
            onMarkdownChange={applyMarkdownSource} onOpenMarkdownFileLink={(href) => openMarkdownFileLink(href, fileRef?.path)} markdownFoldState={markdownFolds.bindingFor(fileRef).foldState} onMarkdownFoldStateChange={markdownFolds.bindingFor(fileRef).onFoldStateChange}
            onTextSelectionChange={setAgentTextSelection}
            onSourceChange={applySource}
            onSave={() => void saveMermaidFile()} onUndo={performUndo} onRedo={performRedo}
            onRunSource={refreshFromSource}
            onEditorCommand={applyEditorCommand}
            onOpenNodeAction={executeWorkspaceNodeAction} onOpenCanvasImage={(request) => openImageWindow({ ...request, documentFile: fileRef, watchPath: imageViewerWatchPath(request.source, fileRef?.path) })}
            onEditNodeAction={editCanvasNodeAction}
            onPointerWorldChange={recordCanvasPointerWorld}
            onLiveStateChange={updateCanvasLiveState}
            onRequestMarkdownDocumentPreview={requestMarkdownDocumentPreview}
            onRequestTextDocumentPreview={requestTextDocumentPreview}
          />
        </div>
        </MotionPresence>
        <EditorWorkspacePanels
          runtime={runtime} documentKind={documentKind}
          leftCollapsed={leftCollapsed} rightCollapsed={rightCollapsed}
          agentOpen={agentOpen} agentDocumentBridge={agentDocumentBridge} terminalOpen={terminalOpen} detachedTerminalWindows={detachedTerminalWindows} themeSettingsOpen={themeSettingsOpen}
          activeWorkspacePanel={activeWorkspacePanel} fullscreenWorkspacePanel={fullscreenWorkspacePanel}
          graph={graph} selection={selection}
	          projectWorkspace={projectWorkspace} projectFiles={projectFiles}
	          projectResourceStatuses={projectResourceStatuses}
	          explorerTreeState={activeExplorerTreeState} onExplorerTreeStateChange={updateExplorerTreeState}
          projectBusy={projectBusy} fileRef={fileRef}
          terminalCwd={terminalCwd} terminalContextKey={terminalContextKey} activeTheme={activeTheme} editingThemeId={editingThemeId}
          editingCustomTheme={editingCustomTheme} themeDraftDirty={themeDraftDirty}
          terminalTheme={compiledTheme.terminalTheme} detachedMarkdownWindows={detachedMarkdownWindows} detachedBrowserWindows={detachedBrowserWindows} detachedHtmlWindows={detachedHtmlWindows} detachedImageWindows={detachedImageWindows}
          detachedTextWindows={detachedTextWindows} detachedCsvWindows={detachedCsvWindows}
          markdownSpellcheckEnabled={preferences.markdownSpellcheckEnabled} markdownContentWidth={preferences.markdownContentWidth}
          markdownTextScale={preferences.markdownTextScale} workspaceTitlebarAutoHide={preferences.workspaceTitlebarAutoHide}
          onMarkdownTextScaleChange={(value) => { const markdownTextScale = clampMarkdownTextScale(value); updatePreferences({ ...preferences, markdownTextScale }, `Markdown 正文字号已设为 ${markdownTextScalePercent(markdownTextScale)}。`); }}
          bringWorkspacePanelToFront={bringWorkspacePanelToFront} workspacePanelStackPosition={workspacePanelStackPosition}
          workspacePanelWindowState={workspacePanelWindowState} setWorkspacePanelWindowState={setWorkspacePanelWindowState}
          closeWorkspacePanel={closeWorkspacePanel} newTerminalWindow={newTerminalWindow} openTerminalWindow={openTerminalWindow} closeTerminalWindow={closeTerminalWindow}
          hideThemeSettings={hideThemeSettings} discardThemeSettings={discardThemeSettings}
          applyThemeSettings={saveThemeSettings} previewTheme={previewTheme}
          openProjectFolder={openProjectFolder} refreshProjectWorkspace={refreshProjectWorkspace}
          createProjectFile={createProjectFile} createProjectDirectory={createProjectDirectory}
          renameProjectResource={renameProjectResource}
          moveProjectFile={moveProjectFile} moveProjectResources={moveProjectResources}
          reorderProjectResources={reorderProjectResources}
          copyProjectResources={copyProjectResources} importProjectResources={importProjectResources}
          deleteProjectResources={deleteProjectResources} showProjectResourceInFileManager={showProjectResourceInFileManager}
          openProjectFile={openProjectFile}
          openProjectMarkdownWindow={openProjectMarkdownWindow} openProjectHtmlWindow={openProjectHtmlWindow} openProjectImageWindow={openProjectImageWindow}
          openProjectTextWindow={auxiliaryWindows.openTextWindow} openProjectCsvWindow={auxiliaryWindows.openCsvWindow} onProjectDocumentPointerDrag={markdownDocumentDrop.pointer}
          applyEditorCommand={applyEditorCommand}
          executeCanvasNodeAction={executeWorkspaceNodeAction}
          editCanvasNodeAction={editCanvasNodeAction}
          closeDetachedMarkdownWindow={closeDetachedMarkdownWindow} closeDetachedBrowserWindow={closeDetachedBrowserWindow}
          closeDetachedHtmlWindow={closeDetachedHtmlWindow} closeDetachedImageWindow={closeDetachedImageWindow} navigateDetachedImageWindow={navigateDetachedImageWindow} saveDetachedMarkdownWindow={saveDetachedMarkdownWindow}
          closeDetachedTextWindow={auxiliaryWindows.closeTextWindow} closeDetachedCsvWindow={auxiliaryWindows.closeCsvWindow}
          saveDetachedTextWindow={auxiliaryWindows.saveTextWindow} saveDetachedCsvWindow={auxiliaryWindows.saveCsvWindow}
          updateDetachedTextWindow={auxiliaryWindows.updateTextWindow} updateDetachedCsvWindow={auxiliaryWindows.updateCsvWindow}
          undoDetachedCsvWindow={auxiliaryWindows.undoCsvWindow} redoDetachedCsvWindow={auxiliaryWindows.redoCsvWindow} setDetachedCsvHeaderMode={auxiliaryWindows.setCsvHeaderMode}
          updateDetachedMarkdownWindow={updateDetachedMarkdownWindow} openMarkdownFileLink={openMarkdownFileLink} markdownFoldBindingFor={markdownFolds.bindingFor}
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
          terminalOpen={anyTerminalWindowOpen}
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
          onFileMenuOpenChange={updateFileMenuOpen}
          onViewFiltersOpenChange={updateViewFiltersOpen}
          onSecondaryActionsOpenChange={updateSecondaryActionsOpen}
          onNewMermaidFile={newMermaidFile}
          onNewMarkdownFile={newMarkdownFile}
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
        />
        <EditorOverlays
          fileDropFeedback={fileDropFeedback}
          fileWorkflowError={fileWorkflowError}
          unsavedPrompt={unsavedPrompt}
          fileConflictPrompt={fileConflictPrompt}
          documentConflict={documentHubWorkspace.documentConflict}
          nodeActionEditorNode={nodeActionEditorNode}
          markdownDocumentDialog={markdownDocuments.dialogProps} htmlDocumentDialog={htmlDocuments.dialogProps} csvTableDialog={csvTables.dialogProps}
          projectFiles={projectFiles}
          status={status}
          statusMessages={preferences.statusMessages}
          onCloseFileWorkflowError={() => setFileWorkflowError(null)}
          onResolveUnsavedPrompt={resolveUnsavedPrompt}
          onResolveFileConflictPrompt={resolveFileConflictPrompt}
          onResolveDocumentConflict={documentHubWorkspace.resolveDocumentConflict}
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
