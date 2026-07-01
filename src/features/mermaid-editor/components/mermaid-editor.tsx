import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DotsGrid3x3 as Grid3X3,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  Terminal,
  Xmark
} from "iconoir-react/regular";

import { BrowserWindowPanel, MarkdownWindowPanel } from "@/features/mermaid-editor/components/detached-window-panels";
import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { CanvasDocumentEditor } from "@/features/mermaid-editor/components/canvas-document-editor";
import { FileMenu, SecondaryActionsMenu, ViewFilterMenu } from "@/features/mermaid-editor/components/editor-menus";
import { ExplorerPanel } from "@/features/mermaid-editor/components/explorer-panel";
import { FileDropFeedbackBadge, FileWorkflowErrorBanner, UnsavedFilePrompt, type FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";
import { FloatingChromeLayer, FloatingChromeSlot, FloatingIconButton, FloatingPanel, MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { useEditorAiCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-ai-commands";
import { useEditorClipboardActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-clipboard-actions";
import { useEditorDesktopEvents } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-desktop-events";
import { useEditorDocumentCommands } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-commands";
import { useEditorFileWorkflow, type UnsavedPromptState } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { useEditorRecentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-recent-actions";
import { useEditorWindowActions } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-window-actions";
import { NodeActionEditorDialog } from "@/features/mermaid-editor/components/node-action-editor-dialog";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import { WorkspacePanelControls, WorkspacePanelHeader } from "@/features/mermaid-editor/components/workspace-panel-controls";
import { DesktopWindowControls, ToolModeCluster, WorkspaceViewCluster } from "@/features/mermaid-editor/components/workspace-view-controls";
import { appLogoById } from "@/features/mermaid-editor/lib/app-logo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { layoutFromGraph } from "@/features/mermaid-editor/lib/canvas-layout";
import { deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { AiCanvasSize, AiEditingContext } from "@/features/mermaid-editor/lib/ai-context";
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
  loadInitialState,
  serializableRuntimeFileRef,
  type StoredEditor
} from "@/features/mermaid-editor/lib/editor-state";
import {
  createEditorRuntime,
  type RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import {
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
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
import { incrementPerformanceCounter } from "@/features/mermaid-editor/lib/editor-performance";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import { DEFAULT_VIEW_FILTERS, hiddenFilterCount, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import { shouldCreateGroupFromShortcut } from "@/features/mermaid-editor/lib/editor-keyboard-shortcuts";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  useWorkspacePanels,
  type DetachedBrowserWindow,
  type DetachedMarkdownWindow,
  type StaticWorkspacePanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import { createImageAsset, DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH } from "@/features/mermaid-editor/lib/node-assets";
import { cn } from "@/lib/utils";
import { OVERLAY_Z_INDEX, useGlobalOverlayActivity } from "@/lib/overlay-layers";
import {
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { parentDirectoryPath } from "@/features/mermaid-editor/lib/runtime-paths";

const KonvaCanvas = lazy(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => ({ default: mod.KonvaCanvas })));
const ThemeSettingsPanel = lazy(() => import("@/features/mermaid-editor/components/theme-settings-panel").then((mod) => ({ default: mod.ThemeSettingsPanel })));

type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
  editing?: Exclude<AiEditingContext, { kind: "source" }> | null;
  interaction?: string;
};
function diagramTypeLabel(diagramType: DiagramType) {
  const labels: Record<DiagramType, string> = {
    flowchart: "Flowchart",
    sequence: "Sequence",
    class: "Class",
    state: "State",
    er: "ER",
    gantt: "Gantt",
    pie: "Pie",
    mindmap: "Mindmap",
    timeline: "Timeline",
    architecture: "Architecture",
    unknown: "Mermaid"
  };

  return labels[diagramType];
}

function resolveGraphImageDisplaySources(graph: MermaidGraph, displaySrcBySrc: Record<string, string>): MermaidGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.asset?.kind !== "image") return node;
      const displaySrc = displaySrcBySrc[node.asset.src];
      return displaySrc && displaySrc !== node.asset.src ? { ...node, asset: { ...node.asset, src: displaySrc } } : node;
    })
  };
}

function viewportCenterPoint(viewport: ViewportState, canvasSize?: AiCanvasSize) {
  const width = canvasSize?.width || 840;
  const height = canvasSize?.height || 520;
  return {
    x: (width / 2 - viewport.x) / viewport.scale,
    y: (height / 2 - viewport.y) / viewport.scale
  };
}

function imageLabelFromSrc(src: string) {
  return src.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || "图片";
}

async function loadImageDimensions(src: string) {
  if (typeof window === "undefined" || !src) return { width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT };

  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_ASSET_WIDTH;
      const height = image.naturalHeight || DEFAULT_IMAGE_ASSET_HEIGHT;
      const maxSide = Math.max(width, height, 1);
      const scale = maxSide > 360 ? 360 / maxSide : 1;
      resolve({
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
      });
    };
    image.onerror = () => resolve({ width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT });
    image.src = src;
  });
}

