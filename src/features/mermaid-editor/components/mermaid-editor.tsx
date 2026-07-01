import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";
import { MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { useEditorAiCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-ai-commands";
import { useEditorClipboardActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-actions";
import { useEditorDesktopEvents } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events";
import { useEditorDraftAutosave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-draft-autosave";
import { useEditorDocumentCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-commands";
import { EditorFloatingChrome } from "@/features/mermaid-editor/components/mermaid-editor/editor-floating-chrome";
import { EditorOverlays } from "@/features/mermaid-editor/components/mermaid-editor/editor-overlays";
import { EditorWorkspaceSurface } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-surface";
import { EditorWorkspacePanels } from "@/features/mermaid-editor/components/mermaid-editor/editor-workspace-panels";
import {
  canvasLiveStateKey,
  diagramTypeLabel,
  imageLabelFromSrc,
  loadImageDimensions,
  resolveGraphImageDisplaySources,
  viewportCenterPoint,
  type CanvasLiveState
} from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import { useEditorFileWorkflow, type UnsavedPromptState } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { useEditorKeyboardShortcuts } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-keyboard-shortcuts";
import { useEditorRecentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-recent-actions";
import { useEditorWindowActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions";
import { appLogoById } from "@/features/mermaid-editor/lib/app-logo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { buildMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import {
  emptySelection,
  hasSelection,
  setMode as setEditorMode
} from "@/features/mermaid-editor/lib/editor-actions";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import {
  layoutThemeFromState,
  loadInitialState
} from "@/features/mermaid-editor/lib/editor-state";
import {
  createEditorRuntime,
  type RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import {
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  ClipboardPayload,
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorHistory,
  EditorMode,
  EditorSnapshot,
  GraphDirection,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasLayoutTheme } from "@/features/mermaid-editor/lib/editor-types";
import {
  applyEditorThemeToDocument,
  compileEditorTheme,
  type EditorTheme,
  type EditorThemeId,
  resolveEditorTheme
} from "@/features/mermaid-editor/lib/editor-theme";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { EditorMotionProvider, gsap, useResolvedEditorMotion } from "@/features/mermaid-editor/lib/use-gsap-motion";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import { DEFAULT_VIEW_FILTERS, hiddenFilterCount, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import {
  useWorkspacePanels,
  type DetachedBrowserWindow,
  type DetachedMarkdownWindow,
  type StaticWorkspacePanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import { createImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { useGlobalOverlayActivity } from "@/lib/overlay-layers";
import {
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { parentDirectoryPath } from "@/features/mermaid-editor/lib/runtime-paths";

export function MermaidEditor() {
  useDisableNativeContextMenu();
  const globalDomOverlayActive = useGlobalOverlayActivity();

  const runtime = useMemo(() => createEditorRuntime(), []);
  const initial = useMemo(loadInitialState, []);
  const [documentKind, setDocumentKind] = useState<DocumentKind>(initial.documentKind);
  const [source, setSource] = useState(initial.source);
  const [canvasDocument, setCanvasDocument] = useState<CanvasDocument>(initial.canvasDocument);
  const [graph, setGraph] = useState<MermaidGraph>(initial.graph);
  const [diagramType, setDiagramType] = useState<DiagramType>(initial.diagramType);
  const [editableKind, setEditableKind] = useState<EditableKind>(initial.editableKind);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initial.edgeRouting);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(initial.layoutMode);
  const [mode, setMode] = useState<EditorMode>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [history, setHistory] = useState<EditorHistory>(() => createHistory());
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [status, setStatus] = useState("");
  const [diagnostics, setDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initial.workspaceView);
  const [viewFilters, setViewFilters] = useState<ViewFilters>(initial.viewFilters);
  const [fileName, setFileName] = useState(initial.fileName);
  const [fileTheme, setFileTheme] = useState<CanvasLayoutTheme | null>(initial.fileTheme);
  const [fileRef, setFileRef] = useState<RuntimeFileRef | null>(initial.fileRef);
  const [recentFiles, setRecentFiles] = useState<RecentFileEntry[]>(initial.recentFiles);
  const [projectWorkspace, setProjectWorkspace] = useState<ProjectWorkspace | null>(initial.projectWorkspace);
  const [projectBusy, setProjectBusy] = useState(false);
  const [lastSavedDocument, setLastSavedDocument] = useState(initial.lastSavedDocument);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileWorkflowError, setFileWorkflowError] = useState<FileWorkflowError | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<UnsavedPromptState | null>(null);
  const [draftPersistenceReady, setDraftPersistenceReady] = useState(runtime.kind !== "desktop");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [detachedMarkdownWindows, setDetachedMarkdownWindows] = useState<DetachedMarkdownWindow[]>([]);
  const [detachedBrowserWindows, setDetachedBrowserWindows] = useState<DetachedBrowserWindow[]>([]);
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
  const [nodeActionEditor, setNodeActionEditor] = useState<{ nodeId: string } | null>(null);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const [preferences, setPreferences] = useState<EditorPreferences>(initial.preferences);
  const [canvasLiveState, setCanvasLiveState] = useState<CanvasLiveState>({});
  const { recentActions, recordRecentAction } = useEditorRecentActions();
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});
  const [fileDropFeedback, setFileDropFeedback] = useState<FileDropFeedback | null>(null);
  const browserDomOverlayActive =
    globalDomOverlayActive ||
    fileMenuOpen ||
    viewFiltersOpen ||
    secondaryActionsOpen ||
    themeSettingsOpen ||
    Boolean(nodeActionEditor) ||
    Boolean(fileWorkflowError) ||
    Boolean(unsavedPrompt);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceSurfaceRef = useRef<HTMLDivElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const themeEditBaseRef = useRef<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);
  const viewportMotionTweenRef = useRef<gsap.core.Tween | null>(null);
  const lastCanvasPointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const lastWindowFocusAtRef = useRef(Date.now());
  const isDirtyRef = useRef(false);
  const currentDocumentRef = useRef("");

  const currentDocument = useMemo(
    () => {
      if (documentKind === "markdown") return source;
      if (documentKind === "canvas") return serializeCanvasDocument(canvasDocument);
      return buildMermaidDocument(source, graph, viewport, edgeRouting, layoutMode, fileTheme);
    },
    [canvasDocument, documentKind, source, graph, viewport, edgeRouting, layoutMode, fileTheme]
  );
  const previewSource = useMemo(
    () =>
      documentKind === "mermaid" && editableKind === "flowchart"
        ? buildMermaidDocument(serializeMermaid(resolveGraphImageDisplaySources(graph, imageDisplaySrcBySrc)), graph, viewport, edgeRouting, layoutMode, fileTheme)
        : source,
    [documentKind, editableKind, edgeRouting, fileTheme, graph, imageDisplaySrcBySrc, layoutMode, source, viewport]
  );
  const hiddenViewFilters = useMemo(() => hiddenFilterCount(viewFilters), [viewFilters]);
  const projectFiles = useMemo(() => projectWorkspace?.files || [], [projectWorkspace]);
  const mermaidEdgeRoutes = useMemo(
    () => (edgeRouting === "mermaid" ? deriveDagreAutoLayoutResult(graph).edgeRoutes : []),
    [edgeRouting, graph]
  );
  const activeTheme = useMemo(() => resolveEditorTheme(themeId, customTheme), [customTheme, themeId]);
  const compiledTheme = useMemo(() => compileEditorTheme(activeTheme), [activeTheme]);
  const resolvedMotion = useResolvedEditorMotion(compiledTheme.motion);
  const activeAppLogo = useMemo(() => appLogoById(preferences.appLogo), [preferences.appLogo]);
  const terminalCwd = useMemo(() => projectWorkspace?.rootPath || parentDirectoryPath(fileRef?.path), [fileRef?.path, projectWorkspace?.rootPath]);
  const isDirty = !lastSavedDocument || currentDocument !== lastSavedDocument;
  const isCanvasEditable = documentKind === "mermaid" && editableKind === "flowchart";
  const canvasViewTooltip = isCanvasEditable ? "无限画布" : `${diagramTypeLabel(diagramType)} 仅支持渲染`;
  const isDesktopChrome = runtime.kind === "desktop";

  useEffect(() => {
    isDirtyRef.current = isDirty;
    currentDocumentRef.current = currentDocument;
  }, [currentDocument, isDirty]);

  useEffect(() => {
    return () => {
      viewportMotionTweenRef.current?.kill();
    };
  }, []);

  useEffect(() => {
    const assetSources = Array.from(new Set(graph.nodes.map((node) => node.asset?.src).filter((src): src is string => Boolean(src))));
    if (!assetSources.length) {
      setImageDisplaySrcBySrc({});
      return;
    }

    let disposed = false;
    void Promise.all(
      assetSources.map(async (src) => {
        try {
          return [src, await runtime.resolveImageAssetSrc(fileRef, src)] as const;
        } catch {
          return [src, src] as const;
        }
      })
    ).then((entries) => {
      if (!disposed) setImageDisplaySrcBySrc(Object.fromEntries(entries));
    });

    return () => {
      disposed = true;
    };
  }, [fileRef, graph.nodes, runtime]);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.append(link);
    }
    link.type = "image/svg+xml";
    link.href = activeAppLogo.href;
  }, [activeAppLogo.href]);

  const updateCanvasLiveState = useCallback((next: CanvasLiveState) => {
    setCanvasLiveState((current) => (canvasLiveStateKey(current) === canvasLiveStateKey(next) ? current : next));
  }, []);

  const recordCanvasPointerWorld = useCallback((point: { x: number; y: number }) => {
    lastCanvasPointerWorldRef.current = point;
  }, []);

  const {
    applyEditorCommand,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    snapshot
  } = useEditorDocumentCommands({
    documentKind,
    source,
    graph,
    history,
    selection,
    viewport,
    edgeRouting,
    layoutMode,
    workspaceView,
    viewFilters,
    fileTheme,
    isCanvasEditable,
    sourceEditBaseRef,
    sourceEditTimerRef,
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
    recordRecentAction
  });

  function applyViewFilters(nextFilters: ViewFilters, message: string) {
    applyEditorCommand({ type: "viewFilters.set", filters: nextFilters, message, source: "menu" });
  }

  function updateViewFilter(nextFilters: ViewFilters, message: string) {
    applyViewFilters(nextFilters, message);
  }

  function resetViewFilters() {
    applyViewFilters(DEFAULT_VIEW_FILTERS, "已显示全部视图元素。");
  }

  function addNode() {
    if (!isCanvasEditable) return;
    applyEditorCommand({ type: "graph.addNodeAtViewportCenter", source: "menu" });
  }

  async function addImageNode() {
    if (!isCanvasEditable) return;
    if (!fileRef?.path) {
      setStatus("请先保存 Mermaid 文件，再添加本地图片节点。");
      return;
    }

    try {
      const result = await runtime.pickImageAsset(fileRef);
      if (result.status === "cancelled") return;
      if (result.status === "needs-document") {
        setStatus("请先保存 Mermaid 文件，再添加本地图片节点。");
        return;
      }
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }

      const dimensions = await loadImageDimensions(result.displaySrc);
      const point = viewportCenterPoint(viewport, canvasLiveState.canvasSize);
      applyEditorCommand({
        type: "graph.addImageNodeAt",
        point,
        asset: createImageAsset({
          src: result.src,
          width: dimensions.width,
          height: dimensions.height,
          preserveAspectRatio: true,
          labelPosition: "bottom"
        }),
        label: imageLabelFromSrc(result.src),
        message: result.copied ? "已复制并添加图片节点。" : "已添加图片节点。",
        source: "menu"
      });
    } catch (error) {
      showFileWorkflowError(error, "添加图片节点失败。");
    }
  }

  function createGroupFromSelection(source: "keyboard" | "menu" = "menu") {
    if (!isCanvasEditable || !hasSelection(selection)) return;
    applyEditorCommand({ type: "graph.createSubgraphFromSelection", source });
  }

  function updateDirection(direction: GraphDirection) {
    if (!isCanvasEditable) return;
    applyEditorCommand({ type: "graph.setDirection", direction, source: "menu" });
  }

  function updateEdgeRouting(nextEdgeRouting: EdgeRouting) {
    applyEditorCommand({ type: "edgeRouting.set", edgeRouting: nextEdgeRouting, source: "menu" });
  }

  function updateLayoutMode(nextLayoutMode: LayoutMode) {
    applyEditorCommand({ type: "layoutMode.set", layoutMode: nextLayoutMode, source: "menu" });
  }

  function refreshFromSource() {
    applyEditorCommand({ type: "source.refreshGraph", source: "menu" });
  }

  function performDelete() {
    if (!hasSelection(selection)) return;
    applyEditorCommand({ type: "graph.deleteSelection", source: "keyboard" });
  }

  function performUndo() {
    applyEditorCommand({ type: "history.undo", source: "keyboard" });
  }

  function performRedo() {
    applyEditorCommand({ type: "history.redo", source: "keyboard" });
  }

  const { performCopy, performPaste } = useEditorClipboardActions({
    clipboard,
    selection,
    viewport,
    lastWindowFocusAtRef,
    lastCanvasPointerWorldRef,
    applyEditorCommand
  });

  function updateViewport(nextViewport: ViewportState, source: "wheel" | "gesture" | "keyboard" | "menu" | "api" = "wheel") {
    viewportMotionTweenRef.current?.kill();
    viewportMotionTweenRef.current = null;

    if ((source === "menu" || source === "api") && resolvedMotion.duration.slow > 0) {
      const proxy = { ...viewport };
      viewportMotionTweenRef.current = gsap.to(proxy, {
        x: nextViewport.x,
        y: nextViewport.y,
        scale: nextViewport.scale,
        duration: resolvedMotion.duration.slow,
        ease: resolvedMotion.ease.emphasized,
        overwrite: "auto",
        onUpdate: () => setViewport({ x: proxy.x, y: proxy.y, scale: proxy.scale }),
        onComplete: () => {
          viewportMotionTweenRef.current = null;
          applyEditorCommand({ type: "viewport.set", viewport: nextViewport, source });
        }
      });
      return;
    }

    applyEditorCommand({ type: "viewport.set", viewport: nextViewport, source });
  }

  const updateFileMenuOpen = useCallback((open: boolean) => {
    setFileMenuOpen(open);
    if (!open) return;
    setViewFiltersOpen(false);
    setSecondaryActionsOpen(false);
  }, []);

  const updateViewFiltersOpen = useCallback((open: boolean) => {
    setViewFiltersOpen(open);
    if (!open) return;
    setFileMenuOpen(false);
    setSecondaryActionsOpen(false);
  }, []);

  const updateSecondaryActionsOpen = useCallback((open: boolean) => {
    setSecondaryActionsOpen(open);
    if (!open) return;
    setFileMenuOpen(false);
    setViewFiltersOpen(false);
  }, []);

  function openThemeSettings() {
    themeEditBaseRef.current = { themeId, customTheme };
    setThemeSettingsOpen(true);
    setFileMenuOpen(false);
    setViewFiltersOpen(false);
    setSecondaryActionsOpen(false);
  }

  function updatePreferences(nextPreferences: EditorPreferences, message?: string) {
    setPreferences(nextPreferences);
    if (!nextPreferences.statusMessages) {
      setStatus("");
      return;
    }
    if (message) setStatus(message);
  }

  function previewTheme(nextThemeId: EditorThemeId, nextCustomTheme: EditorTheme | null) {
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
  }

  function cancelThemeSettings() {
    const base = themeEditBaseRef.current;
    if (base) {
      setThemeId(base.themeId);
      setCustomTheme(base.customTheme);
    }
    themeEditBaseRef.current = null;
    setThemeSettingsOpen(false);
  }

  function saveThemeSettings() {
    setFileTheme(layoutThemeFromState(themeId, customTheme));
    themeEditBaseRef.current = null;
    setThemeSettingsOpen(false);
    setStatus("主题已保存。");
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

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!unsavedPrompt) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resolveUnsavedPrompt("cancel");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resolveUnsavedPrompt, unsavedPrompt]);

  useEffect(() => {
    applyEditorThemeToDocument(activeTheme);
  }, [activeTheme]);

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

  function openWorkspacePanel(panelId: StaticWorkspacePanelId) {
    bringWorkspacePanelToFront(panelId);
    if (panelId === "explorer") setLeftCollapsed(false);
    if (panelId === "inspector") setRightCollapsed(false);
    if (panelId === "terminal") setTerminalOpen(true);
  }

  function closeWorkspacePanel(panelId: StaticWorkspacePanelId) {
    setWorkspacePanelWindowState(panelId, "normal");
    if (panelId === "explorer") setLeftCollapsed(true);
    if (panelId === "inspector") setRightCollapsed(true);
    if (panelId === "terminal") setTerminalOpen(false);
  }

  function closeFloatingOverlays() {
    let closed = false;
    if (fileMenuOpen) {
      setFileMenuOpen(false);
      closed = true;
    }
    if (viewFiltersOpen) {
      setViewFiltersOpen(false);
      closed = true;
    }
    if (secondaryActionsOpen) {
      setSecondaryActionsOpen(false);
      closed = true;
    }
    if (themeSettingsOpen) {
      cancelThemeSettings();
      closed = true;
    }
    return closed;
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

  function changeWorkspaceView(nextView: WorkspaceView) {
    const resolvedView = workspaceViewForDocument(editableKind, nextView, documentKind);
    setWorkspaceView(resolvedView);
  }

  function changeToolMode(nextMode: EditorMode) {
    if (mode === nextMode) return;
    applyEditorCommand({ type: "mode.set", mode: setEditorMode(nextMode), source: "menu" });
  }

  function syncAutoLayout() {
    applyEditorCommand({ type: "layout.syncAuto", source: "menu" });
  }

  function resetCanvasView() {
    if (documentKind === "canvas") {
      applyCanvasDocument({ ...canvasDocument, viewport: { x: 160, y: 90, scale: 1 } }, "已重置画布视图。");
      return;
    }
    updateViewport({ x: 160, y: 90, scale: 1 }, "menu");
  }

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
