import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ClockRotateRight,
  Code,
  ColorWheel,
  DotsGrid3x3 as Grid3X3,
  EmptyPage,
  Eye,
  EyeClosed,
  Expand as Maximize2,
  FilterAlt,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  FrameSimple,
  Group as GroupIcon,
  GitBranch as Workflow,
  Link,
  Maximize,
  Minus,
  MoreHoriz,
  NavArrowDown,
  NavArrowRight,
  PathArrow,
  PositionAlign,
  Plus,
  Refresh as RefreshCw,
  SidebarCollapse as PanelLeftClose,
  SidebarCollapse as PanelRightClose,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  SquareCursor as SquareDashedMousePointer,
  Text,
  WarningTriangle,
  Xmark
} from "iconoir-react/regular";

import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import { ToolModeBar } from "@/features/mermaid-editor/components/tool-mode-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { APP_LOGOS, appLogoById, DEFAULT_APP_LOGO_ID, normalizeAppLogoId, type AppLogoId } from "@/features/mermaid-editor/lib/app-logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyLayout, edgeRoutingFromLayout, layoutFromGraph, layoutModeFromLayout, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import { applyDagreAutoLayout, deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { buildAiEditorContext, type AiCanvasSize, type AiEditingContext, type AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import type { AiApplyResult, AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import {
  copySelection,
  emptySelection,
  hasSelection,
  setMode as setEditorMode
} from "@/features/mermaid-editor/lib/editor-actions";
import { createHistory, pushHistory, redo, undo } from "@/features/mermaid-editor/lib/editor-history";
import { hasBlockingDiagnostics, normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import {
  createEditorRuntime,
  ensureRuntimeMermaidFileName,
  isRuntimeAbortError,
  type RuntimeFileDropRequest,
  type RuntimeFileOpenRequest,
  type RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import {
  fileWorkflowErrorSuggestion,
  fileWorkflowErrorTitle,
  isSupportedMermaidFilePath,
  normalizeFileWorkflowError,
  normalizeRecentFiles,
  upsertRecentFile,
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";
import {
  buildProjectFileTree,
  filterProjectFiles,
  isProjectFileActive,
  normalizeProjectWorkspace,
  projectTreeDirectoryIds,
  workspaceRootForOpenedFile,
  type ProjectFileEntry,
  type ProjectTreeNode,
  type ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import type {
  ClipboardPayload,
  DiagramType,
  EdgeStyle,
  EditableKind,
  EdgeRouting,
  EditorHistory,
  EditorMode,
  EditorSnapshot,
  FlowchartArrowType,
  GraphDirection,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasLayout, CanvasLayoutTheme } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE } from "@/features/mermaid-editor/lib/editor-types";
import {
  applyEditorThemeToDocument,
  BUILT_IN_EDITOR_THEMES,
  compileEditorTheme,
  DEFAULT_EDITOR_THEME,
  type EditorTheme,
  type EditorThemeId,
  isHexColor,
  normalizeEditorTheme,
  resolveEditorTheme
} from "@/features/mermaid-editor/lib/editor-theme";
import { incrementPerformanceCounter, measurePerformance } from "@/features/mermaid-editor/lib/editor-performance";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { applyEditorCommandTransaction } from "@/features/mermaid-editor/lib/interaction/transaction";
import { initialMermaidSource, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import { applyMermaidPatch } from "@/features/mermaid-editor/lib/mermaid-patch";
import {
  ARROW_TYPE_FILTERS,
  DEFAULT_VIEW_FILTERS,
  EDGE_STYLE_FILTERS,
  hiddenFilterCount,
  normalizeViewFilters,
  type ViewFilters
} from "@/features/mermaid-editor/lib/view-filters";
import { useDismissableFloatingMenu } from "@/features/mermaid-editor/lib/use-dismissable-floating-menu";
import { createImageAsset, DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH, isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import { cn } from "@/lib/utils";
import {
  WINDOW_CLOSE_TARGET_NAME,
  cleanCloseDocument,
  resolveWindowCloseChoice,
  unsavedPromptDescription,
  type UnsavedPromptChoice
} from "@/features/mermaid-editor/lib/desktop-close-workflow";
import { canvasScreenToWorldPoint, classifyFileDrop, windowPointToSurfacePoint, type DropPoint } from "@/features/mermaid-editor/lib/file-drop";

const KonvaCanvas = lazy(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => ({ default: mod.KonvaCanvas })));

const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];
const edgeRoutingOptions: { value: EdgeRouting; label: string }[] = [
  { value: "straight", label: "直线" },
  { value: "bezier", label: "曲线" },
  { value: "orthogonal", label: "圆角折线" },
  { value: "mermaid", label: "Mermaid 曲线" }
];
const layoutModeOptions: { value: LayoutMode; label: string }[] = [
  { value: "manual", label: "手动布局" },
  { value: "auto", label: "自动布局" }
];
const edgeStyleFilterLabels: Record<EdgeStyle, string> = {
  solid: "实线",
  thick: "粗线",
  dotted: "虚线",
  invisible: "隐藏线"
};
const arrowTypeFilterLabels: Record<FlowchartArrowType, string> = {
  arrow: "箭头",
  none: "无箭头",
  circle: "圆点",
  cross: "叉号"
};
type WorkspaceView = "canvas" | "render" | "source";
const FALLBACK_FILE_NAME = "diagram.mmd";
const BLANK_FLOWCHART_SOURCE = "flowchart LR";
type PanelOpenButtonMode = "hover" | "always";
type EditorPreferences = {
  startWithPanelsCollapsed: boolean;
  panelOpenButtonMode: PanelOpenButtonMode;
  statusMessages: boolean;
  desktopTitlebarAutoHide: boolean;
  restoreLastFile: boolean;
  appLogo: AppLogoId;
};
const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  startWithPanelsCollapsed: true,
  panelOpenButtonMode: "hover",
  statusMessages: false,
  desktopTitlebarAutoHide: true,
  restoreLastFile: true,
  appLogo: DEFAULT_APP_LOGO_ID
};
type StoredEditor = {
  source: string;
  layout?: CanvasLayout;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  viewport: ViewportState;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView?: WorkspaceView;
  showGrid?: boolean;
  showEdges?: boolean;
  viewFilters?: ViewFilters;
  fileName?: string;
  fileRef?: RuntimeFileRef | null;
  recentFiles?: RecentFileEntry[];
  projectWorkspace?: ProjectWorkspace | null;
  lastSavedDocument?: string;
  themeId?: EditorThemeId;
  customTheme?: EditorTheme | null;
  preferences?: Partial<EditorPreferences>;
};

type NumberKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];

type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
  editing?: Exclude<AiEditingContext, { kind: "source" }> | null;
  interaction?: string;
};
type FileDropFeedback = {
  message: string;
  tone: "ready" | "blocked";
  position?: DropPoint;
};
type FileOpenSource = "picker" | "recent" | "project" | "drop" | "external" | "restore";
type UnsavedPromptState = {
  title: string;
  description: string;
  targetName?: string;
  resolve: (choice: UnsavedPromptChoice) => void;
};
type StoredEditorApplyResult = {
  currentDocument: string;
  fileRef: RuntimeFileRef | null;
  lastSavedDocument: string;
  preferences: EditorPreferences;
};
type StoredEditorDraftOverrides = {
  source?: string;
  graph?: MermaidGraph;
  viewport?: ViewportState;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  fileTheme?: CanvasLayoutTheme | null;
  fileName?: string;
  fileRef?: RuntimeFileRef | null;
  recentFiles?: RecentFileEntry[];
  projectWorkspace?: ProjectWorkspace | null;
  lastSavedDocument?: string;
  workspaceView?: WorkspaceView;
  themeId?: EditorThemeId;
  customTheme?: EditorTheme | null;
};

function normalizeEditorPreferences(value: Partial<EditorPreferences> | undefined): EditorPreferences {
  return {
    startWithPanelsCollapsed: value?.startWithPanelsCollapsed ?? DEFAULT_EDITOR_PREFERENCES.startWithPanelsCollapsed,
    panelOpenButtonMode: value?.panelOpenButtonMode === "always" ? "always" : DEFAULT_EDITOR_PREFERENCES.panelOpenButtonMode,
    statusMessages: value?.statusMessages ?? DEFAULT_EDITOR_PREFERENCES.statusMessages,
    desktopTitlebarAutoHide: value?.desktopTitlebarAutoHide ?? DEFAULT_EDITOR_PREFERENCES.desktopTitlebarAutoHide,
    restoreLastFile: value?.restoreLastFile ?? DEFAULT_EDITOR_PREFERENCES.restoreLastFile,
    appLogo: normalizeAppLogoId(value?.appLogo)
  };
}

function normalizeWorkspaceView(value: unknown): WorkspaceView | undefined {
  return value === "canvas" || value === "render" || value === "source" ? value : undefined;
}

function workspaceViewForDocument(editableKind: EditableKind, value: unknown): WorkspaceView {
  const view = normalizeWorkspaceView(value);
  if (view === "source") return "source";
  if (editableKind !== "flowchart") return "render";
  return view || "canvas";
}

function loadInitialState() {
  const fallbackGraph = parseMermaid(initialMermaidSource);
  const fallbackViewport = { x: 160, y: 90, scale: 1 };
  const fallbackSource = serializeMermaid(fallbackGraph);
  const fallbackDocument = loadMermaidDocument(fallbackSource);
  const fallbackPreferences = DEFAULT_EDITOR_PREFERENCES;

  if (typeof window === "undefined") {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      diagramType: fallbackDocument.diagramType,
      editableKind: fallbackDocument.editableKind,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      layoutMode: DEFAULT_LAYOUT_MODE,
      leftCollapsed: true,
      rightCollapsed: true,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      fileRef: null,
      recentFiles: [] as RecentFileEntry[],
      projectWorkspace: null,
      lastSavedDocument: "",
      fileTheme: null,
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null,
      preferences: fallbackPreferences
    };
  }

  try {
    const stored = createEditorRuntime().loadDraft() as StoredEditor | null;
    if (!stored) throw new Error("No saved editor state");
    const loaded = loadMermaidDocument(stored.source);
    const legacyLayout = parseCanvasLayout(stored.source);
    const source = loaded.source;
    const layout = stored.layout || legacyLayout;
    const parsedGraph = loaded.editableKind === "flowchart" ? parseMermaid(source) : loaded.graph;
    const graph = loaded.editableKind === "flowchart" ? applyLayout(parsedGraph, layout) : parsedGraph;
    const viewport = stored.viewport || layout?.viewport || fallbackViewport;
    const edgeRouting = stored.edgeRouting || edgeRoutingFromLayout(layout);
    const layoutMode = stored.layoutMode || layoutModeFromLayout(layout);
    const resolvedGraph = loaded.editableKind === "flowchart" && layoutMode === "auto" ? applyDagreAutoLayout(graph) : graph;
    const fileTheme = layout?.theme ?? loaded.fileTheme ?? null;
    const themeId = normalizeThemeId(fileTheme?.themeId ?? stored.themeId);
    const customTheme = fileTheme?.customTheme
      ? normalizeEditorTheme(fileTheme.customTheme)
      : stored.customTheme
        ? normalizeEditorTheme(stored.customTheme)
        : null;
    const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
    const preferences = normalizeEditorPreferences(stored.preferences);
    const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
    const recentFiles = normalizeRecentFiles(stored.recentFiles);

    return {
      source,
      graph: resolvedGraph,
      diagramType: loaded.diagramType,
      editableKind: loaded.editableKind,
      viewport,
      edgeRouting,
      layoutMode,
      leftCollapsed: shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace,
        recentFiles,
        fileRef: stored.fileRef || null,
        fileName: stored.fileName,
        fallbackFileName: FALLBACK_FILE_NAME
      }),
      rightCollapsed: preferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false,
      workspaceView: workspaceViewForDocument(loaded.editableKind, stored.workspaceView),
      viewFilters,
      fileName: stored.fileName || FALLBACK_FILE_NAME,
      fileRef: stored.fileRef || null,
      recentFiles,
      projectWorkspace,
      lastSavedDocument: stored.lastSavedDocument || "",
      fileTheme,
      themeId,
      customTheme,
      preferences
    };
  } catch {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      diagramType: fallbackDocument.diagramType,
      editableKind: fallbackDocument.editableKind,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      layoutMode: DEFAULT_LAYOUT_MODE,
      leftCollapsed: true,
      rightCollapsed: true,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      fileRef: null,
      recentFiles: [] as RecentFileEntry[],
      projectWorkspace: null,
      lastSavedDocument: "",
      fileTheme: null,
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null,
      preferences: fallbackPreferences
    };
  }
}

function buildFallbackCleanDocument() {
  const graph = parseMermaid(initialMermaidSource);
  const source = serializeMermaid(graph);
  return buildMermaidDocument(source, graph, { x: 160, y: 90, scale: 1 }, DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE, null);
}

function ensureMermaidFileName(value: string | undefined) {
  return ensureRuntimeMermaidFileName(value || FALLBACK_FILE_NAME);
}

function comparableMermaidFileName(value: string | undefined) {
  const name = value?.split(/[\\/]/).pop();
  return ensureMermaidFileName(name).toLowerCase();
}

function serializableRuntimeFileRef(file: RuntimeFileRef | null): RuntimeFileRef | null {
  if (!file) return null;
  return {
    name: file.name,
    ...(file.path ? { path: file.path } : {})
  };
}