function canvasLiveStateKey(state: CanvasLiveState) {
  return JSON.stringify({
    width: state.canvasSize?.width || 0,
    height: state.canvasSize?.height || 0,
    editing: state.editing || null,
    interaction: state.interaction || ""
  });
}

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
  const storageWriteTimerRef = useRef<number | null>(null);
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

  useEffect(() => {
    if (!draftPersistenceReady) return;
    if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);

    storageWriteTimerRef.current = window.setTimeout(() => {
      incrementPerformanceCounter("local-storage-write");
      void runtime.saveDraft({
          documentKind,
          source: documentKind === "canvas" ? serializeCanvasDocument(canvasDocument) : source,
          ...(documentKind === "canvas" ? { canvasDocument } : {}),
          ...(documentKind === "mermaid" ? { layout: layoutFromGraph(graph, viewport, edgeRouting, layoutMode, fileTheme) } : {}),
          viewport: documentKind === "canvas" ? canvasDocument.viewport : viewport,
          edgeRouting,
          layoutMode,
          leftCollapsed,
          rightCollapsed,
          workspaceView,
          viewFilters,
          fileName,
          fileRef: serializableRuntimeFileRef(fileRef),
          recentFiles,
          projectWorkspace,
          lastSavedDocument,
          themeId,
          customTheme,
          preferences
        } satisfies StoredEditor);
      storageWriteTimerRef.current = null;
    }, 160);

    return () => {
      if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);
    };
  }, [canvasDocument, documentKind, source, graph, viewport, edgeRouting, layoutMode, leftCollapsed, rightCollapsed, workspaceView, viewFilters, fileName, fileRef, fileTheme, recentFiles, projectWorkspace, lastSavedDocument, themeId, customTheme, preferences, runtime, draftPersistenceReady]);

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

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function isTerminalInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      return Boolean(element?.closest(".terminal-panel"));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTerminalInput(event.target)) return;

      if (event.key === "Escape" && closeFloatingOverlays()) {
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;

      if (command && key === "s") {
        event.preventDefault();
        if (event.shiftKey) void saveMermaidFileAs();
        else void saveMermaidFile();
        return;
      }

      if (isTextInput(event.target)) return;
      if (!isCanvasEditable) return;

      if (shouldCreateGroupFromShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        editable: isCanvasEditable,
        hasSelection: hasSelection(selection)
      })) {
        event.preventDefault();
        createGroupFromSelection("keyboard");
        return;
      }

      if (command && key === "k") {
        const selectedNode = graph.nodes.find((node) => node.id === selection.primaryId) || graph.nodes.find((node) => node.id === selection.nodeIds[0]);
        if (selectedNode) {
          event.preventDefault();
          editCanvasNodeAction(selectedNode);
        }
        return;
      }

      if (command && event.key === "Enter") {
        const selectedNode = graph.nodes.find((node) => node.id === selection.primaryId) || graph.nodes.find((node) => node.id === selection.nodeIds[0]);
        if (selectedNode?.action) {
          event.preventDefault();
          executeCanvasNodeAction(selectedNode);
        }
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePanning(true);
        return;
      }

      if (command && key === "z" && event.shiftKey) {
        event.preventDefault();
        performRedo();
        return;
      }
      if (command && key === "z") {
        event.preventDefault();
        performUndo();
        return;
      }
      if (command && key === "y") {
        event.preventDefault();
        performRedo();
        return;
      }
      if (command && key === "c") {
        event.preventDefault();
        performCopy();
        return;
      }
      if (command && key === "v") {
        event.preventDefault();
        void performPaste();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        performDelete();
        return;
      }
      if (key === "v") applyEditorCommand({ type: "mode.set", mode: setEditorMode("select"), source: "keyboard" });
      if (key === "l") applyEditorCommand({ type: "mode.set", mode: setEditorMode("connect"), source: "keyboard" });
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") setSpacePanning(false);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  function changeWorkspaceView(nextView: WorkspaceView) {
    const resolvedView = workspaceViewForDocument(editableKind, nextView, documentKind);
    setWorkspaceView(resolvedView);
  }

  function changeToolMode(nextMode: EditorMode) {
    if (mode === nextMode) return;
    applyEditorCommand({ type: "mode.set", mode: setEditorMode(nextMode), source: "menu" });
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
          {documentKind === "canvas" ? (
            <CanvasDocumentEditor
              document={canvasDocument}
              fileRef={fileRef}
              runtime={runtime}
              onChange={applyCanvasDocument}
              onStatus={setStatus}
            />
          ) : workspaceView === "canvas" && isCanvasEditable ? (
            <Suspense fallback={<div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>}>
              <KonvaCanvas
                graph={graph}
                selection={selection}
                viewport={viewport}
                mode={mode}
                panningRequested={spacePanning}
                viewFilters={viewFilters}
                edgeRouting={edgeRouting}
                mermaidEdgeRoutes={mermaidEdgeRoutes}
                layoutMode={layoutMode}
                imageDisplaySrcBySrc={imageDisplaySrcBySrc}
                visualTokens={compiledTheme.canvasVisualTokens}
                geometryTokens={compiledTheme.geometry}
                motion={resolvedMotion}
                onEditorCommand={applyEditorCommand}
                onOpenNodeAction={executeCanvasNodeAction}
                onEditNodeAction={editCanvasNodeAction}
                onPointerWorldChange={recordCanvasPointerWorld}
                onLiveStateChange={updateCanvasLiveState}
              />
            </Suspense>
          ) : workspaceView === "markdown" && documentKind === "markdown" ? (
            <MarkdownPanel
              key={`${fileRef?.path || fileName}:markdown`}
              value={source}
              onChange={applyMarkdownSource}
            />
          ) : workspaceView === "source" ? (
            <SourcePanel
              value={source}
              title={`${documentKindLabel(documentKind)} 源码`}
              diagnostics={documentKind === "mermaid" ? diagnostics : []}
              onChange={applySource}
              onRun={documentKind === "mermaid" ? refreshFromSource : undefined}
              className="border-0"
            />
          ) : (
            <PreviewPanel
              source={previewSource}
              graph={isCanvasEditable ? graph : undefined}
              framed={false}
              diagnostics={diagnostics}
              mermaidThemeVariables={compiledTheme.mermaidThemeVariables}
              onEditorCommand={isCanvasEditable ? applyEditorCommand : undefined}
            />
          )}
        </div>
        </MotionPresence>
        {fileDropFeedback ? <FileDropFeedbackBadge feedback={fileDropFeedback} /> : null}
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
            terminalTheme={compiledTheme.terminalTheme}
            onClose={() => closeWorkspacePanel("terminal")}
            onStatus={setStatus}
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
        {detachedMarkdownWindows.map((markdownWindow) => (
          <FloatingPanel
            key={markdownWindow.id}
            open
            placement="center-panel"
            kind="workspace"
            dismissMode="explicit"
            panelId={markdownWindow.id}
            active={activeWorkspacePanel === markdownWindow.id}
            stackIndex={workspacePanelStackPosition(markdownWindow.id)}
            onFocusPanel={() => bringWorkspacePanelToFront(markdownWindow.id)}
            resetDragOnOpen={false}
            defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.markdown}
            minSize={WORKSPACE_PANEL_MIN_SIZES.markdown}
            windowState={workspacePanelWindowState(markdownWindow.id)}
            onWindowStateChange={(state) => setWorkspacePanelWindowState(markdownWindow.id, state)}
            className="relative h-full w-full min-h-0 overflow-hidden rounded-lg"
          >
            <MarkdownWindowPanel
              title={markdownWindow.title}
              path={markdownWindow.file.path}
              value={markdownWindow.value}
              dirty={markdownWindow.value !== markdownWindow.savedValue}
              windowState={workspacePanelWindowState(markdownWindow.id)}
              onWindowStateChange={(state) => setWorkspacePanelWindowState(markdownWindow.id, state)}
              onClose={() => closeDetachedMarkdownWindow(markdownWindow.id)}
              onSave={() => void saveDetachedMarkdownWindow(markdownWindow.id)}
              onChange={(value) => updateDetachedMarkdownWindow(markdownWindow.id, value)}
            />
          </FloatingPanel>
        ))}
        {detachedBrowserWindows.map((browserWindow) => (
          <FloatingPanel
            key={browserWindow.id}
            open
            placement="center-panel"
            kind="workspace"
            dismissMode="explicit"
            panelId={browserWindow.id}
            active={activeWorkspacePanel === browserWindow.id}
            stackIndex={workspacePanelStackPosition(browserWindow.id)}
            onFocusPanel={() => bringWorkspacePanelToFront(browserWindow.id)}
            resetDragOnOpen={false}
            defaultSize={WORKSPACE_PANEL_DEFAULT_SIZES.browser}
            minSize={WORKSPACE_PANEL_MIN_SIZES.browser}
            windowState={workspacePanelWindowState(browserWindow.id)}
            onWindowStateChange={(state) => setWorkspacePanelWindowState(browserWindow.id, state)}
            className="relative h-full w-full min-h-0 overflow-hidden rounded-lg"
          >
            <BrowserWindowPanel
              panelId={browserWindow.id}
              title={browserWindow.title}
              url={browserWindow.url}
              runtime={runtime}
              active={activeWorkspacePanel === browserWindow.id}
              domOverlayActive={browserDomOverlayActive}
              windowState={workspacePanelWindowState(browserWindow.id)}
              onWindowStateChange={(state) => setWorkspacePanelWindowState(browserWindow.id, state)}
              onNavigate={(url) => updateDetachedBrowserWindow(browserWindow.id, url)}
              onClose={() => closeDetachedBrowserWindow(browserWindow.id)}
              onStatus={setStatus}
              onBrowserError={recordBrowserWebviewError}
            />
          </FloatingPanel>
        ))}

        <FloatingChromeLayer>
          <FloatingChromeSlot placement="topLeft" pinned={fileMenuOpen}>
            <FileMenu
              open={fileMenuOpen}
              recentFiles={recentFiles}
              runtimeKind={runtime.kind}
              projectBusy={projectBusy}
              isDirty={isDirty}
              onOpenChange={updateFileMenuOpen}
              onNewMermaidFile={() => void newMermaidFile()}
              onNewMarkdownFile={() => void newMarkdownFile()}
              onNewCanvasFile={() => void newCanvasFile()}
              onOpenFile={() => void openMermaidFile()}
              onOpenRecent={(file) => void openRecentFile(file)}
              onOpenProject={() => void openProjectFolder()}
              onSaveFile={() => void saveMermaidFile()}
              onSaveAs={() => void saveMermaidFileAs()}
            />
          </FloatingChromeSlot>

          {isDesktopChrome ? (
            <FloatingChromeSlot placement="topCenter">
              <FloatingIconButton
                type="button"
                label="拖拽移动窗口，双击最大化"
                tooltipSide="bottom"
                onPointerDown={startDesktopWindowDragHandle}
                onDoubleClick={() => void toggleDesktopWindowMaximizeHandle()}
              >
                <Grid3X3 />
              </FloatingIconButton>
            </FloatingChromeSlot>
          ) : null}

          {isDesktopChrome ? (
            <FloatingChromeSlot placement="topRight">
              <DesktopWindowControls runtime={runtime} />
            </FloatingChromeSlot>
          ) : null}

          {documentKind !== "canvas" ? (
          <FloatingChromeSlot placement="rightView">
            <WorkspaceViewCluster
              workspaceView={workspaceView}
              editableKind={editableKind}
              documentKind={documentKind}
              canvasViewTooltip={canvasViewTooltip}
              onChange={changeWorkspaceView}
            />
          </FloatingChromeSlot>
          ) : null}

          {documentKind === "mermaid" ? (
          <FloatingChromeSlot placement="rightFilter" pinned={viewFiltersOpen}>
            <ViewFilterMenu
              open={viewFiltersOpen}
              filters={viewFilters}
              hiddenCount={hiddenViewFilters}
              editable={isCanvasEditable}
              onOpenChange={updateViewFiltersOpen}
              onChange={updateViewFilter}
              onReset={resetViewFilters}
            />
          </FloatingChromeSlot>
          ) : null}

          {leftCollapsed ? (
          <FloatingChromeSlot placement="leftCenter">
            <FloatingIconButton
              label="展开左侧文件夹"
              tooltipSide="right"
              onClick={() => openWorkspacePanel("explorer")}
            >
              <PanelLeftOpen />
            </FloatingIconButton>
          </FloatingChromeSlot>
          ) : null}

          {documentKind === "mermaid" && rightCollapsed ? (
          <FloatingChromeSlot placement="rightCenter">
            <FloatingIconButton
              label="展开右侧检查器"
              tooltipSide="left"
              onClick={() => openWorkspacePanel("inspector")}
            >
              <PanelRightOpen />
            </FloatingIconButton>
          </FloatingChromeSlot>
          ) : null}

          <FloatingChromeSlot placement="leftBottom" pinned={secondaryActionsOpen}>
            <SecondaryActionsMenu
              open={secondaryActionsOpen}
              direction={graph.direction}
              edgeRouting={edgeRouting}
              layoutMode={layoutMode}
              preferences={preferences}
              editable={isCanvasEditable}
              documentKind={documentKind}
              onOpenChange={updateSecondaryActionsOpen}
              onAddNode={addNode}
              onAddImageNode={() => void addImageNode()}
              onCreateGroup={createGroupFromSelection}
              onSaveAs={() => void saveMermaidFileAs()}
              onDirectionChange={updateDirection}
              onEdgeRoutingChange={updateEdgeRouting}
              onLayoutModeChange={updateLayoutMode}
              onPreferencesChange={updatePreferences}
              onRefreshSource={refreshFromSource}
              onSyncAutoLayout={() => applyEditorCommand({ type: "layout.syncAuto", source: "menu" })}
              onResetView={() => {
                if (documentKind === "canvas") applyCanvasDocument({ ...canvasDocument, viewport: { x: 160, y: 90, scale: 1 } }, "已重置画布视图。");
                else updateViewport({ x: 160, y: 90, scale: 1 }, "menu");
              }}
              onOpenThemeSettings={openThemeSettings}
            />
          </FloatingChromeSlot>

          {!terminalOpen ? (
          <FloatingChromeSlot placement="bottomCenter">
            <FloatingIconButton
              label="打开终端"
              tooltipSide="top"
              onClick={() => openWorkspacePanel("terminal")}
            >
              <Terminal />
            </FloatingIconButton>
          </FloatingChromeSlot>
          ) : null}

          {isCanvasEditable && workspaceView === "canvas" ? (
            <FloatingChromeSlot placement="rightBottom">
              <ToolModeCluster mode={mode} onChange={changeToolMode} />
            </FloatingChromeSlot>
          ) : null}
        </FloatingChromeLayer>
        {fileWorkflowError ? <FileWorkflowErrorBanner error={fileWorkflowError} onClose={() => setFileWorkflowError(null)} /> : null}
        {unsavedPrompt ? <UnsavedFilePrompt prompt={unsavedPrompt} onResolve={resolveUnsavedPrompt} /> : null}
        {nodeActionEditorNode ? (
          <NodeActionEditorDialog
            node={nodeActionEditorNode}
            projectFiles={projectFiles}
            onClose={() => setNodeActionEditor(null)}
            onSave={saveCanvasNodeAction}
            onTestOpen={executeNodeActionDraft}
          />
        ) : null}
        {preferences.statusMessages && status ? (
          <div
            className="pointer-events-none fixed bottom-3 left-1/2 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur"
            style={{ zIndex: OVERLAY_Z_INDEX.statusToast }}
          >
            {status}
          </div>
        ) : null}
        {themeSettingsOpen ? (
          <Suspense fallback={null}>
            <ThemeSettingsPanel
              themeId={themeId}
              customTheme={customTheme}
              activeTheme={activeTheme}
              onPreview={previewTheme}
              onCancel={cancelThemeSettings}
              onSave={saveThemeSettings}
            />
          </Suspense>
        ) : null}
      </main>
    </TooltipProvider>
    </EditorMotionProvider>
  );
}