function isAbortError(error: unknown) {
  return isRuntimeAbortError(error);
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function edgeRoutingLabel(edgeRouting: EdgeRouting) {
  return edgeRoutingOptions.find((option) => option.value === edgeRouting)?.label || "曲线";
}

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

function normalizeThemeId(value: unknown): EditorThemeId {
  return value === "classic-light" || value === "high-contrast" || value === "custom" ? value : DEFAULT_EDITOR_THEME.id;
}

function layoutThemeFromState(themeId: EditorThemeId, customTheme: EditorTheme | null): CanvasLayoutTheme {
  return {
    themeId,
    ...(themeId === "custom" && customTheme ? { customTheme } : {})
  };
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

function selectionKey(selection: Selection) {
  return [selection.primaryId || "", ...selection.nodeIds, "|", ...selection.edgeIds, "|", ...(selection.subgraphIds || [])].join(",");
}

function targetFromSelection(selection: Selection): AiRecentAction["target"] {
  if (selection.nodeIds[0]) return { kind: "node", id: selection.nodeIds[0] };
  if (selection.edgeIds[0]) return { kind: "edge", id: selection.edgeIds[0] };
  if (selection.subgraphIds?.[0]) return { kind: "subgraph", id: selection.subgraphIds[0] };
  return { kind: "canvas" };
}

function canvasLiveStateKey(state: CanvasLiveState) {
  return JSON.stringify({
    width: state.canvasSize?.width || 0,
    height: state.canvasSize?.height || 0,
    editing: state.editing || null,
    interaction: state.interaction || ""
  });
}

function editorCommandDiagnostic(code: string, message: string, suggestion?: string, severity: EditorDiagnostic["severity"] = "error"): EditorDiagnostic {
  return {
    id: `editor-command:${code}:${hashText(message)}`,
    severity,
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function isDesktopWindowRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isWindowDragExcluded(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      [
        "[data-window-drag-exclude]",
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[role='combobox']",
        "[role='listbox']",
        "[role='option']",
        "[contenteditable='true']"
      ].join(",")
    )
  );
}

async function getDesktopWindow() {
  if (!isDesktopWindowRuntime()) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function MermaidEditor() {
  const runtime = useMemo(() => createEditorRuntime(), []);
  const initial = useMemo(loadInitialState, []);
  const [source, setSource] = useState(initial.source);
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
  const [projectFileQuery, setProjectFileQuery] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [lastSavedDocument, setLastSavedDocument] = useState(initial.lastSavedDocument);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [fileWorkflowError, setFileWorkflowError] = useState<FileWorkflowError | null>(null);
  const [unsavedPrompt, setUnsavedPrompt] = useState<UnsavedPromptState | null>(null);
  const [draftPersistenceReady, setDraftPersistenceReady] = useState(runtime.kind !== "desktop");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [desktopTitlebarVisible, setDesktopTitlebarVisible] = useState(false);
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const [preferences, setPreferences] = useState<EditorPreferences>(initial.preferences);
  const [canvasLiveState, setCanvasLiveState] = useState<CanvasLiveState>({});
  const [recentActions, setRecentActions] = useState<AiRecentAction[]>([]);
  const [imageDisplaySrcBySrc, setImageDisplaySrcBySrc] = useState<Record<string, string>>({});
  const [fileDropFeedback, setFileDropFeedback] = useState<FileDropFeedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceSurfaceRef = useRef<HTMLDivElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const themeEditBaseRef = useRef<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);
  const storageWriteTimerRef = useRef<number | null>(null);
  const aiContextPostTimerRef = useRef<number | null>(null);
  const aiCommandBusyRef = useRef(false);
  const actionCounterRef = useRef(0);
  const desktopTitlebarHideTimerRef = useRef<number | null>(null);
  const desktopTitlebarFocusRef = useRef(false);
  const desktopTitlebarHoverRef = useRef(false);
  const desktopTitlebarPinnedRef = useRef(false);
  const desktopFileWorkflowInitializedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const currentDocumentRef = useRef("");
  const canCloseWindowRef = useRef(false);
  const openPathRequestRef = useRef<(file: RuntimeFileOpenRequest, source: FileOpenSource) => Promise<void>>(async () => undefined);
  const importImagePathRequestRef = useRef<(file: RuntimeFileOpenRequest, position?: DropPoint) => Promise<void>>(async () => undefined);
  const fileDropRequestRef = useRef<(request: RuntimeFileDropRequest) => void>(() => undefined);
  const prepareCloseRequestRef = useRef<() => Promise<boolean>>(async () => true);
  const applyLoadedDocumentRef = useRef<(text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void>(() => undefined);
  const applyStoredEditorStateRef = useRef<(stored: StoredEditor) => StoredEditorApplyResult>(() => ({
    currentDocument: "",
    fileRef: null,
    lastSavedDocument: "",
    preferences: DEFAULT_EDITOR_PREFERENCES
  }));

  const currentDocument = useMemo(() => buildMermaidDocument(source, graph, viewport, edgeRouting, layoutMode, fileTheme), [source, graph, viewport, edgeRouting, layoutMode, fileTheme]);
  const previewSource = useMemo(
    () =>
      editableKind === "flowchart"
        ? buildMermaidDocument(serializeMermaid(resolveGraphImageDisplaySources(graph, imageDisplaySrcBySrc)), graph, viewport, edgeRouting, layoutMode, fileTheme)
        : source,
    [editableKind, edgeRouting, fileTheme, graph, imageDisplaySrcBySrc, layoutMode, source, viewport]
  );
  const hiddenViewFilters = useMemo(() => hiddenFilterCount(viewFilters), [viewFilters]);
  const filteredProjectFiles = useMemo(
    () => filterProjectFiles(projectWorkspace?.files || [], projectFileQuery),
    [projectFileQuery, projectWorkspace]
  );
  const mermaidEdgeRoutes = useMemo(
    () => (edgeRouting === "mermaid" ? deriveDagreAutoLayoutResult(graph).edgeRoutes : []),
    [edgeRouting, graph]
  );
  const activeTheme = useMemo(() => resolveEditorTheme(themeId, customTheme), [customTheme, themeId]);
  const compiledTheme = useMemo(() => compileEditorTheme(activeTheme), [activeTheme]);
  const activeAppLogo = useMemo(() => appLogoById(preferences.appLogo), [preferences.appLogo]);
  const isDirty = !lastSavedDocument || currentDocument !== lastSavedDocument;
  const fileLabel = `${fileName || FALLBACK_FILE_NAME}${isDirty ? " *" : ""}`;
  const isCanvasEditable = editableKind === "flowchart";
  const canvasViewTooltip = isCanvasEditable ? "无限画布" : `${diagramTypeLabel(diagramType)} 仅支持渲染`;
  const isDesktopChrome = runtime.kind === "desktop";
  const desktopTitlebarAutoHide = isDesktopChrome && preferences.desktopTitlebarAutoHide;
  const desktopTitlebarPinned = fileMenuOpen || secondaryActionsOpen || viewFiltersOpen || themeSettingsOpen || Boolean(unsavedPrompt);

  useEffect(() => {
    isDirtyRef.current = isDirty;
    currentDocumentRef.current = currentDocument;
  }, [currentDocument, isDirty]);

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

  const startDesktopWindowDrag = useCallback(
    async (event: React.PointerEvent<HTMLElement>) => {
      if (runtime.kind !== "desktop" || event.button !== 0 || event.detail > 1 || isWindowDragExcluded(event.target)) return;
      try {
        await (await getDesktopWindow())?.startDragging();
      } catch {
        // Window dragging is desktop-only; ignore capability/runtime failures in web-like shells.
      }
    },
    [runtime.kind]
  );

  const toggleDesktopWindowMaximize = useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      if (runtime.kind !== "desktop" || isWindowDragExcluded(event.target)) return;
      try {
        await (await getDesktopWindow())?.toggleMaximize();
      } catch {
        // Window controls are optional outside the Tauri desktop shell.
      }
    },
    [runtime.kind]
  );

  const showDesktopTitlebar = useCallback(() => {
    if (runtime.kind !== "desktop") return;
    if (desktopTitlebarHideTimerRef.current) {
      window.clearTimeout(desktopTitlebarHideTimerRef.current);
      desktopTitlebarHideTimerRef.current = null;
    }
    setDesktopTitlebarVisible(true);
  }, [runtime.kind]);

  const scheduleDesktopTitlebarHide = useCallback(() => {
    if (runtime.kind !== "desktop" || desktopTitlebarPinnedRef.current || desktopTitlebarFocusRef.current || desktopTitlebarHoverRef.current) return;
    if (desktopTitlebarHideTimerRef.current) window.clearTimeout(desktopTitlebarHideTimerRef.current);
    desktopTitlebarHideTimerRef.current = window.setTimeout(() => {
      if (!desktopTitlebarPinnedRef.current && !desktopTitlebarFocusRef.current && !desktopTitlebarHoverRef.current) setDesktopTitlebarVisible(false);
      desktopTitlebarHideTimerRef.current = null;
    }, 180);
  }, [runtime.kind]);

  const enterDesktopTitlebar = useCallback(() => {
    desktopTitlebarHoverRef.current = true;
    showDesktopTitlebar();
  }, [showDesktopTitlebar]);

  const leaveDesktopTitlebar = useCallback(() => {
    desktopTitlebarHoverRef.current = false;
    scheduleDesktopTitlebarHide();
  }, [scheduleDesktopTitlebarHide]);

  const focusDesktopTitlebar = useCallback(() => {
    desktopTitlebarFocusRef.current = true;
    showDesktopTitlebar();
  }, [showDesktopTitlebar]);

  const blurDesktopTitlebar = useCallback(() => {
    desktopTitlebarFocusRef.current = false;
    scheduleDesktopTitlebarHide();
  }, [scheduleDesktopTitlebarHide]);

  const buildCurrentAiContext = useCallback(() => {
    const editing: AiEditingContext | null =
      canvasLiveState.editing || (sourceEditBaseRef.current ? { kind: "source", draftText: source.slice(0, 1200) } : null);
    const interactionContext = buildInteractionContext({
      sourceLength: source.length,
      dirty: isDirty,
      graph,
      selection,
      viewport,
      viewFilters,
      diagramType,
      editableKind,
      mode,
      workspaceView,
      edgeRouting,
      layoutMode,
      canvasSize: canvasLiveState.canvasSize,
      editing
    });

    return buildAiEditorContext({
      source,
      graph,
      selection,
      viewport,
      fileName: fileName || FALLBACK_FILE_NAME,
      dirty: isDirty,
      diagramType,
      editableKind,
      mode,
      workspaceView,
      edgeRouting,
      layoutMode,
      diagnostics,
      canvasSize: canvasLiveState.canvasSize,
      editing,
      recentActions,
      interactionContext
    });
  }, [
    source,
    graph,
    selection,
    viewport,
    fileName,
    isDirty,
    diagramType,
    editableKind,
    mode,
    workspaceView,
    edgeRouting,
    layoutMode,
    viewFilters,
    diagnostics,
    canvasLiveState,
    recentActions
  ]);

  const postAiEditorContext = useCallback((context: ReturnType<typeof buildAiEditorContext>) => {
    return runtime.publishAiContext(context).catch(() => {
      // The CLI context bridge is best-effort; editor usage should not be blocked by it.
    });
  }, [runtime]);

  function recordRecentAction(type: string, target?: AiRecentAction["target"], summary?: string) {
    const action: AiRecentAction = {
      id: `${Date.now().toString(36)}-${actionCounterRef.current++}`,
      at: new Date().toISOString(),
      type,
      target,
      summary
    };
    setRecentActions((current) => [action, ...current].slice(0, 20));
  }

  function updateSelection(nextSelection: Selection) {
    const changed = selectionKey(selection) !== selectionKey(nextSelection);
    setSelection(nextSelection);
    if (changed) {
      recordRecentAction("selection.change", targetFromSelection(nextSelection), "用户更新了当前选中内容。");
    }
  }

  function changeMode(nextMode: EditorMode) {
    applyEditorCommand({ type: "mode.set", mode: nextMode, source: "menu" });
  }

  function applyEditorCommand(command: EditorCommand) {
    if (command.type === "mode.set") {
      const result = applyEditorCommandTransaction({ graph, selection, viewport, viewFilters }, command);
      setMode(command.mode);
      if (result.effect.recentAction) {
        recordRecentAction(result.effect.recentAction.type, { kind: result.effect.recentAction.target }, result.effect.recentAction.summary);
      }
      return;
    }

    if (command.type === "history.undo") {
      flushSourceHistory();
      const result = undo(history, snapshot());
      if (!result.snapshot) return;
      setHistory(result.history);
      restoreSnapshot(result.snapshot);
      setStatus("已撤销。");
      return;
    }

    if (command.type === "history.redo") {
      flushSourceHistory();
      const result = redo(history, snapshot());
      if (!result.snapshot) return;
      setHistory(result.history);
      restoreSnapshot(result.snapshot);
      setStatus("已重做。");
      return;
    }

    if (command.type === "clipboard.copy") {
      if (!selection.nodeIds.length) return;
      setClipboard(copySelection(graph, selection));
      setStatus("已复制选中节点。");
      recordRecentAction("selection.copy", targetFromSelection(selection), "复制选中节点。");
      return;
    }

    if (command.type === "edgeRouting.set") {
      if (!isCanvasEditable || command.edgeRouting === edgeRouting) return;
      flushSourceHistory();
      setHistory((current) => pushHistory(current, snapshot()));
      setEdgeRouting(command.edgeRouting);
      setStatus(`连线形状已切换为${edgeRoutingLabel(command.edgeRouting)}。`);
      recordRecentAction("edge-routing.change", { kind: "canvas" }, `连线形状切换为 ${edgeRoutingLabel(command.edgeRouting)}。`);
      return;
    }

    if (command.type === "layoutMode.set") {
      if (!isCanvasEditable || command.layoutMode === layoutMode) return;
      flushSourceHistory();
      const previousSnapshot = snapshot();

      if (command.layoutMode === "auto") {
        const nextGraph = measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(graph), {
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          modeSwitch: true
        });
        setHistory((current) => pushHistory(current, previousSnapshot));
        setGraph(nextGraph);
        setSource(serializeMermaid(nextGraph));
        setSelection(emptySelection);
        setLayoutMode(command.layoutMode);
        setStatus("已开启自动布局模式。");
        recordRecentAction("layout-mode.change", { kind: "canvas" }, "开启自动布局模式。");
        return;
      }

      setHistory((current) => pushHistory(current, previousSnapshot));
      setLayoutMode(command.layoutMode);
      setStatus("已切换为手动布局模式。");
      recordRecentAction("layout-mode.change", { kind: "canvas" }, "切换为手动布局模式。");
      return;
    }

    if (command.type === "source.refreshGraph") {
      flushSourceHistory();
      const loaded = loadMermaidDocument(source, graph);
      setHistory((current) => pushHistory(current, snapshot()));
      setDiagramType(loaded.diagramType);
      setEditableKind(loaded.editableKind);
      setGraph(loaded.graph);
      setSelection(emptySelection);
      setDiagnostics([]);
      if (loaded.editableKind !== "flowchart") {
        switchToRenderUnlessSource();
        setSource(loaded.source);
        setStatus("当前 Mermaid 类型已刷新渲染结果。");
        recordRecentAction("source.refresh", { kind: "source" }, "从源码刷新渲染视图。");
        return;
      }

      const nextGraph = layoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
      setSource(serializeMermaid(nextGraph));
      setGraph(nextGraph);
      setStatus("已从 Mermaid 源码刷新画布。");
      recordRecentAction("source.refresh", { kind: "source" }, "从源码刷新画布。");
      return;
    }

    if (command.type === "layout.syncAuto") {
      void syncCanvasFromAutoLayout();
      return;
    }

    const result = applyEditorCommandTransaction({ graph, selection, viewport, viewFilters }, command);

    if (result.effect.history === "push" && command.type === "history.capture") {
      captureHistory();
      return;
    }

    if (result.effect.sourceSync === "commit") {
      commitGraph(result.state.graph, result.state.selection, result.effect.status);
      return;
    }

    if (result.effect.sourceSync === "draft") {
      draftGraph(result.state.graph, result.effect.status, { syncSource: result.effect.syncSource });
      if (result.state.selection && selectionKey(selection) !== selectionKey(result.state.selection)) updateSelection(result.state.selection);
      if (result.effect.recentAction) {
        recordRecentAction(result.effect.recentAction.type, { kind: result.effect.recentAction.target }, result.effect.recentAction.summary);
      }
      return;
    }

    if (result.state.viewport !== viewport) setViewport(result.state.viewport);

    if (result.state.viewFilters !== viewFilters) {
      setViewFilters(result.state.viewFilters);
      if (result.effect.status) setStatus(result.effect.status);
    }

    if (selectionKey(selection) !== selectionKey(result.state.selection)) updateSelection(result.state.selection);

    if (result.effect.status && result.state.viewFilters === viewFilters) setStatus(result.effect.status);
    if (result.effect.recentAction) {
      recordRecentAction(result.effect.recentAction.type, { kind: result.effect.recentAction.target }, result.effect.recentAction.summary);
    }
  }

  function applyViewFilters(nextFilters: ViewFilters, message: string) {
    applyEditorCommand({ type: "viewFilters.set", filters: nextFilters, message, source: "menu" });
  }

  function updateViewFilter(nextFilters: ViewFilters, message: string) {
    applyViewFilters(nextFilters, message);
  }

  function resetViewFilters() {
    applyViewFilters(DEFAULT_VIEW_FILTERS, "已显示全部视图元素。");
  }

  function switchToRenderUnlessSource() {
    setWorkspaceView((current) => (current === "source" ? current : "render"));
  }

  const snapshot = useCallback(
    (): EditorSnapshot => ({ source, graph, selection, viewport, edgeRouting, layoutMode }),
    [source, graph, selection, viewport, edgeRouting, layoutMode]
  );

  function restoreSnapshot(next: EditorSnapshot) {
    const loaded = loadMermaidDocument(next.source, next.graph);
    setSource(next.source);
    setGraph(next.graph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setDiagnostics([]);
    if (loaded.editableKind !== "flowchart") switchToRenderUnlessSource();
    setSelection(next.selection);
    setViewport(next.viewport);
    setEdgeRouting(next.edgeRouting);
    setLayoutMode(next.layoutMode);
  }

  function applyAutoLayoutIfNeeded(nextGraph: MermaidGraph) {
    if (!isCanvasEditable || layoutMode !== "auto") return nextGraph;
    return measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(nextGraph), {
      nodes: nextGraph.nodes.length,
      edges: nextGraph.edges.length
    });
  }

  function flushSourceHistory() {
    if (!sourceEditBaseRef.current) return;
    if (sourceEditTimerRef.current) window.clearTimeout(sourceEditTimerRef.current);
    setHistory((current) => pushHistory(current, sourceEditBaseRef.current!));
    sourceEditBaseRef.current = null;
  }

  function commitGraph(nextGraph: MermaidGraph, nextSelection = selection, message = "画布已同步到 Mermaid 源码。") {
    if (!isCanvasEditable) return;
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
    const committedGraph = applyAutoLayoutIfNeeded(nextGraph);
    const nextSource = measurePerformance("serialize-mermaid", () => serializeMermaid(committedGraph), {
      nodes: committedGraph.nodes.length,
      edges: committedGraph.edges.length
    });
    setGraph(committedGraph);
    setSource(nextSource);
    setSelection(nextSelection);
    setDiagnostics([]);
    setStatus(message);
    recordRecentAction("graph.commit", targetFromSelection(nextSelection), message);
  }

  function draftGraph(nextGraph: MermaidGraph, message?: string, options?: { syncSource?: boolean }) {
    if (!isCanvasEditable) return;
    const draftedGraph = options?.syncSource ? applyAutoLayoutIfNeeded(nextGraph) : nextGraph;
    setGraph(draftedGraph);
    if (options?.syncSource) {
      setSource(
        measurePerformance("serialize-mermaid", () => serializeMermaid(draftedGraph), {
          nodes: draftedGraph.nodes.length,
          edges: draftedGraph.edges.length,
          draft: true
        })
      );
      if (message) setStatus(message);
    }
    setDiagnostics([]);
  }

  function captureHistory() {
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
  }

  function applySource(nextSource: string) {
    const startedSourceEdit = !sourceEditBaseRef.current;
    if (!sourceEditBaseRef.current) sourceEditBaseRef.current = snapshot();
    const sourceLayout = parseCanvasLayout(nextSource);
    const loaded = measurePerformance("load-mermaid-document", () => loadMermaidDocument(nextSource, graph), {
      sourceLength: nextSource.length
    });
    const nextEdgeRouting = sourceLayout ? loaded.edgeRouting : edgeRouting;
    const nextLayoutMode = sourceLayout ? loaded.layoutMode : layoutMode;
    const nextFileTheme = sourceLayout ? loaded.fileTheme ?? null : fileTheme;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    setSource(loaded.source);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setGraph(loadedGraph);
    setSelection(emptySelection);
    setDiagnostics([]);
    setStatus(loaded.editableKind === "flowchart" ? "源码已解析到画布。" : "当前 Mermaid 类型已刷新渲染结果。");
    if (startedSourceEdit) recordRecentAction("source.edit", { kind: "source" }, "用户开始编辑 Mermaid 源码。");

    if (loaded.editableKind !== "flowchart") switchToRenderUnlessSource();
    setEdgeRouting(nextEdgeRouting);
    setLayoutMode(nextLayoutMode);
    setFileTheme(nextFileTheme);
    if (sourceLayout?.theme) {
      setThemeId(normalizeThemeId(sourceLayout.theme.themeId));
      setCustomTheme(sourceLayout.theme.customTheme ? normalizeEditorTheme(sourceLayout.theme.customTheme) : null);
    }
    if (loaded.viewport) setViewport(loaded.viewport);
    if (sourceEditTimerRef.current) window.clearTimeout(sourceEditTimerRef.current);
    sourceEditTimerRef.current = window.setTimeout(() => {
      flushSourceHistory();
    }, 700);
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

  function createGroupFromSelection() {
    if (!isCanvasEditable || !hasSelection(selection)) return;
    applyEditorCommand({ type: "graph.createSubgraphFromSelection", source: "menu" });
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

  async function syncCanvasFromAutoLayout() {
    if (!isCanvasEditable) {
      setWorkspaceView("render");
      setStatus("当前 Mermaid 类型仅支持渲染，不能同步到无限画布。");
      return;
    }

    flushSourceHistory();
    const previousSnapshot = snapshot();
    setStatus("正在从 Mermaid 自动布局同步到无限画布。");

    try {
      const loaded = loadMermaidDocument(source, graph);
      if (loaded.editableKind !== "flowchart") {
        setWorkspaceView("render");
        setStatus("当前 Mermaid 类型仅支持渲染，不能同步到无限画布。");
        return;
      }

      const nextGraph = measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(loaded.graph), {
        nodes: loaded.graph.nodes.length,
        edges: loaded.graph.edges.length,
        manualRun: true
      });
      const nextSource = serializeMermaid(nextGraph);

      setHistory((current) => pushHistory(current, previousSnapshot));
      setSource(nextSource);
      setGraph(nextGraph);
      setDiagramType(loaded.diagramType);
      setEditableKind(loaded.editableKind);
      setSelection(emptySelection);
      setWorkspaceView("canvas");
      setDiagnostics([]);
      setStatus("已执行 Dagre 自动布局。");
      recordRecentAction("layout.sync-auto", { kind: "canvas" }, "从 Mermaid 自动布局同步到无限画布。");
    } catch (error) {
      setDiagnostics([normalizeMermaidError(error, source, "mermaid-render")]);
      setWorkspaceView("render");
      setStatus("自动布局失败，请先修复 Mermaid 语法。");
    }
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

  function performCopy() {
    applyEditorCommand({ type: "clipboard.copy", source: "keyboard" });
  }

  function performPaste() {
    if (!clipboard) return;
    applyEditorCommand({ type: "graph.pasteClipboard", payload: clipboard, source: "keyboard" });
  }

  function updateViewport(nextViewport: ViewportState, source: "wheel" | "gesture" | "keyboard" | "menu" | "api" = "wheel") {
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

  function showFileWorkflowError(error: unknown, fallbackMessage = "文件操作失败。") {
    setFileWorkflowError(normalizeFileWorkflowError(error, fallbackMessage));
  }

  function buildStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}): StoredEditor {
    const draftSource = overrides.source ?? source;
    const draftGraph = overrides.graph ?? graph;
    const draftViewport = overrides.viewport ?? viewport;
    const draftEdgeRouting = overrides.edgeRouting ?? edgeRouting;
    const draftLayoutMode = overrides.layoutMode ?? layoutMode;
    const draftFileTheme = "fileTheme" in overrides ? overrides.fileTheme : fileTheme;
    const draftFileRef = "fileRef" in overrides ? overrides.fileRef : fileRef;
    const draftThemeId = overrides.themeId ?? themeId;
    const draftCustomTheme = "customTheme" in overrides ? overrides.customTheme : customTheme;
    const draftProjectWorkspace = "projectWorkspace" in overrides ? overrides.projectWorkspace : projectWorkspace;

    return {
      source: draftSource,
      layout: layoutFromGraph(draftGraph, draftViewport, draftEdgeRouting, draftLayoutMode, draftFileTheme),
      viewport: draftViewport,
      edgeRouting: draftEdgeRouting,
      layoutMode: draftLayoutMode,
      leftCollapsed,
      rightCollapsed,
      workspaceView: overrides.workspaceView ?? workspaceView,
      viewFilters,
      fileName: overrides.fileName ?? fileName,
      fileRef: serializableRuntimeFileRef(draftFileRef ?? null),
      recentFiles: overrides.recentFiles ?? recentFiles,
      projectWorkspace: draftProjectWorkspace ?? null,
      lastSavedDocument: overrides.lastSavedDocument ?? lastSavedDocument,
      themeId: draftThemeId,
      customTheme: draftCustomTheme ?? null,
      preferences
    };
  }

  async function persistStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}) {
    await runtime.saveDraft(buildStoredEditorDraft(overrides));
  }

  async function persistDiscardedCloseDraft() {
    const cleanDocument = cleanCloseDocument(lastSavedDocument, buildFallbackCleanDocument());
    const loaded = loadMermaidDocument(cleanDocument);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const nextGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const nextFileTheme = loaded.fileTheme ?? null;
    const normalizedDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, nextFileTheme);
    const keepCurrentFile = Boolean(lastSavedDocument?.trim());
    const nextThemeId = normalizeThemeId(nextFileTheme?.themeId);
    const nextCustomTheme = nextFileTheme?.customTheme ? normalizeEditorTheme(nextFileTheme.customTheme) : null;

    await persistStoredEditorDraft({
      source: loaded.source,
      graph: nextGraph,
      viewport: nextViewport,
      edgeRouting: loaded.edgeRouting,
      layoutMode: nextLayoutMode,
      fileTheme: nextFileTheme,
      fileName: keepCurrentFile ? fileName : FALLBACK_FILE_NAME,
      fileRef: keepCurrentFile ? fileRef : null,
      lastSavedDocument: normalizedDocument,
      workspaceView: workspaceViewForDocument(loaded.editableKind, workspaceView),
      themeId: nextThemeId,
      customTheme: nextCustomTheme
    });
  }

  function requestUnsavedChoice(targetName?: string): Promise<UnsavedPromptChoice> {
    if (!isDirtyRef.current) return Promise.resolve("discard");
    return new Promise((resolve) => {
      setUnsavedPrompt({
        title: "当前文件有未保存修改",
        description: unsavedPromptDescription(targetName),
        targetName,
        resolve
      });
    });
  }

  const resolveUnsavedPrompt = useCallback((choice: UnsavedPromptChoice) => {
    setUnsavedPrompt((current) => {
      current?.resolve(choice);
      return null;
    });
  }, []);

  async function prepareFileSwitch(targetName?: string) {
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(targetName);
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    return saveMermaidFile();
  }

  async function prepareWindowClose() {
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(WINDOW_CLOSE_TARGET_NAME);
    const decision = resolveWindowCloseChoice(choice);

    if (decision.shouldSave) {
      const saved = await saveMermaidFile();
      return resolveWindowCloseChoice(choice, saved).shouldClose;
    }

    if (decision.shouldPersistDiscard) {
      try {
        await persistDiscardedCloseDraft();
      } catch {
        // Closing should not be blocked by best-effort draft cleanup.
      }
    }

    return decision.shouldClose;
  }

  function applyLoadedDocument(text: string, name: string, file: RuntimeFileRef | null, source: FileOpenSource = "picker") {
    flushSourceHistory();
    const loaded = loadMermaidDocument(text);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const nextThemeId = normalizeThemeId(loaded.fileTheme?.themeId ?? themeId);
    const nextCustomTheme = loaded.fileTheme?.customTheme ? normalizeEditorTheme(loaded.fileTheme.customTheme) : customTheme;
    const savedDocument = buildMermaidDocument(loaded.source, loadedGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, loaded.fileTheme ?? null);

    setSource(loaded.source);
    setGraph(loadedGraph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setViewport(nextViewport);
    setEdgeRouting(loaded.edgeRouting);
    setLayoutMode(nextLayoutMode);
    setWorkspaceView(loaded.editableKind === "flowchart" ? "canvas" : "render");
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(ensureMermaidFileName(name));
    setFileTheme(loaded.fileTheme ?? null);
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
    setFileRef(file);
    setLastSavedDocument(savedDocument);
    isDirtyRef.current = false;
    setRecentFiles((current) => upsertRecentFile(current, file));
    setFileWorkflowError(null);
    setStatus(loaded.editableKind === "flowchart" ? `已打开 ${name}。` : `已打开 ${name}，当前类型仅渲染。`);
    recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
    if (source !== "restore") void syncWorkspaceForOpenedFile(file);
  }

  async function syncWorkspaceForOpenedFile(file: RuntimeFileRef | null, options: { announce?: boolean } = {}) {
    if (runtime.kind !== "desktop" || !file?.path) return;

    const rootPath = workspaceRootForOpenedFile(file.path, projectWorkspace);
    if (!rootPath) {
      if (projectWorkspace) setLeftCollapsed(false);
      return;
    }

    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status !== "opened") return;
      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "同步文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setProjectFileQuery("");
      setLeftCollapsed(false);
      if (options.announce ?? true) setStatus(`已显示 ${workspace.rootName}，发现 ${workspace.files.length} 个 Mermaid 文件。`);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "同步文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  function applyStoredEditorState(stored: StoredEditor) {
    flushSourceHistory();
    const loaded = loadMermaidDocument(stored.source);
    const legacyLayout = parseCanvasLayout(stored.source);
    const layout = stored.layout || legacyLayout;
    const parsedGraph = loaded.editableKind === "flowchart" ? parseMermaid(loaded.source) : loaded.graph;
    const nextGraph = loaded.editableKind === "flowchart" ? applyLayout(parsedGraph, layout) : parsedGraph;
    const nextViewport = stored.viewport || layout?.viewport || { x: 160, y: 90, scale: 1 };
    const nextEdgeRouting = stored.edgeRouting || edgeRoutingFromLayout(layout);
    const nextLayoutMode = stored.layoutMode || layoutModeFromLayout(layout);
    const resolvedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(nextGraph) : nextGraph;
    const nextFileTheme = layout?.theme ?? loaded.fileTheme ?? null;
    const nextThemeId = normalizeThemeId(nextFileTheme?.themeId ?? stored.themeId);
    const nextCustomTheme = nextFileTheme?.customTheme
      ? normalizeEditorTheme(nextFileTheme.customTheme)
      : stored.customTheme
        ? normalizeEditorTheme(stored.customTheme)
        : null;
    const nextPreferences = normalizeEditorPreferences(stored.preferences);
    const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
    const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
    const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
    const currentStoredDocument = buildMermaidDocument(loaded.source, resolvedGraph, nextViewport, nextEdgeRouting, nextLayoutMode, nextFileTheme);

    setSource(loaded.source);
    setGraph(resolvedGraph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setViewport(nextViewport);
    setEdgeRouting(nextEdgeRouting);
    setLayoutMode(nextLayoutMode);
    setLeftCollapsed(shouldCollapseExplorerOnStartup({
      startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
      storedCollapsed: stored.leftCollapsed,
      projectWorkspace: nextProjectWorkspace,
      recentFiles: nextRecentFiles,
      fileRef: stored.fileRef || null,
      fileName: stored.fileName,
      fallbackFileName: FALLBACK_FILE_NAME
    }));
    setRightCollapsed(nextPreferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false);
    setWorkspaceView(workspaceViewForDocument(loaded.editableKind, stored.workspaceView));
    setViewFilters(nextViewFilters);
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(stored.fileName || FALLBACK_FILE_NAME);
    setFileRef(stored.fileRef || null);
    setRecentFiles(nextRecentFiles);
    setProjectWorkspace(nextProjectWorkspace);
    setProjectFileQuery("");
    setLastSavedDocument(stored.lastSavedDocument || "");
    isDirtyRef.current = !stored.lastSavedDocument || currentStoredDocument !== stored.lastSavedDocument;
    setFileTheme(nextFileTheme);
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
    setPreferences(nextPreferences);
    setFileWorkflowError(null);

    return {
      currentDocument: currentStoredDocument,
      fileRef: stored.fileRef || null,
      lastSavedDocument: stored.lastSavedDocument || "",
      preferences: nextPreferences
    };
  }

  async function openMermaidFile() {
    try {
      const result = await runtime.openFile();
      if (result.status === "fallback") {
        fileInputRef.current?.click();
        return;
      }
      if (result.status === "cancelled") return;
      if (!(await prepareFileSwitch(result.file.name))) return;
      applyLoadedDocument(result.text, result.file.name, result.file);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function newMermaidFile() {
    if (!(await prepareFileSwitch(FALLBACK_FILE_NAME))) return;

    flushSourceHistory();
    const nextGraph = parseMermaid(BLANK_FLOWCHART_SOURCE);
    const nextSource = serializeMermaid(nextGraph);
    const nextViewport = { x: 160, y: 90, scale: 1 };

    setSource(nextSource);
    setGraph(nextGraph);
    setDiagramType("flowchart");
    setEditableKind("flowchart");
    setViewport(nextViewport);
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("canvas");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_FILE_NAME);
    setFileRef(null);
    setFileTheme(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白 Mermaid 文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白 Mermaid 文件。");

    try {
      await persistStoredEditorDraft({
        source: nextSource,
        graph: nextGraph,
        viewport: nextViewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileTheme: null,
        fileName: FALLBACK_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "canvas"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  async function openFallbackFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      if (!(await prepareFileSwitch(file.name))) return;
      applyLoadedDocument(await file.text(), file.name, { name: file.name });
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openRuntimeFileRequest(file: RuntimeFileOpenRequest, source: FileOpenSource) {
    if (!isSupportedMermaidFilePath(file.path)) {
      showFileWorkflowError({ code: "unsupported_type", path: file.path }, "文件类型不支持。");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      const result = await runtime.openFilePath(file.path);
      if (result.status !== "opened") return;
      applyLoadedDocument(result.text, result.file.name, result.file, source);
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openProjectFolder() {
    setProjectBusy(true);
    try {
      const result = await runtime.openProjectFolder();
      if (result.status === "cancelled") return;
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message }, "工作区文件夹不可用。");
        return;
      }

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。" }, "打开工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setProjectFileQuery("");
      setLeftCollapsed(false);
      setStatus(`已打开工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个 Mermaid 文件。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function refreshProjectWorkspace(rootPath = projectWorkspace?.rootPath) {
    if (!rootPath) return;
    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }
      if (result.status === "cancelled") return;

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setStatus(`已刷新工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个 Mermaid 文件。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "刷新工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function closeProjectWorkspace() {
    setProjectWorkspace(null);
    setProjectFileQuery("");
    setStatus("已关闭工作区文件夹。");
    try {
      await persistStoredEditorDraft({ projectWorkspace: null });
    } catch {
      // Closing a project only affects draft metadata.
    }
  }

  function windowPointToWorkspacePoint(point: DropPoint | undefined): DropPoint | undefined {
    const surface = workspaceSurfaceRef.current;
    if (!surface || !point) return undefined;
    return windowPointToSurfacePoint(point, surface.getBoundingClientRect());
  }

  function windowPointToCanvasWorldPoint(point: DropPoint | undefined): DropPoint | undefined {
    const workspacePoint = windowPointToWorkspacePoint(point);
    if (!workspacePoint) return undefined;
    return canvasScreenToWorldPoint(workspacePoint, viewport);
  }

  function dropFeedbackForFiles(files: RuntimeFileOpenRequest[], position?: DropPoint): FileDropFeedback {
    const localPosition = windowPointToWorkspacePoint(position);
    const classification = classifyFileDrop(files);
    if (classification.kind === "mermaid") {
      return { message: "释放以打开 Mermaid 文件", tone: "ready", position: localPosition };
    }
    if (classification.kind === "image") {
      if (!isCanvasEditable || workspaceView !== "canvas") {
        return { message: "请切换到无限画布后拖入图片", tone: "blocked", position: localPosition };
      }
      return {
        message: fileRef?.path ? "释放以添加图片节点" : "释放后先保存文档再添加图片",
        tone: "ready",
        position: localPosition
      };
    }
    return { message: "不支持的文件类型", tone: "blocked", position: localPosition };
  }

  async function ensureDocumentFileForImageImport(): Promise<RuntimeFileRef | null> {
    if (fileRef?.path) return fileRef;
    const savedFile = await saveMermaidFileAsResult();
    if (savedFile?.path) return savedFile;
    if (savedFile && !savedFile.path) {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "网页版下载保存后没有稳定文件路径，无法复制本地图片资源。请使用桌面版保存到磁盘文件后再拖入图片。"
        },
        "无法导入图片。"
      );
    }
    return null;
  }

  async function importImageAssetRequest(file: RuntimeFileOpenRequest, dropPosition?: DropPoint) {
    if (!isCanvasEditable || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: file.path
        },
        "无法导入图片。"
      );
      return;
    }
    if (!isSupportedImagePath(file.path)) {
      showFileWorkflowError({ code: "unsupported_type", path: file.path }, "文件类型不支持。");
      return;
    }

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = await runtime.importImageAssetPath(targetFile, file.path);
      if (result.status !== "ready") {
        if (result.status === "unsupported") {
          showFileWorkflowError({ code: "unsupported_type", message: result.message, path: file.path }, "文件类型不支持。");
        }
        if (result.status === "needs-document") {
          showFileWorkflowError({ code: "unsupported_type", message: "请先保存 Mermaid 文件，再拖入本地图片。", path: file.path }, "无法导入图片。");
        }
        return;
      }

      const dimensions = await loadImageDimensions(result.displaySrc);
      const point = windowPointToCanvasWorldPoint(dropPosition) || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
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
        message: result.copied ? "已复制并添加拖入的图片节点。" : "已添加拖入的图片节点。",
        source: "api"
      });
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
  }

  function handleRuntimeFileDropRequest(request: RuntimeFileDropRequest) {
    if (request.type === "leave") {
      setFileDropFeedback(null);
      return;
    }

    if (request.type === "enter" || request.type === "over") {
      if (request.files.length) {
        setFileDropFeedback(dropFeedbackForFiles(request.files, request.position));
        return;
      }
      setFileDropFeedback((current) =>
        current
          ? { ...current, position: windowPointToWorkspacePoint(request.position) || current.position }
          : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(request.position) }
      );
      return;
    }

    setFileDropFeedback(null);
    const files = request.files;
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "mermaid") {
      if (files.length > 1) setStatus("已使用拖拽的第一个 Mermaid 文件。");
      void openPathRequestRef.current(classification.file, "drop");
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      void importImagePathRequestRef.current(classification.file, request.position);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path }, "文件类型不支持。");
  }

  async function openRecentFile(file: RecentFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "recent");
  }

  async function openProjectFile(file: ProjectFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "project");
  }

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileRef) {
      return saveMermaidFileAs();
    }
    if (hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要保存吗？")) return false;

    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName);
      if (result.status === "cancelled") return false;
      const savedName = ensureMermaidFileName(result.file.name);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileRef(result.file);
      setFileName(savedName);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(`已保存 ${result.file.name}。`);
      recordRecentAction("document.save", { kind: "document" }, `保存 ${result.file.name}。`);
      try {
        await persistStoredEditorDraft({ fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false });
      return true;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function saveMermaidFileAsResult(): Promise<RuntimeFileRef | null> {
    flushSourceHistory();
    if (hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要另存为吗？")) return null;
    const suggestedName = ensureMermaidFileName(fileName);
    try {
      const result = await runtime.saveFileAs(currentDocument, suggestedName);
      if (result.status === "cancelled") return null;
      const savedName = ensureMermaidFileName(result.file.name || suggestedName);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileName(savedName);
      setFileRef(result.file);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(result.downloaded ? `已下载 ${result.file.name || suggestedName}。` : `已保存 ${result.file.name || suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, result.downloaded ? `下载 ${result.file.name || suggestedName}。` : `另存为 ${result.file.name || suggestedName}。`);
      try {
        await persistStoredEditorDraft({ fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false });
      return result.file;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return null;
    }
  }

  async function saveMermaidFileAs() {
    return Boolean(await saveMermaidFileAsResult());
  }

  const postAiApplyResult = useCallback(async (result: AiApplyResult) => {
    await runtime.finishAiCommand(result);
  }, [runtime]);

  const processAiCommand = useCallback(
    async (command: AiEditorCommand) => {
      if (command.type !== "applyPatch") {
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [editorCommandDiagnostic("UNKNOWN_COMMAND", `不支持的 AI 命令：${(command as { type?: string }).type || "unknown"}`)]
        });
        return;
      }

      if (command.targetFileName && comparableMermaidFileName(command.targetFileName) !== comparableMermaidFileName(fileName)) {
        const diagnostic = editorCommandDiagnostic(
          "TARGET_FILE_MISMATCH",
          `当前打开的是 ${fileName || FALLBACK_FILE_NAME}，不是 AI 命令目标 ${command.targetFileName}。`,
          "重新打开目标 Mermaid 文件，或不要传 --target。"
        );
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [diagnostic]
        });
        setStatus("AI 修改被拒绝：目标文件不匹配。");
        return;
      }

      flushSourceHistory();
      const previousSnapshot = snapshot();
      const patched = applyMermaidPatch(currentDocument, { ops: command.ops }, { write: command.autoSave });

      if (!patched.ok || !patched.result) {
        setDiagnostics(patched.diagnostics);
        setStatus("AI 修改失败，请查看诊断。");
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: patched.diagnostics
        });
        return;
      }

      const loaded = loadMermaidDocument(patched.result.source, graph);
      const nextViewport = loaded.viewport || viewport;
      const nextLayoutMode = loaded.layoutMode;
      const nextGraph =
        loaded.editableKind === "flowchart" && nextLayoutMode === "auto"
          ? measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(loaded.graph), {
              nodes: loaded.graph.nodes.length,
              edges: loaded.graph.edges.length,
              aiApply: true
            })
          : loaded.graph;
      const nextDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, loaded.fileTheme ?? fileTheme);
      const resultDiagnostics: EditorDiagnostic[] = [];
      let saved = false;

      if (command.autoSave) {
        if (!fileRef) {
          resultDiagnostics.push(
            editorCommandDiagnostic(
              "NO_FILE_HANDLE",
              "当前编辑器没有可覆盖保存的文件路径，已更新编辑器但无法写回原文件。",
              "先打开文件，或在编辑器里另存为一次。",
              "warning"
            )
          );
        } else {
          try {
            const saveResult = await runtime.saveFile(fileRef, nextDocument, fileName);
            if (saveResult.status === "saved") {
              setFileRef(saveResult.file);
              setRecentFiles((current) => upsertRecentFile(current, saveResult.file));
            }
            saved = true;
          } catch (error) {
            resultDiagnostics.push(editorCommandDiagnostic("SAVE_FAILED", `AI 修改已应用，但保存失败：${readableError(error)}`));
          }
        }
      }

      setHistory((current) => pushHistory(current, previousSnapshot));
      setSource(loaded.source);
      setGraph(nextGraph);
      setDiagramType(loaded.diagramType);
      setEditableKind(loaded.editableKind);
      setViewport(nextViewport);
      setEdgeRouting(loaded.edgeRouting);
      setLayoutMode(nextLayoutMode);
      setFileTheme(loaded.fileTheme ?? fileTheme);
      if (loaded.fileTheme) {
        setThemeId(normalizeThemeId(loaded.fileTheme.themeId));
        setCustomTheme(loaded.fileTheme.customTheme ? normalizeEditorTheme(loaded.fileTheme.customTheme) : null);
      }
      setWorkspaceView(workspaceViewForDocument(loaded.editableKind, workspaceView));
      setSelection(emptySelection);
      setDiagnostics([]);
      if (fileRef) setFileName(ensureMermaidFileName(fileRef.name));
      if (saved) {
        setLastSavedDocument(nextDocument);
        isDirtyRef.current = false;
      }
      setStatus(saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");
      recordRecentAction("ai.apply", { kind: "document" }, saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");

      await postAiApplyResult({
        commandId: command.id,
        applied: true,
        saved,
        changed: patched.result.changed,
        fileName: fileRef?.name || fileName,
        source: nextDocument,
        diff: patched.result.diff,
        diagnostics: resultDiagnostics
      });
    },
    [currentDocument, fileName, fileRef, fileTheme, graph, postAiApplyResult, runtime, snapshot, viewport, workspaceView]
  );

  useEffect(() => {
    openPathRequestRef.current = openRuntimeFileRequest;
    importImagePathRequestRef.current = importImageAssetRequest;
    fileDropRequestRef.current = handleRuntimeFileDropRequest;
    prepareCloseRequestRef.current = prepareWindowClose;
    applyLoadedDocumentRef.current = applyLoadedDocument;
    applyStoredEditorStateRef.current = applyStoredEditorState;
  });

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (canCloseWindowRef.current) return;
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (runtime.kind !== "desktop" || desktopFileWorkflowInitializedRef.current) return;
    desktopFileWorkflowInitializedRef.current = true;
    let disposed = false;
    let unlistenExternal: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    async function restoreDesktopState() {
      try {
        const stored = (await runtime.loadSavedState()) as StoredEditor | null;
        if (!stored) return;
        const storedPreferences = normalizeEditorPreferences(stored.preferences);
        const storedProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
        setPreferences(storedPreferences);
        setRecentFiles(normalizeRecentFiles(stored.recentFiles));
        setProjectWorkspace(storedProjectWorkspace);
        if (storedProjectWorkspace) void refreshRestoredProjectWorkspace(storedProjectWorkspace.rootPath);
        if (!storedPreferences.restoreLastFile) {
          setFileName(FALLBACK_FILE_NAME);
          setFileRef(null);
          setLastSavedDocument(currentDocumentRef.current);
          isDirtyRef.current = false;
          return;
        }
        const restored = applyStoredEditorStateRef.current(stored);
        const cleanStoredFile = Boolean(
          restored.preferences.restoreLastFile &&
            restored.fileRef?.path &&
            restored.lastSavedDocument &&
            restored.currentDocument === restored.lastSavedDocument
        );
        if (!cleanStoredFile || !restored.fileRef?.path) {
          if (restored.lastSavedDocument && restored.currentDocument !== restored.lastSavedDocument) {
            setStatus("已恢复未保存草稿。");
          }
          return;
        }

        try {
          const result = await runtime.openFilePath(restored.fileRef.path);
          if (!disposed && result.status === "opened") applyLoadedDocumentRef.current(result.text, result.file.name, result.file, "restore");
        } catch (error) {
          if (!disposed) showFileWorkflowError(error, "恢复上次文件失败。");
        }
      } catch (error) {
        if (!disposed) showFileWorkflowError(error, "读取应用状态失败。");
      }
    }

    async function refreshRestoredProjectWorkspace(rootPath: string) {
      setProjectBusy(true);
      try {
        const result = await runtime.readProjectFolder(rootPath);
        if (disposed || result.status !== "opened") return;
        setProjectWorkspace(normalizeProjectWorkspace(result.workspace));
      } catch {
        // Restored project metadata is still useful if the folder cannot be refreshed.
      } finally {
        if (!disposed) setProjectBusy(false);
      }
    }

    async function registerDesktopFileWorkflow() {
      await restoreDesktopState();
      const pendingFiles = await runtime.takePendingOpenFiles();
      if (!disposed && pendingFiles[0]) await openPathRequestRef.current(pendingFiles[0], "external");
      if (!disposed) setDraftPersistenceReady(true);

      unlistenExternal = await runtime.listenForExternalFileOpen((files) => {
        const file = files[0];
        if (!file) return;
        void openPathRequestRef.current(file, "external");
      });

      unlistenDrop = await runtime.listenForFileDrops((request) => fileDropRequestRef.current(request));

      const windowRef = await getDesktopWindow();
      unlistenClose = await windowRef?.onCloseRequested(async (event) => {
        if (canCloseWindowRef.current || !isDirtyRef.current) return;
        event.preventDefault();
        const canClose = await prepareCloseRequestRef.current();
        if (!canClose) return;
        canCloseWindowRef.current = true;
        await windowRef.destroy();
      });
    }

    void registerDesktopFileWorkflow().catch((error) => {
      if (!disposed) {
        setDraftPersistenceReady(true);
        showFileWorkflowError(error, "初始化桌面文件工作流失败。");
      }
    });

    return () => {
      disposed = true;
      unlistenExternal?.();
      unlistenDrop?.();
      unlistenClose?.();
    };
  }, [runtime]);

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
    desktopTitlebarPinnedRef.current = desktopTitlebarPinned;
    if (!desktopTitlebarAutoHide) return;
    if (desktopTitlebarPinned) {
      showDesktopTitlebar();
      return;
    }
    if (desktopTitlebarVisible) scheduleDesktopTitlebarHide();
  }, [desktopTitlebarAutoHide, desktopTitlebarPinned, desktopTitlebarVisible, scheduleDesktopTitlebarHide, showDesktopTitlebar]);

  useEffect(() => {
    return () => {
      if (desktopTitlebarHideTimerRef.current) window.clearTimeout(desktopTitlebarHideTimerRef.current);
    };
  }, []);

  useEffect(() => {
    applyEditorThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (!draftPersistenceReady) return;
    if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);

    storageWriteTimerRef.current = window.setTimeout(() => {
      incrementPerformanceCounter("local-storage-write");
      void runtime.saveDraft({
          source,
          layout: layoutFromGraph(graph, viewport, edgeRouting, layoutMode, fileTheme),
          viewport,
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
  }, [source, graph, viewport, edgeRouting, layoutMode, leftCollapsed, rightCollapsed, workspaceView, viewFilters, fileName, fileRef, fileTheme, recentFiles, projectWorkspace, lastSavedDocument, themeId, customTheme, preferences, runtime, draftPersistenceReady]);

  useEffect(() => {
    if (aiContextPostTimerRef.current) window.clearTimeout(aiContextPostTimerRef.current);
    aiContextPostTimerRef.current = window.setTimeout(() => {
      void postAiEditorContext(buildCurrentAiContext());
      aiContextPostTimerRef.current = null;
    }, 220);

    return () => {
      if (aiContextPostTimerRef.current) window.clearTimeout(aiContextPostTimerRef.current);
    };
  }, [buildCurrentAiContext, postAiEditorContext]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void postAiEditorContext(buildCurrentAiContext());
    }, 3000);
    return () => window.clearInterval(timer);
  }, [buildCurrentAiContext, postAiEditorContext]);

  useEffect(() => {
    let disposed = false;

    async function pollAiCommand() {
      if (aiCommandBusyRef.current) return;
      aiCommandBusyRef.current = true;

      try {
        const command = await runtime.pollAiCommand();
        if (disposed || !command) return;
        await processAiCommand(command);
      } catch {
        // The AI command bridge is optional while a human edits in the browser.
      } finally {
        aiCommandBusyRef.current = false;
      }
    }

    const timer = window.setInterval(() => {
      void pollAiCommand();
    }, 800);
    void pollAiCommand();

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [processAiCommand, runtime]);

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
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
        performPaste();
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

  return (
    <TooltipProvider delayDuration={180}>
      <input ref={fileInputRef} type="file" accept=".mmd,.mermaid,text/plain" className="hidden" onChange={openFallbackFile} />
      <main className={cn("relative h-screen overflow-hidden bg-background", !desktopTitlebarAutoHide && "grid grid-rows-[42px_minmax(0,1fr)]")}>
        {desktopTitlebarAutoHide ? (
          <div className="absolute inset-x-0 top-0 z-30 h-3" aria-hidden onPointerEnter={showDesktopTitlebar} />
        ) : null}
        <header
          className={cn(
            "z-40 grid h-[42px] grid-cols-[minmax(220px,360px)_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background pl-3 pr-2 backdrop-blur",
            desktopTitlebarAutoHide
              ? "absolute inset-x-0 top-0 transition-transform duration-150 ease-out will-change-transform"
              : "relative",
            desktopTitlebarAutoHide && (desktopTitlebarVisible ? "translate-y-0 shadow-sm" : "-translate-y-full")
          )}
          onDoubleClick={toggleDesktopWindowMaximize}
          onPointerEnter={enterDesktopTitlebar}
          onPointerLeave={leaveDesktopTitlebar}
          onPointerDown={startDesktopWindowDrag}
          onFocus={focusDesktopTitlebar}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
            blurDesktopTitlebar();
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <img className="size-5 shrink-0 rounded-[5px] object-cover" src={activeAppLogo.href} alt="" aria-hidden />
            <div className="min-w-0">
              <h1 className="sr-only">Mermaid Canvas Editor</h1>
              <p className="truncate text-sm font-medium">{fileLabel}</p>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1" data-window-drag-exclude>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-icon hover:text-icon"
                    onClick={() => void newMermaidFile()}
                    aria-label="新建 Mermaid 文件"
                  >
                    <Plus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">新建文件</TooltipContent>
              </Tooltip>
              <FileMenu
                open={fileMenuOpen}
                recentFiles={recentFiles}
                runtimeKind={runtime.kind}
                projectBusy={projectBusy}
                onOpenChange={updateFileMenuOpen}
                onOpenFile={() => void openMermaidFile()}
                onOpenRecent={(file) => void openRecentFile(file)}
                onOpenProject={() => void openProjectFolder()}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={isDirty ? "default" : "ghost"}
                    className={isDirty ? "size-8 text-background hover:text-background" : "size-8 text-icon hover:text-icon"}
                    onClick={() => void saveMermaidFile()}
                    aria-label="保存 Mermaid 文件"
                  >
                    <FloppyDisk className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">保存文件</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-center">
            {isCanvasEditable ? <ToolModeBar mode={mode} onModeChange={changeMode} /> : null}
          </div>

          <div className="flex items-center justify-end gap-1" data-window-drag-exclude>
            <div className="flex gap-1" data-window-drag-exclude>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "canvas" && isCanvasEditable ? "default" : "ghost"}
                    className={
                      workspaceView === "canvas" && isCanvasEditable
                        ? "size-8 text-background hover:text-background"
                        : "size-8 text-icon hover:text-icon disabled:opacity-40"
                    }
                    onClick={() => {
                      if (isCanvasEditable) setWorkspaceView("canvas");
                    }}
                    disabled={!isCanvasEditable}
                    aria-label="切换到无限画布"
                  >
                    <SquareDashedMousePointer className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{canvasViewTooltip}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "render" ? "default" : "ghost"}
                    className={workspaceView === "render" ? "size-8 text-background hover:text-background" : "size-8 text-icon hover:text-icon"}
                    onClick={() => setWorkspaceView("render")}
                    aria-label="切换到渲染视图"
                  >
                    <Workflow className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">渲染视图</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "source" ? "default" : "ghost"}
                    className={workspaceView === "source" ? "size-8 text-background hover:text-background" : "size-8 text-icon hover:text-icon"}
                    onClick={() => setWorkspaceView("source")}
                    aria-label="切换到源码视图"
                  >
                    <Code className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">源码视图</TooltipContent>
              </Tooltip>
            </div>
            <ViewFilterMenu
              open={viewFiltersOpen}
              filters={viewFilters}
              hiddenCount={hiddenViewFilters}
              editable={isCanvasEditable}
              onOpenChange={updateViewFiltersOpen}
              onChange={updateViewFilter}
              onReset={resetViewFilters}
            />
            <SecondaryActionsMenu
              open={secondaryActionsOpen}
              direction={graph.direction}
              edgeRouting={edgeRouting}
              layoutMode={layoutMode}
              preferences={preferences}
              editable={isCanvasEditable}
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
              onResetView={() => updateViewport({ x: 160, y: 90, scale: 1 }, "menu")}
              onOpenThemeSettings={openThemeSettings}
            />
            <DesktopWindowControls />
          </div>
        </header>

        <div className={cn("relative z-0 min-h-0 overflow-hidden", desktopTitlebarAutoHide && "absolute inset-0")}>
          <div ref={workspaceSurfaceRef} className="absolute inset-0 z-0">
            {workspaceView === "canvas" && isCanvasEditable ? (
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
                  onEditorCommand={applyEditorCommand}
                  onLiveStateChange={updateCanvasLiveState}
                />
              </Suspense>
            ) : workspaceView === "source" ? (
              <SourcePanel
                value={source}
                title="Mermaid 源码"
                diagnostics={diagnostics}
                onChange={applySource}
                onRun={refreshFromSource}
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
          {fileDropFeedback ? <FileDropFeedbackBadge feedback={fileDropFeedback} /> : null}
          {!leftCollapsed ? (
            <div className="absolute inset-y-0 left-0 z-20 w-[clamp(300px,31vw,420px)]">
              <ExplorerPanel
                runtimeKind={runtime.kind}
                fileName={fileName}
                fileRef={fileRef}
                isDirty={isDirty}
                recentFiles={recentFiles}
                projectWorkspace={projectWorkspace}
                projectFiles={filteredProjectFiles}
                projectFileQuery={projectFileQuery}
                currentFileRef={fileRef}
                projectBusy={projectBusy}
                onNewFile={() => void newMermaidFile()}
                onOpenFile={() => void openMermaidFile()}
                onSaveFile={() => void saveMermaidFile()}
                onOpenRecent={(file) => void openRecentFile(file)}
                onOpenProject={() => void openProjectFolder()}
                onRefreshProject={() => void refreshProjectWorkspace()}
                onCloseProject={() => void closeProjectWorkspace()}
                onProjectQueryChange={setProjectFileQuery}
                onOpenProjectFile={(file) => void openProjectFile(file)}
                onCollapse={() => setLeftCollapsed(true)}
              />
            </div>
          ) : null}
          {!rightCollapsed ? (
            <aside className="absolute inset-y-0 right-0 z-20 grid w-[clamp(280px,28vw,380px)] min-h-0 border-l bg-card">
              <PanelHeader onCollapse={() => setRightCollapsed(true)} />
              <div className="grid min-h-0">
                <InspectorPanel graph={graph} selection={selection} onEditorCommand={applyEditorCommand} />
              </div>
            </aside>
          ) : null}
          {leftCollapsed ? <FloatingPanelOpenButton side="left" label="文件" revealMode={preferences.panelOpenButtonMode} onOpen={() => setLeftCollapsed(false)} /> : null}
          {rightCollapsed ? <FloatingPanelOpenButton side="right" label="侧栏" revealMode={preferences.panelOpenButtonMode} onOpen={() => setRightCollapsed(false)} /> : null}
        </div>
        {fileWorkflowError ? <FileWorkflowErrorBanner error={fileWorkflowError} onClose={() => setFileWorkflowError(null)} /> : null}
        {unsavedPrompt ? <UnsavedFilePrompt prompt={unsavedPrompt} onResolve={resolveUnsavedPrompt} /> : null}
        {preferences.statusMessages && status ? (
          <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
            {status}
          </div>
        ) : null}
        {themeSettingsOpen ? (
          <ThemeSettingsPanel
            themeId={themeId}
            customTheme={customTheme}
            activeTheme={activeTheme}
            onPreview={previewTheme}
            onCancel={cancelThemeSettings}
            onSave={saveThemeSettings}
          />
        ) : null}
      </main>
    </TooltipProvider>
  );
}

function DesktopWindowControls() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(isDesktopWindowRuntime());
  }, []);

  async function runWindowAction(action: "minimize" | "toggleMaximize" | "close") {
    try {
      const windowRef = await getDesktopWindow();
      if (!windowRef) return;
      if (action === "minimize") await windowRef.minimize();
      if (action === "toggleMaximize") await windowRef.toggleMaximize();
      if (action === "close") await windowRef.close();
    } catch {
      // Window controls are desktop-only; ignore capability/runtime failures in web-like shells.
    }
  }

  if (!available) return null;

  return (
    <div className="ml-1 flex items-center gap-0.5" data-window-drag-exclude>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-icon hover:text-icon"
            onClick={() => void runWindowAction("minimize")}
            aria-label="最小化窗口"
          >
            <Minus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">最小化</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-icon hover:text-icon"
            onClick={() => void runWindowAction("toggleMaximize")}
            aria-label="最大化或还原窗口"
          >
            <Maximize className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">最大化/还原</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-icon hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void runWindowAction("close")}
            aria-label="关闭窗口"
          >
            <Xmark className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">关闭</TooltipContent>
      </Tooltip>
    </div>
  );
}

function FileDropFeedbackBadge({ feedback }: { feedback: FileDropFeedback }) {
  const style = feedback.position
    ? {
        left: Math.max(12, feedback.position.x),
        top: Math.max(12, feedback.position.y)
      }
    : {
        left: "50%",
        top: "50%"
      };

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card/95 px-3 py-1.5 text-xs shadow-sm backdrop-blur",
        feedback.tone === "blocked" ? "border-destructive/30 text-destructive" : "border-border text-foreground"
      )}
      style={style}
    >
      {feedback.message}
    </div>
  );
}

function FileWorkflowErrorBanner({ error, onClose }: { error: FileWorkflowError; onClose: () => void }) {
  return (
    <div className="fixed left-1/2 top-14 z-[65] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 rounded-md border border-destructive/30 bg-card/95 p-3 text-sm shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <WarningTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{fileWorkflowErrorTitle(error.code)}</div>
          <div className="mt-1 break-words text-xs text-muted-foreground">{error.message}</div>
          {error.path ? <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{error.path}</div> : null}
          <div className="mt-2 text-xs text-muted-foreground">{fileWorkflowErrorSuggestion(error.code)}</div>
        </div>
        <Button size="icon" variant="ghost" className="size-7 shrink-0 text-icon hover:text-icon" onClick={onClose} aria-label="关闭文件错误提示">
          <Xmark className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function UnsavedFilePrompt({ prompt, onResolve }: { prompt: UnsavedPromptState; onResolve: (choice: UnsavedPromptChoice) => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]">
      <section className="w-[min(420px,100%)] rounded-md border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <WarningTriangle className="mt-0.5 size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-foreground">{prompt.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{prompt.description}</p>
            {prompt.targetName ? <p className="mt-2 truncate font-mono text-xs text-muted-foreground">{prompt.targetName}</p> : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="h-8 px-3" onClick={() => onResolve("cancel")}>
            取消
          </Button>
          <Button variant="outline" className="h-8 px-3" onClick={() => onResolve("discard")}>
            丢弃
          </Button>
          <Button className="h-8 px-3" onClick={() => onResolve("save")}>
            保存
          </Button>
        </div>
      </section>
    </div>
  );
}

function ExplorerPanel({
  runtimeKind,
  fileName,
  fileRef,
  isDirty,
  recentFiles,
  projectWorkspace,
  projectFiles,
  projectFileQuery,
  currentFileRef,
  projectBusy,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onOpenRecent,
  onOpenProject,
  onRefreshProject,
  onCloseProject,
  onProjectQueryChange,
  onOpenProjectFile,
  onCollapse
}: {
  runtimeKind: "web" | "desktop";
  fileName: string;
  fileRef: RuntimeFileRef | null;
  isDirty: boolean;
  recentFiles: RecentFileEntry[];
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  projectFileQuery: string;
  currentFileRef: RuntimeFileRef | null;
  projectBusy: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
  onRefreshProject: () => void;
  onCloseProject: () => void;
  onProjectQueryChange: (query: string) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onCollapse: () => void;
}) {
  const tree = useMemo(() => buildProjectFileTree(projectFiles), [projectFiles]);
  const topLevelDirectoryKey = useMemo(
    () => tree.filter((node): node is Extract<ProjectTreeNode, { kind: "directory" }> => node.kind === "directory").map((node) => node.id).join("\n"),
    [tree]
  );
  const allDirectoryIds = useMemo(() => projectTreeDirectoryIds(tree), [tree]);
  const [expandedDirectoryIds, setExpandedDirectoryIds] = useState<Set<string>>(() => new Set());
  const queryActive = Boolean(projectFileQuery.trim());
  const visibleExpandedIds = queryActive ? new Set(allDirectoryIds) : expandedDirectoryIds;
  const projectAvailable = runtimeKind === "desktop";
  const recentPreview = recentFiles.slice(0, 3);

  useEffect(() => {
    setExpandedDirectoryIds(new Set(topLevelDirectoryKey ? topLevelDirectoryKey.split("\n") : []));
  }, [projectWorkspace?.rootPath, topLevelDirectoryKey]);

  function toggleDirectory(id: string) {
    setExpandedDirectoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="grid h-full min-h-0 grid-rows-[42px_auto_minmax(0,1fr)_auto] border-r bg-card">
      <header className="flex min-w-0 items-center justify-between gap-2 border-b bg-card/95 px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">资源管理器</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" onClick={onNewFile} aria-label="新建 Mermaid 文件">
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">新建文件</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" onClick={onOpenFile} aria-label="打开 Mermaid 文件">
                <Folder className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">打开文件</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isDirty ? "default" : "ghost"}
                className={isDirty ? "size-8 text-background hover:text-background" : "size-8 text-icon hover:text-icon"}
                onClick={onSaveFile}
                aria-label="保存 Mermaid 文件"
              >
                <FloppyDisk className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">保存文件</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" onClick={onCollapse} aria-label="收起资源管理器">
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">收起资源管理器</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className={cn("flex min-w-0 items-center gap-2 border-b px-3 py-2", isDirty && "bg-primary/5")}>
        <EmptyPage className="size-4 shrink-0 text-icon" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-xs font-medium" title={fileName}>
              {fileName}
            </div>
            {isDirty ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="有未保存修改" /> : null}
          </div>
          <div className="truncate text-[11px] text-muted-foreground" title={fileRef?.path}>
            {fileRef?.path || "未保存草稿"}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <ExplorerSectionTitle>文件夹</ExplorerSectionTitle>
            <div className="truncate text-[11px] text-muted-foreground" title={projectWorkspace?.rootPath}>
              {projectWorkspace
                ? `${projectWorkspace.rootName} · ${projectWorkspace.files.length}${projectWorkspace.truncated ? "+" : ""} 个 Mermaid 文件`
                : projectAvailable
                  ? "打开文件后会自动显示同目录图表"
                  : "桌面版支持文件夹浏览"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" disabled={!projectAvailable || projectBusy} onClick={onOpenProject} aria-label="打开工作区文件夹">
                  <Folder className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">打开文件夹</TooltipContent>
            </Tooltip>
            {projectWorkspace ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" disabled={projectBusy} onClick={onRefreshProject} aria-label="刷新工作区文件">
                      <RefreshCw className={cn("size-4", projectBusy && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">刷新文件夹</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" disabled={projectBusy} onClick={onCloseProject} aria-label="关闭工作区文件夹">
                      <Xmark className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">关闭文件夹</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 border-b px-3 py-2">
          <Input
            value={projectFileQuery}
            onChange={(event) => onProjectQueryChange(event.target.value)}
            placeholder="筛选 .mmd / .mermaid"
            className="h-7 px-2 text-xs"
            disabled={!projectWorkspace}
          />
          {projectWorkspace?.truncated ? <div className="text-[11px] text-muted-foreground">文件较多，已显示前 500 个结果。</div> : null}
        </div>

        <div className="min-h-0 overflow-y-auto px-1 py-1.5">
          {!projectWorkspace ? (
            <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
          ) : tree.length ? (
            <div className="grid gap-0.5">
              {tree.map((node) => (
                <ProjectTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={visibleExpandedIds}
                  currentFileRef={currentFileRef}
                  onToggleDirectory={toggleDirectory}
                  onOpenProjectFile={onOpenProjectFile}
                />
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">没有匹配的 Mermaid 文件</div>
          )}
        </div>
      </div>

      <div className="grid gap-1 border-t px-2 py-2">
        <div className="flex items-center justify-between px-1">
          <ExplorerSectionTitle>最近</ExplorerSectionTitle>
          {recentFiles.length > recentPreview.length ? <span className="text-[11px] text-muted-foreground">{recentFiles.length}</span> : null}
        </div>
        {recentPreview.length ? (
          <div className="grid gap-0.5">
            {recentPreview.map((file) => (
              <Button
                key={file.path}
                variant="ghost"
                className="h-7 justify-start gap-2 px-2 text-left text-foreground [&_svg]:text-icon"
                title={file.path}
                onClick={() => onOpenRecent(file)}
              >
                <ClockRotateRight className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
              </Button>
            ))}
          </div>
        ) : (
          <div className="px-1 text-[11px] text-muted-foreground">暂无最近文件</div>
        )}
      </div>
    </aside>
  );
}

function ExplorerSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">{children}</div>;
}

function WorkspaceFolderEmptyState({
  projectAvailable,
  projectBusy,
  onOpenProject
}: {
  projectAvailable: boolean;
  projectBusy: boolean;
  onOpenProject: () => void;
}) {
  return (
    <div className="grid gap-2 px-2 py-3">
      <div className="text-xs text-muted-foreground">{projectAvailable ? "打开 Mermaid 文件后会自动显示同目录图表" : "桌面版支持文件夹浏览"}</div>
      <Button variant="outline" className="h-8 justify-start px-2 text-xs" disabled={!projectAvailable || projectBusy} onClick={onOpenProject}>
        <Folder className="size-4" />
        选择文件夹
      </Button>
    </div>
  );
}

function ProjectTreeRow({
  node,
  depth,
  expandedIds,
  currentFileRef,
  onToggleDirectory,
  onOpenProjectFile
}: {
  node: ProjectTreeNode;
  depth: number;
  expandedIds: Set<string>;
  currentFileRef: RuntimeFileRef | null;
  onToggleDirectory: (id: string) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
}) {
  const paddingLeft = 8 + depth * 14;

  if (node.kind === "directory") {
    const expanded = expandedIds.has(node.id);
    return (
      <div className="grid gap-0.5">
        <Button
          type="button"
          variant="ghost"
          className="h-7 justify-start gap-1 px-2 text-left text-foreground [&_svg]:text-icon"
          style={{ paddingLeft }}
          aria-expanded={expanded}
          onClick={() => onToggleDirectory(node.id)}
          title={node.relativePath}
        >
          {expanded ? <NavArrowDown className="size-3.5 shrink-0" /> : <NavArrowRight className="size-3.5 shrink-0" />}
          <Folder className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
          <span className="text-[11px] text-muted-foreground">{node.fileCount}</span>
        </Button>
        {expanded
          ? node.children.map((child) => (
              <ProjectTreeRow
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                currentFileRef={currentFileRef}
                onToggleDirectory={onToggleDirectory}
                onOpenProjectFile={onOpenProjectFile}
              />
            ))
          : null}
      </div>
    );
  }

  const active = isProjectFileActive(node.file, currentFileRef);
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className="h-7 justify-start gap-2 px-2 text-left text-foreground [&_svg]:text-icon"
      style={{ paddingLeft }}
      title={node.file.path}
      onClick={() => onOpenProjectFile(node.file)}
    >
      <EmptyPage className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
    </Button>
  );
}

function FileMenu({
  open,
  recentFiles,
  runtimeKind,
  projectBusy,
  onOpenChange,
  onOpenFile,
  onOpenRecent,
  onOpenProject
}: {
  open: boolean;
  recentFiles: RecentFileEntry[];
  runtimeKind: "web" | "desktop";
  projectBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });
  const projectAvailable = runtimeKind === "desktop";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-icon hover:text-icon"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            aria-label="文件"
          >
            <Folder className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">文件</TooltipContent>
      </Tooltip>

      {open ? (
        <div className="absolute left-0 top-10 z-50 w-72 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-sm">
          <div className="grid gap-0.5">
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={() => runAndClose(onOpenFile)}>
              <Folder className="size-4" />
              打开文件
            </Button>
            {projectAvailable ? (
              <Button
                variant="ghost"
                className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon"
                disabled={projectBusy}
                onClick={() => runAndClose(onOpenProject)}
              >
                <Workflow className="size-4" />
                打开文件夹
              </Button>
            ) : null}
            <Separator className="my-1" />
            <div className="px-2 py-1 text-xs text-muted-foreground">最近打开</div>
            {recentFiles.length ? (
              recentFiles.map((file) => (
                <Button
                  key={file.path}
                  variant="ghost"
                  className="h-9 justify-start gap-2 px-2 text-left text-foreground [&_svg]:text-icon"
                  title={file.path}
                  onClick={() => runAndClose(() => onOpenRecent(file))}
                >
                  <ClockRotateRight className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                </Button>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">暂无最近文件</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ViewFilterMenu({
  open,
  filters,
  hiddenCount,
  editable,
  onOpenChange,
  onChange,
  onReset
}: {
  open: boolean;
  filters: ViewFilters;
  hiddenCount: number;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: ViewFilters, message: string) => void;
  onReset: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });

  useEffect(() => {
    if (open && !editable) onOpenChange(false);
  }, [editable, onOpenChange, open]);

  function toggleTopLevel(key: keyof Pick<ViewFilters, "nodes" | "subgraphs" | "edges" | "nodeLabels" | "edgeLabels" | "grid">, label: string) {
    const nextVisible = !filters[key];
    onChange({ ...filters, [key]: nextVisible }, `${nextVisible ? "显示" : "隐藏"}${label}。`);
  }

  function toggleEdgeStyle(style: EdgeStyle) {
    const nextVisible = !filters.edgeStyles[style];
    onChange(
      { ...filters, edgeStyles: { ...filters.edgeStyles, [style]: nextVisible } },
      `${nextVisible ? "显示" : "隐藏"}${edgeStyleFilterLabels[style]}连线。`
    );
  }

  function toggleArrowType(arrowType: FlowchartArrowType) {
    const nextVisible = !filters.arrowTypes[arrowType];
    onChange(
      { ...filters, arrowTypes: { ...filters.arrowTypes, [arrowType]: nextVisible } },
      `${nextVisible ? "显示" : "隐藏"}${arrowTypeFilterLabels[arrowType]}连线。`
    );
  }

  function showNodesOnly() {
    onChange(
      {
        ...DEFAULT_VIEW_FILTERS,
        subgraphs: false,
        edges: false,
        edgeLabels: false,
        grid: false
      },
      "已切换为仅显示节点。"
    );
  }

  function hideLabels() {
    onChange({ ...filters, nodeLabels: false, edgeLabels: false }, "已隐藏全部标签。");
  }

  function hideEdges() {
    onChange({ ...filters, edges: false }, "已隐藏所有连线。");
  }

  return (
    <div ref={menuRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={hiddenCount > 0 ? "default" : "ghost"}
            className={hiddenCount > 0 ? "size-8 text-background hover:text-background" : "size-8 text-icon hover:text-icon disabled:opacity-40"}
            onClick={() => onOpenChange(!open)}
            disabled={!editable}
            aria-expanded={open}
            aria-label="视图过滤器"
          >
            <FilterAlt className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{hiddenCount > 0 ? `视图过滤器：已隐藏 ${hiddenCount} 项` : "视图过滤器"}</TooltipContent>
      </Tooltip>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-md border bg-popover p-2 text-popover-foreground shadow-sm">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-medium text-foreground">视图过滤器</span>
            <span className="text-[11px] text-muted-foreground">{hiddenCount > 0 ? `隐藏 ${hiddenCount} 项` : "全部显示"}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={onReset}>
              <Eye className="size-4" />
              全部显示
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={hideEdges}>
              <Link className="size-4" />
              隐藏连线
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={showNodesOnly}>
              <SquareDashedMousePointer className="size-4" />
              仅节点
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={hideLabels}>
              <Text className="size-4" />
              隐藏标签
            </Button>
          </div>
          <Separator className="my-2" />
          <div className="grid gap-1">
            <FilterToggle active={filters.nodes} icon={<SquareDashedMousePointer className="size-4" />} label="节点" onClick={() => toggleTopLevel("nodes", "节点")} />
            <FilterToggle active={filters.subgraphs} icon={<GroupIcon className="size-4" />} label="分组" onClick={() => toggleTopLevel("subgraphs", "分组")} />
            <FilterToggle active={filters.edges} icon={<Link className="size-4" />} label="连线" onClick={() => toggleTopLevel("edges", "连线")} />
            <FilterToggle active={filters.nodeLabels} icon={<Text className="size-4" />} label="节点标签" onClick={() => toggleTopLevel("nodeLabels", "节点标签")} />
            <FilterToggle active={filters.edgeLabels} icon={<LabelIcon />} label="连线标签" onClick={() => toggleTopLevel("edgeLabels", "连线标签")} />
            <FilterToggle active={filters.grid} icon={<Grid3X3 className="size-4" />} label="网格" onClick={() => toggleTopLevel("grid", "网格")} />
          </div>
          <Separator className="my-2" />
          <div className="grid gap-1 px-1">
            <span className="text-xs text-muted-foreground">连线类型</span>
            <div className="grid grid-cols-3 gap-1">
              {EDGE_STYLE_FILTERS.map((style) => (
                <FilterToggle key={style} compact active={filters.edgeStyles[style]} label={edgeStyleFilterLabels[style]} onClick={() => toggleEdgeStyle(style)} />
              ))}
            </div>
          </div>
          <Separator className="my-2" />
          <div className="grid gap-1 px-1">
            <span className="text-xs text-muted-foreground">箭头类型</span>
            <div className="grid grid-cols-2 gap-1">
              {ARROW_TYPE_FILTERS.map((arrowType) => (
                <FilterToggle key={arrowType} compact active={filters.arrowTypes[arrowType]} label={arrowTypeFilterLabels[arrowType]} onClick={() => toggleArrowType(arrowType)} />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterToggle({ active, label, icon, compact = false, onClick }: { active: boolean; label: string; icon?: ReactNode; compact?: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-8 justify-start px-2 text-foreground [&_svg]:text-icon",
        compact ? "gap-1.5 text-xs" : "",
        !active ? "text-muted-foreground" : ""
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>
        {active ? <Eye className="size-4" /> : <EyeClosed className="size-4" />}
      </span>
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

function PreferenceToggle({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-8 justify-start gap-2 px-2 text-foreground [&_svg]:text-icon", !active && "text-muted-foreground")}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={cn("flex size-4 shrink-0 items-center justify-center", active ? "text-icon" : "text-muted-foreground")}>
        {active ? <Eye className="size-4" /> : <EyeClosed className="size-4" />}
      </span>
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
}

function LabelIcon() {
  return <Text className="size-4" />;
}

function SecondaryActionsMenu({
  open,
  direction,
  edgeRouting,
  layoutMode,
  preferences,
  editable,
  onOpenChange,
  onAddNode,
  onAddImageNode,
  onCreateGroup,
  onSaveAs,
  onDirectionChange,
  onEdgeRoutingChange,
  onLayoutModeChange,
  onPreferencesChange,
  onRefreshSource,
  onSyncAutoLayout,
  onResetView,
  onOpenThemeSettings
}: {
  open: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  preferences: EditorPreferences;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: () => void;
  onAddImageNode: () => void;
  onCreateGroup: () => void;
  onSaveAs: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onLayoutModeChange: (layoutMode: LayoutMode) => void;
  onPreferencesChange: (preferences: EditorPreferences, message?: string) => void;
  onRefreshSource: () => void;
  onSyncAutoLayout: () => void;
  onResetView: () => void;
  onOpenThemeSettings: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });

  useEffect(() => {
    if (open && !editable) onOpenChange(false);
  }, [editable, onOpenChange, open]);

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  function updatePreference(nextPreferences: EditorPreferences, message: string) {
    onPreferencesChange(nextPreferences, message);
  }

  return (
    <div ref={menuRef} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-icon hover:text-icon"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            aria-label="更多操作"
          >
            <MoreHoriz className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">更多操作</TooltipContent>
      </Tooltip>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-md border bg-popover p-1.5 text-popover-foreground">
          <div className="grid gap-0.5">
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onAddNode)}
              disabled={!editable}
            >
              <Plus className="size-4" />
              新增节点
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onAddImageNode)}
              disabled={!editable}
            >
              <FrameSimple className="size-4" />
              添加图片节点
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onCreateGroup)}
              disabled={!editable}
            >
              <SquareDashedMousePointer className="size-4" />
              选中内容成组
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={() => runAndClose(onSaveAs)}>
              <FloppyDiskArrowOut className="size-4" />
              另存为
            </Button>
            <Separator className="my-1" />
            <div className="grid gap-1.5 px-2 py-1.5">
              <span className="text-xs text-muted-foreground">方向</span>
              <Select
                value={direction}
                onValueChange={(value) => {
                  onDirectionChange(value as GraphDirection);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {directions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div className="grid gap-1.5 px-2 py-1.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PositionAlign className="size-3.5 text-icon" />
                布局模式
              </span>
              <Select
                value={layoutMode}
                onValueChange={(value) => {
                  onLayoutModeChange(value as LayoutMode);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {layoutModeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div className="grid gap-1.5 px-2 py-1.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PathArrow className="size-3.5 text-icon" />
                连线形状
              </span>
              <Select
                value={edgeRouting}
                onValueChange={(value) => {
                  onEdgeRoutingChange(value as EdgeRouting);
                }}
                disabled={!editable}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {edgeRoutingOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator className="my-1" />
            <div className="grid gap-0.5 px-1 py-1">
              <span className="flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground">
                <Eye className="size-3.5 text-icon" />
                应用设置
              </span>
              <div className="grid gap-1.5 px-1 py-1">
                <span className="text-xs text-muted-foreground">应用 LOGO</span>
                <Select
                  value={preferences.appLogo}
                  onValueChange={(value) => {
                    updatePreference({ ...preferences, appLogo: normalizeAppLogoId(value) }, "应用 LOGO 已切换。");
                  }}
                >
                  <SelectTrigger className="h-8 gap-2">
                    <img className="size-4 shrink-0 rounded-[4px] object-cover" src={appLogoById(preferences.appLogo).href} alt="" aria-hidden />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_LOGOS.map((logo) => (
                      <SelectItem key={logo.id} value={logo.id}>
                        {logo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <PreferenceToggle
                active={preferences.startWithPanelsCollapsed}
                icon={<PanelLeftOpen className="size-4" />}
                label="启动时收起侧栏"
                onClick={() =>
                  updatePreference(
                    { ...preferences, startWithPanelsCollapsed: !preferences.startWithPanelsCollapsed },
                    preferences.startWithPanelsCollapsed ? "启动时将恢复侧栏状态。" : "启动时将收起两侧栏。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.panelOpenButtonMode === "hover"}
                icon={<PanelRightOpen className="size-4" />}
                label="侧栏入口悬停显示"
                onClick={() =>
                  updatePreference(
                    { ...preferences, panelOpenButtonMode: preferences.panelOpenButtonMode === "hover" ? "always" : "hover" },
                    preferences.panelOpenButtonMode === "hover" ? "侧栏入口将始终显示。" : "侧栏入口将仅在悬停时显示。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.statusMessages}
                icon={<Text className="size-4" />}
                label="底部操作消息"
                onClick={() =>
                  updatePreference(
                    { ...preferences, statusMessages: !preferences.statusMessages },
                    preferences.statusMessages ? "底部操作消息已隐藏。" : "底部操作消息已显示。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.desktopTitlebarAutoHide}
                icon={<PanelRightClose className="size-4" />}
                label="桌面标题栏自动隐藏"
                onClick={() =>
                  updatePreference(
                    { ...preferences, desktopTitlebarAutoHide: !preferences.desktopTitlebarAutoHide },
                    preferences.desktopTitlebarAutoHide ? "桌面标题栏将常驻显示。" : "桌面标题栏将自动隐藏。"
                  )
                }
              />
              <PreferenceToggle
                active={preferences.restoreLastFile}
                icon={<ClockRotateRight className="size-4" />}
                label="启动时恢复上次文件"
                onClick={() =>
                  updatePreference(
                    { ...preferences, restoreLastFile: !preferences.restoreLastFile },
                    preferences.restoreLastFile ? "启动时将打开默认空白文件。" : "启动时将恢复上次文件。"
                  )
                }
              />
            </div>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={() => runAndClose(onOpenThemeSettings)}>
              <ColorWheel className="size-4" />
              主题
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-icon" onClick={() => runAndClose(onRefreshSource)}>
              <RefreshCw className="size-4" />
              从源码刷新
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onSyncAutoLayout)}
              disabled={!editable}
            >
              <PositionAlign className="size-4" />
              立即自动布局
            </Button>
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onResetView)}
              disabled={!editable}
            >
              <Maximize2 className="size-4" />
              重置画布视图
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeSettingsPanel({
  themeId,
  customTheme,
  activeTheme,
  onPreview,
  onCancel,
  onSave
}: {
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  activeTheme: EditorTheme;
  onPreview: (themeId: EditorThemeId, customTheme: EditorTheme | null) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  function selectTheme(value: string) {
    const nextThemeId = normalizeThemeId(value);
    if (nextThemeId === "custom") {
      onPreview("custom", customTheme || toCustomTheme(activeTheme));
      return;
    }
    onPreview(nextThemeId, customTheme);
  }

  function updateCustomTheme(updater: (theme: EditorTheme) => EditorTheme) {
    onPreview("custom", updater(toCustomTheme(activeTheme)));
  }

  function updateUiColor(key: keyof EditorTheme["ui"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, ui: { ...theme.ui, [key]: value } }));
  }

  function updateCanvasColor(key: keyof EditorTheme["canvas"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, canvas: { ...theme.canvas, [key]: value } }));
  }

  function updateSourceColor(key: keyof EditorTheme["source"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, source: { ...theme.source, [key]: value } }));
  }

  function updateRenderColor(key: keyof EditorTheme["render"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, render: { ...theme.render, [key]: value } }));
  }

  function updateFontNumber(key: NumberKeys<EditorTheme["font"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, font: { ...theme.font, [key]: value } }));
  }

  function updateSpaceNumber(key: NumberKeys<EditorTheme["space"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, space: { ...theme.space, [key]: value } }));
  }

  function updateRadiusNumber(key: NumberKeys<EditorTheme["radius"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, radius: { ...theme.radius, [key]: value } }));
  }

  function updateStrokeNumber(key: NumberKeys<EditorTheme["stroke"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, stroke: { ...theme.stroke, [key]: value } }));
  }

  function updateCanvasInteractionNumber(key: NumberKeys<EditorTheme["canvasInteraction"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, canvasInteraction: { ...theme.canvasInteraction, [key]: value } }));
  }

  function updateSubgraphNumber(key: NumberKeys<EditorTheme["subgraph"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, subgraph: { ...theme.subgraph, [key]: value } }));
  }

  function updateEdgeLabelNumber(key: NumberKeys<EditorTheme["edgeLabel"]>, value: number) {
    updateCustomTheme((theme) => ({ ...theme, edgeLabel: { ...theme.edgeLabel, [key]: value } }));
  }

  const themeDiagnostics = useMemo(() => compileEditorTheme(activeTheme).diagnostics, [activeTheme]);

  return (
    <div className="fixed inset-0 z-[70] bg-foreground/10">
      <section className="absolute inset-y-0 right-0 grid w-[min(460px,100vw)] grid-rows-[52px_minmax(0,1fr)_56px] border-l bg-card">
        <header className="flex items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <ColorWheel className="size-4 text-icon" />
            <h2 className="text-sm font-medium">主题</h2>
          </div>
          <Button size="sm" variant="ghost" className="text-icon hover:text-icon" onClick={onCancel}>
            取消
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>预设</Label>
              <Select value={themeId} onValueChange={selectTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUILT_IN_EDITOR_THEMES.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">自定义主题</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" className="h-8 px-2" onClick={() => onPreview("custom", toCustomTheme(activeTheme))}>
                  复制当前
                </Button>
                <Button variant="ghost" className="h-8 px-2" onClick={() => onPreview(DEFAULT_EDITOR_THEME.id, null)}>
                  恢复默认
                </Button>
              </div>
            </div>

            <ThemePreview theme={activeTheme} />

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">界面</h3>
              <ThemeColorField label="背景" value={activeTheme.ui.background} onChange={(value) => updateUiColor("background", value)} />
              <ThemeColorField label="文字" value={activeTheme.ui.foreground} onChange={(value) => updateUiColor("foreground", value)} />
              <ThemeColorField label="图标" value={activeTheme.ui.icon} onChange={(value) => updateUiColor("icon", value)} />
              <ThemeColorField label="面板" value={activeTheme.ui.card} onChange={(value) => updateUiColor("card", value)} />
              <ThemeColorField label="浮层" value={activeTheme.ui.popover} onChange={(value) => updateUiColor("popover", value)} />
              <ThemeColorField label="边框" value={activeTheme.ui.border} onChange={(value) => updateUiColor("border", value)} />
              <ThemeColorField label="强调" value={activeTheme.ui.primary} onChange={(value) => updateUiColor("primary", value)} />
              <ThemeColorField label="次级" value={activeTheme.ui.secondary} onChange={(value) => updateUiColor("secondary", value)} />
              <ThemeColorField label="弱背景" value={activeTheme.ui.muted} onChange={(value) => updateUiColor("muted", value)} />
              <ThemeColorField label="弱文字" value={activeTheme.ui.mutedForeground} onChange={(value) => updateUiColor("mutedForeground", value)} />
              <ThemeColorField label="轻强调" value={activeTheme.ui.accent} onChange={(value) => updateUiColor("accent", value)} />
              <ThemeColorField label="强调文字" value={activeTheme.ui.accentForeground} onChange={(value) => updateUiColor("accentForeground", value)} />
              <ThemeColorField label="危险" value={activeTheme.ui.destructive} onChange={(value) => updateUiColor("destructive", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">画布颜色</h3>
              <ThemeColorField label="表面" value={activeTheme.canvas.surface} onChange={(value) => updateCanvasColor("surface", value)} />
              <ThemeColorField label="节点描边" value={activeTheme.canvas.nodeStroke} onChange={(value) => updateCanvasColor("nodeStroke", value)} />
              <ThemeColorField label="节点文字" value={activeTheme.canvas.nodeText} onChange={(value) => updateCanvasColor("nodeText", value)} />
              <ThemeColorField label="连线" value={activeTheme.canvas.edge} onChange={(value) => updateCanvasColor("edge", value)} />
              <ThemeColorField label="连线文字" value={activeTheme.canvas.edgeText} onChange={(value) => updateCanvasColor("edgeText", value)} />
              <ThemeColorField label="标签描边" value={activeTheme.canvas.labelStroke} onChange={(value) => updateCanvasColor("labelStroke", value)} />
              <ThemeColorField label="非法连接" value={activeTheme.canvas.connectionInvalid} onChange={(value) => updateCanvasColor("connectionInvalid", value)} />
              <ThemeColorField label="无效预览" value={activeTheme.canvas.previewInvalid} onChange={(value) => updateCanvasColor("previewInvalid", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">源码与渲染</h3>
              <ThemeColorField label="行分隔" value={activeTheme.source.line} onChange={(value) => updateSourceColor("line", value)} />
              <ThemeColorField label="渲染背景" value={activeTheme.render.background} onChange={(value) => updateRenderColor("background", value)} />
              <ThemeColorField label="渲染网格" value={activeTheme.render.gridDot} onChange={(value) => updateRenderColor("gridDot", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">节点</h3>
              <ThemeNumberField label="字号" value={activeTheme.font.sizeNode} min={10} max={28} step={1} onChange={(value) => updateFontNumber("sizeNode", value)} />
              <ThemeNumberField label="行高" value={activeTheme.font.lineHeightNode} min={12} max={42} step={1} onChange={(value) => updateFontNumber("lineHeightNode", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.space.nodePaddingX} min={4} max={40} step={1} onChange={(value) => updateSpaceNumber("nodePaddingX", value)} />
              <ThemeNumberField label="纵向内边距" value={activeTheme.space.nodePaddingY} min={4} max={40} step={1} onChange={(value) => updateSpaceNumber("nodePaddingY", value)} />
              <ThemeNumberField label="最小字符" value={activeTheme.space.nodeMinChars} min={2} max={24} step={1} onChange={(value) => updateSpaceNumber("nodeMinChars", value)} />
              <ThemeNumberField label="最大字符" value={activeTheme.space.nodeMaxChars} min={8} max={60} step={1} onChange={(value) => updateSpaceNumber("nodeMaxChars", value)} />
              <ThemeNumberField label="最大行数" value={activeTheme.space.nodeMaxLines} min={2} max={30} step={1} onChange={(value) => updateSpaceNumber("nodeMaxLines", value)} />
              <ThemeNumberField label="节点圆角" value={activeTheme.radius.canvasNode} min={0} max={48} step={1} onChange={(value) => updateRadiusNumber("canvasNode", value)} />
              <ThemeNumberField label="多边形圆角" value={activeTheme.radius.polygonCorner} min={0} max={24} step={1} onChange={(value) => updateRadiusNumber("polygonCorner", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">连线标签</h3>
              <ThemeNumberField label="字号" value={activeTheme.edgeLabel.fontSize} min={9} max={24} step={1} onChange={(value) => updateEdgeLabelNumber("fontSize", value)} />
              <ThemeNumberField label="行高" value={activeTheme.edgeLabel.lineHeight} min={10} max={36} step={1} onChange={(value) => updateEdgeLabelNumber("lineHeight", value)} />
              <ThemeNumberField label="高度" value={activeTheme.edgeLabel.height} min={18} max={64} step={1} onChange={(value) => updateEdgeLabelNumber("height", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.edgeLabel.paddingX} min={2} max={32} step={1} onChange={(value) => updateEdgeLabelNumber("paddingX", value)} />
              <ThemeNumberField label="最小字符" value={activeTheme.edgeLabel.minChars} min={1} max={20} step={1} onChange={(value) => updateEdgeLabelNumber("minChars", value)} />
              <ThemeNumberField label="最大字符" value={activeTheme.edgeLabel.maxChars} min={4} max={60} step={1} onChange={(value) => updateEdgeLabelNumber("maxChars", value)} />
              <ThemeNumberField label="标签圆角" value={activeTheme.radius.edgeLabel} min={0} max={24} step={1} onChange={(value) => updateRadiusNumber("edgeLabel", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">分组</h3>
              <ThemeNumberField label="标题字号" value={activeTheme.subgraph.titleFontSize} min={9} max={24} step={1} onChange={(value) => updateSubgraphNumber("titleFontSize", value)} />
              <ThemeNumberField label="标题高度" value={activeTheme.subgraph.titleHeight} min={18} max={56} step={1} onChange={(value) => updateSubgraphNumber("titleHeight", value)} />
              <ThemeNumberField label="横向内边距" value={activeTheme.subgraph.paddingX} min={8} max={96} step={1} onChange={(value) => updateSubgraphNumber("paddingX", value)} />
              <ThemeNumberField label="顶部内边距" value={activeTheme.subgraph.paddingTop} min={24} max={120} step={1} onChange={(value) => updateSubgraphNumber("paddingTop", value)} />
              <ThemeNumberField label="底部内边距" value={activeTheme.subgraph.paddingBottom} min={8} max={96} step={1} onChange={(value) => updateSubgraphNumber("paddingBottom", value)} />
              <ThemeNumberField label="最小宽度" value={activeTheme.subgraph.minWidth} min={80} max={520} step={4} onChange={(value) => updateSubgraphNumber("minWidth", value)} />
              <ThemeNumberField label="最小高度" value={activeTheme.subgraph.minHeight} min={60} max={360} step={4} onChange={(value) => updateSubgraphNumber("minHeight", value)} />
              <ThemeNumberField label="填充透明" value={activeTheme.subgraph.fillOpacity} min={0} max={1} step={0.01} onChange={(value) => updateSubgraphNumber("fillOpacity", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">线与交互</h3>
              <ThemeNumberField label="节点线宽" value={activeTheme.stroke.node} min={0.5} max={8} step={0.5} onChange={(value) => updateStrokeNumber("node", value)} />
              <ThemeNumberField label="节点强调" value={activeTheme.stroke.nodeEmphasized} min={0.5} max={10} step={0.5} onChange={(value) => updateStrokeNumber("nodeEmphasized", value)} />
              <ThemeNumberField label="连线线宽" value={activeTheme.stroke.edge} min={0.5} max={10} step={0.5} onChange={(value) => updateStrokeNumber("edge", value)} />
              <ThemeNumberField label="粗连线" value={activeTheme.stroke.edgeThick} min={1} max={14} step={0.5} onChange={(value) => updateStrokeNumber("edgeThick", value)} />
              <ThemeNumberField label="覆盖线宽" value={activeTheme.stroke.overlay} min={0.5} max={6} step={0.5} onChange={(value) => updateStrokeNumber("overlay", value)} />
              <ThemeNumberField label="锚点线宽" value={activeTheme.stroke.anchor} min={0.5} max={8} step={0.5} onChange={(value) => updateStrokeNumber("anchor", value)} />
              <ThemeNumberField label="锚点半径" value={activeTheme.canvasInteraction.anchorRadius} min={3} max={16} step={0.5} onChange={(value) => updateCanvasInteractionNumber("anchorRadius", value)} />
              <ThemeNumberField label="端点半径" value={activeTheme.canvasInteraction.endpointRadius} min={3} max={18} step={0.5} onChange={(value) => updateCanvasInteractionNumber("endpointRadius", value)} />
              <ThemeNumberField label="命中宽度" value={activeTheme.canvasInteraction.edgeHitStrokeWidth} min={8} max={40} step={1} onChange={(value) => updateCanvasInteractionNumber("edgeHitStrokeWidth", value)} />
              <ThemeNumberField label="箭头长度" value={activeTheme.canvasInteraction.pointerLength} min={0} max={32} step={1} onChange={(value) => updateCanvasInteractionNumber("pointerLength", value)} />
              <ThemeNumberField label="箭头宽度" value={activeTheme.canvasInteraction.pointerWidth} min={0} max={32} step={1} onChange={(value) => updateCanvasInteractionNumber("pointerWidth", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">网格</h3>
              <ThemeNumberField label="小格步长" value={activeTheme.space.gridMinorStep} min={8} max={80} step={1} onChange={(value) => updateSpaceNumber("gridMinorStep", value)} />
              <ThemeNumberField label="主格倍率" value={activeTheme.space.gridMajorEvery} min={2} max={12} step={1} onChange={(value) => updateSpaceNumber("gridMajorEvery", value)} />
              <ThemeNumberField label="小格透明" value={activeTheme.canvasInteraction.gridMinorAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridMinorAlpha", value)} />
              <ThemeNumberField label="主格透明" value={activeTheme.canvasInteraction.gridMajorAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridMajorAlpha", value)} />
              <ThemeNumberField label="远景透明" value={activeTheme.canvasInteraction.gridSuperAlpha} min={0} max={1} step={0.01} onChange={(value) => updateCanvasInteractionNumber("gridSuperAlpha", value)} />
              <ThemeNumberField label="点数上限" value={activeTheme.canvasInteraction.gridMaxDots} min={800} max={20000} step={100} onChange={(value) => updateCanvasInteractionNumber("gridMaxDots", value)} />
            </div>

            {themeDiagnostics.length ? (
              <div className="grid gap-2 rounded-md border border-destructive/30 bg-background/60 p-3">
                <h3 className="text-xs font-medium text-destructive">主题诊断</h3>
                {themeDiagnostics.map((diagnostic) => (
                  <p key={diagnostic.code} className="text-xs text-muted-foreground">
                    {diagnostic.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-4">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onSave}>保存</Button>
        </footer>
      </section>
    </div>
  );
}

function ThemeColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid grid-cols-[96px_minmax(0,1fr)_84px] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        className="h-8 w-full cursor-pointer rounded-md border bg-background p-1"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}

function ThemeNumberField({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid grid-cols-[96px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        className="h-8 w-full accent-primary"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        className="h-8 min-w-0 rounded-md border bg-background px-2 font-mono text-xs text-foreground"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ThemePreview({ theme }: { theme: EditorTheme }) {
  return (
    <div className="grid gap-2 rounded-md border p-3" style={{ backgroundColor: theme.ui.background, color: theme.ui.foreground }}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-md border" style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.card }}>
          <ColorWheel className="m-2 size-4" style={{ color: theme.ui.icon }} />
        </div>
        <div className="h-8 rounded-md px-3 py-1.5 text-sm" style={{ backgroundColor: theme.ui.primary, color: theme.ui.background }}>
          高亮
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <div className="rounded-md border px-4 py-3 text-sm font-bold" style={{ borderColor: theme.canvas.nodeStroke, backgroundColor: theme.canvas.surface, color: theme.canvas.nodeText }}>
          节点
        </div>
        <div className="h-px flex-1" style={{ backgroundColor: theme.canvas.edge }} />
        <div className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: theme.source.line, backgroundColor: theme.ui.card }}>
          Mermaid
        </div>
      </div>
    </div>
  );
}

function toCustomTheme(theme: EditorTheme): EditorTheme {
  return {
    version: 2,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    description: theme.description,
    baseThemeId: theme.id === "custom" ? theme.baseThemeId : theme.id,
    ui: { ...theme.ui },
    canvas: { ...theme.canvas },
    source: { ...theme.source },
    render: { ...theme.render },
    font: { ...theme.font },
    space: { ...theme.space },
    radius: { ...theme.radius },
    stroke: {
      ...theme.stroke,
      edgeDotted: [...theme.stroke.edgeDotted],
      selectionDash: [...theme.stroke.selectionDash],
      connectionDraftDash: [...theme.stroke.connectionDraftDash],
      centerGuideDash: [...theme.stroke.centerGuideDash],
      subgraphDash: [...theme.stroke.subgraphDash]
    },
    icon: { ...theme.icon },
    canvasInteraction: { ...theme.canvasInteraction },
    subgraph: { ...theme.subgraph },
    edgeLabel: { ...theme.edgeLabel },
    diagnostics: { ...theme.diagnostics }
  };
}

function PanelHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="absolute right-2 top-2 z-30">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8 bg-card/95 text-icon hover:text-icon" onClick={onCollapse} aria-label="收起右侧面板">
            <PanelRightClose className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">收起右侧面板</TooltipContent>
      </Tooltip>
    </div>
  );
}

function FloatingPanelOpenButton({
  side,
  label,
  revealMode,
  onOpen
}: {
  side: "left" | "right";
  label: string;
  revealMode: PanelOpenButtonMode;
  onOpen: () => void;
}) {
  const Icon = side === "left" ? PanelLeftOpen : PanelRightOpen;
  const [visible, setVisible] = useState(false);
  const alwaysVisible = revealMode === "always";

  return (
    <div
      className={cn(
        "absolute top-0 z-30 flex h-24 w-14 items-start pt-3",
        side === "left" ? "left-0 justify-start pl-2" : "right-0 justify-end pr-2"
      )}
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => setVisible(false)}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={cn(
              "size-8 bg-card/95 text-icon opacity-0 backdrop-blur transition-[opacity,transform] duration-150 ease-out hover:text-icon focus-visible:translate-x-0 focus-visible:opacity-100",
              side === "left" ? "-translate-x-2" : "translate-x-2",
              (alwaysVisible || visible) && "pointer-events-auto translate-x-0 opacity-100",
              !alwaysVisible && !visible && "pointer-events-none"
            )}
            onClick={onOpen}
            aria-label={`展开${label}面板`}
          >
            <Icon className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side === "left" ? "right" : "left"}>{`展开${label}面板`}</TooltipContent>
      </Tooltip>
    </div>
  );
}
