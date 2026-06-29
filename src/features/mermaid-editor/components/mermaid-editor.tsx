import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  SquareCursor as SquareDashedMousePointer,
  Terminal,
  Text,
  WarningTriangle,
  Xmark
} from "iconoir-react/regular";

import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { CanvasDocumentEditor } from "@/features/mermaid-editor/components/canvas-document-editor";
import { FloatingButtonCluster, FloatingChromeLayer, FloatingChromeSlot, FloatingIconButton, FloatingPanel, MotionPresence } from "@/features/mermaid-editor/components/floating-chrome";
import { MarkdownPanel } from "@/features/mermaid-editor/components/markdown-panel";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import { TerminalPanel } from "@/features/mermaid-editor/components/terminal-panel";
import { Button } from "@/components/ui/button";
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
  ensureRuntimeDocumentFileName,
  isRuntimeAbortError,
  type RuntimeFileDropRequest,
  type RuntimeFileOpenRequest,
  type RuntimeFileRef,
  type RuntimeImageAssetResult
} from "@/features/mermaid-editor/lib/editor-runtime";
import {
  fileWorkflowErrorSuggestion,
  fileWorkflowErrorTitle,
  isSupportedDocumentFilePath,
  normalizeFileWorkflowError,
  normalizeRecentFiles,
  upsertRecentFile,
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";
import { documentKindFromPath, documentKindLabel, isSupportedMarkdownFilePath, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import {
  buildProjectFileTree,
  isProjectFileActive,
  normalizeProjectWorkspace,
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
import { EditorMotionProvider, gsap, useResolvedEditorMotion } from "@/features/mermaid-editor/lib/use-gsap-motion";
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
import { useDisableNativeContextMenu } from "@/features/mermaid-editor/lib/native-context-menu";
import { EDITOR_CHROME_CLASSES } from "@/features/mermaid-editor/lib/editor-chrome";
import { bringFloatingPanelToFront, floatingPanelStackIndex, type FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import { createImageAsset, DEFAULT_IMAGE_ASSET_HEIGHT, DEFAULT_IMAGE_ASSET_WIDTH, isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import { cn } from "@/lib/utils";
import {
  WINDOW_CLOSE_TARGET_NAME,
  cleanCloseDocument,
  resolveWindowCloseChoice,
  unsavedPromptDescription,
  type UnsavedPromptChoice
} from "@/features/mermaid-editor/lib/desktop-close-workflow";
import { canvasScreenToWorldPoint, classifyFileDrop, windowPointToSurfacePoint, type DropPoint, type FileDropCandidate } from "@/features/mermaid-editor/lib/file-drop";
import {
  createBlankCanvasDocument,
  createCanvasImageElement,
  normalizeCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";

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
const ansiColorRows = [
  ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"],
  ["brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"]
] as const satisfies readonly (readonly (keyof EditorTheme["ansi"])[])[];
const ansiColorLabels: Record<keyof EditorTheme["ansi"], string> = {
  black: "黑",
  red: "红",
  green: "绿",
  yellow: "黄",
  blue: "蓝",
  magenta: "品红",
  cyan: "青",
  white: "白",
  brightBlack: "亮黑",
  brightRed: "亮红",
  brightGreen: "亮绿",
  brightYellow: "亮黄",
  brightBlue: "亮蓝",
  brightMagenta: "亮品红",
  brightCyan: "亮青",
  brightWhite: "亮白"
};
const workspaceViewLabels: Record<WorkspaceView, string> = {
  canvas: "无限画布",
  render: "渲染视图",
  source: "源码视图",
  markdown: "Markdown 视图"
};
const FALLBACK_FILE_NAME = "diagram.mmd";
const FALLBACK_MARKDOWN_FILE_NAME = "document.md";
const FALLBACK_CANVAS_FILE_NAME = "board.canvas.json";
const BLANK_FLOWCHART_SOURCE = "flowchart LR";
const BLANK_MARKDOWN_SOURCE = "# 未命名文档\n\n";
type StaticWorkspacePanelId = "explorer" | "inspector" | "terminal";
type MarkdownWindowPanelId = `markdown:${string}`;
type WorkspaceFloatingPanelId = StaticWorkspacePanelId | MarkdownWindowPanelId;
type DetachedMarkdownWindow = {
  id: MarkdownWindowPanelId;
  file: RuntimeFileRef;
  title: string;
  value: string;
  savedValue: string;
};
const DEFAULT_WORKSPACE_PANEL_STACK: WorkspaceFloatingPanelId[] = ["explorer", "inspector", "terminal"];
const DEFAULT_WORKSPACE_PANEL_WINDOW_STATES: Record<StaticWorkspacePanelId, FloatingPanelWindowState> = {
  explorer: "normal",
  inspector: "normal",
  terminal: "normal"
};
const WORKSPACE_PANEL_DEFAULT_SIZES: Record<StaticWorkspacePanelId | "markdown", { width: number; height: number }> = {
  explorer: { width: 360, height: 640 },
  inspector: { width: 360, height: 640 },
  terminal: { width: 860, height: 320 },
  markdown: { width: 760, height: 640 }
};
const WORKSPACE_PANEL_MIN_SIZES: Record<StaticWorkspacePanelId | "markdown", { width: number; height: number }> = {
  explorer: { width: 320, height: 220 },
  inspector: { width: 320, height: 220 },
  terminal: { width: 560, height: 260 },
  markdown: { width: 420, height: 300 }
};
function markdownWindowPanelId(file: Pick<RuntimeFileRef, "name" | "path">): MarkdownWindowPanelId {
  return `markdown:${file.path || file.name}` as MarkdownWindowPanelId;
}
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
  documentKind?: DocumentKind;
  source: string;
  canvasDocument?: CanvasDocument;
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
type BrowserDroppedFile = FileDropCandidate & {
  file: File;
  name: string;
};
type FileOpenSource = "picker" | "recent" | "project" | "drop" | "external" | "restore";
type UnsavedPromptState = {
  title: string;
  description: string;
  targetName?: string;
  resolve: (choice: UnsavedPromptChoice) => void;
};
type StoredEditorApplyResult = {
  documentKind: DocumentKind;
  currentDocument: string;
  fileRef: RuntimeFileRef | null;
  lastSavedDocument: string;
  preferences: EditorPreferences;
};
type StoredEditorDraftOverrides = {
  documentKind?: DocumentKind;
  source?: string;
  canvasDocument?: CanvasDocument;
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

function createEmptyDocumentGraph(): MermaidGraph {
  return {
    direction: "LR",
    nodes: [],
    edges: [],
    subgraphs: [],
    diagramType: "unknown",
    editableKind: "render-only",
    parseStatus: "render-only"
  };
}

function canvasDocumentFromStored(stored: Pick<StoredEditor, "canvasDocument" | "source">): CanvasDocument {
  if (stored.canvasDocument) return normalizeCanvasDocument(stored.canvasDocument);
  try {
    return parseCanvasDocument(stored.source || "");
  } catch {
    return createBlankCanvasDocument();
  }
}

function fallbackFileNameForKind(documentKind: DocumentKind) {
  if (documentKind === "markdown") return FALLBACK_MARKDOWN_FILE_NAME;
  if (documentKind === "canvas") return FALLBACK_CANVAS_FILE_NAME;
  return FALLBACK_FILE_NAME;
}

function normalizeStoredDocumentKind(value: unknown, fileName?: string, filePath?: string): DocumentKind {
  if (value === "markdown" || value === "mermaid" || value === "canvas") return value;
  return documentKindFromPath(filePath || fileName) || "mermaid";
}

function loadInitialState() {
  const fallbackGraph = parseMermaid(initialMermaidSource);
  const fallbackViewport = { x: 160, y: 90, scale: 1 };
  const fallbackSource = serializeMermaid(fallbackGraph);
  const fallbackDocument = loadMermaidDocument(fallbackSource);
  const fallbackPreferences = DEFAULT_EDITOR_PREFERENCES;

  if (typeof window === "undefined") {
    return {
      documentKind: "mermaid" as DocumentKind,
      source: fallbackSource,
      canvasDocument: createBlankCanvasDocument(),
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
    const storedDocumentKind = normalizeStoredDocumentKind(stored.documentKind, stored.fileName, stored.fileRef?.path);
    if (storedDocumentKind === "markdown") {
      const preferences = normalizeEditorPreferences(stored.preferences);
      const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const recentFiles = normalizeRecentFiles(stored.recentFiles);
      const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const fileName = ensureRuntimeDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_MARKDOWN_FILE_NAME, "markdown");
      const fileTheme = stored.layout?.theme ?? null;
      const themeId = normalizeThemeId(fileTheme?.themeId ?? stored.themeId);
      const customTheme = fileTheme?.customTheme
        ? normalizeEditorTheme(fileTheme.customTheme)
        : stored.customTheme
          ? normalizeEditorTheme(stored.customTheme)
          : null;

      return {
        documentKind: "markdown" as DocumentKind,
        source: stored.source || BLANK_MARKDOWN_SOURCE,
        canvasDocument: createBlankCanvasDocument(),
        graph: createEmptyDocumentGraph(),
        diagramType: "unknown" as DiagramType,
        editableKind: "render-only" as EditableKind,
        viewport: stored.viewport || fallbackViewport,
        edgeRouting: stored.edgeRouting || DEFAULT_EDGE_ROUTING,
        layoutMode: stored.layoutMode || DEFAULT_LAYOUT_MODE,
        leftCollapsed: shouldCollapseExplorerOnStartup({
          startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
          storedCollapsed: stored.leftCollapsed,
          projectWorkspace,
          recentFiles,
          fileRef: stored.fileRef || null,
          fileName,
          fallbackFileName: FALLBACK_MARKDOWN_FILE_NAME
        }),
        rightCollapsed: preferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false,
        workspaceView: workspaceViewForDocument("render-only", stored.workspaceView, "markdown"),
        viewFilters,
        fileName,
        fileRef: stored.fileRef || null,
        recentFiles,
        projectWorkspace,
        lastSavedDocument: stored.lastSavedDocument || "",
        fileTheme,
        themeId,
        customTheme,
        preferences
      };
    }
    if (storedDocumentKind === "canvas") {
      const preferences = normalizeEditorPreferences(stored.preferences);
      const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const recentFiles = normalizeRecentFiles(stored.recentFiles);
      const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const canvasDocument = canvasDocumentFromStored(stored);
      const fileName = ensureRuntimeDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_CANVAS_FILE_NAME, "canvas");

      return {
        documentKind: "canvas" as DocumentKind,
        source: serializeCanvasDocument(canvasDocument),
        canvasDocument,
        graph: createEmptyDocumentGraph(),
        diagramType: "unknown" as DiagramType,
        editableKind: "render-only" as EditableKind,
        viewport: canvasDocument.viewport || fallbackViewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        leftCollapsed: shouldCollapseExplorerOnStartup({
          startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
          storedCollapsed: stored.leftCollapsed,
          projectWorkspace,
          recentFiles,
          fileRef: stored.fileRef || null,
          fileName,
          fallbackFileName: FALLBACK_CANVAS_FILE_NAME
        }),
        rightCollapsed: true,
        workspaceView: "canvas" as WorkspaceView,
        viewFilters,
        fileName,
        fileRef: stored.fileRef || null,
        recentFiles,
        projectWorkspace,
        lastSavedDocument: stored.lastSavedDocument || "",
        fileTheme: null,
        themeId: normalizeThemeId(stored.themeId),
        customTheme: stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null,
        preferences
      };
    }
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
      documentKind: "mermaid" as DocumentKind,
      source,
      canvasDocument: createBlankCanvasDocument(),
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
      workspaceView: workspaceViewForDocument(loaded.editableKind, stored.workspaceView, "mermaid"),
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
      documentKind: "mermaid" as DocumentKind,
      source: fallbackSource,
      canvasDocument: createBlankCanvasDocument(),
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

function ensureEditorDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  return ensureRuntimeDocumentFileName(value || fallbackFileNameForKind(documentKind), documentKind);
}

function comparableDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  const name = value?.split(/[\\/]/).pop();
  return ensureEditorDocumentFileName(name, documentKind).toLowerCase();
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

function parentDirectoryPath(path: string | undefined) {
  if (!path) return undefined;
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index > 0 ? path.slice(0, index) : undefined;
}

async function getDesktopWindow() {
  if (!isDesktopWindowRuntime()) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function MermaidEditor() {
  useDisableNativeContextMenu();

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
  const [workspacePanelStack, setWorkspacePanelStack] = useState<WorkspaceFloatingPanelId[]>(DEFAULT_WORKSPACE_PANEL_STACK);
  const [workspacePanelWindowStates, setWorkspacePanelWindowStates] = useState<Record<string, FloatingPanelWindowState>>(() => ({
    ...DEFAULT_WORKSPACE_PANEL_WINDOW_STATES
  }));
  const [detachedMarkdownWindows, setDetachedMarkdownWindows] = useState<DetachedMarkdownWindow[]>([]);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
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
  const viewportMotionTweenRef = useRef<gsap.core.Tween | null>(null);
  const aiCommandBusyRef = useRef(false);
  const actionCounterRef = useRef(0);
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
    documentKind: "mermaid",
    currentDocument: "",
    fileRef: null,
    lastSavedDocument: "",
    preferences: DEFAULT_EDITOR_PREFERENCES
  }));

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

  const startDesktopWindowDragHandle = useCallback(
    async (event: React.PointerEvent<HTMLElement>) => {
      if (runtime.kind !== "desktop" || event.button !== 0 || event.detail > 1) return;
      try {
        await (await getDesktopWindow())?.startDragging();
      } catch {
        // Window dragging is desktop-only; ignore capability/runtime failures in web-like shells.
      }
    },
    [runtime.kind]
  );

  const toggleDesktopWindowMaximizeHandle = useCallback(
    async () => {
      if (runtime.kind !== "desktop") return;
      try {
        await (await getDesktopWindow())?.toggleMaximize();
      } catch {
        // Window controls are optional outside the Tauri desktop shell.
      }
    },
    [runtime.kind]
  );

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
      fileName: fileName || fallbackFileNameForKind(documentKind),
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
    documentKind,
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
      if (documentKind !== "mermaid") {
        setStatus(`${documentKindLabel(documentKind)} 不需要刷新 Mermaid 画布。`);
        return;
      }
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
    (): EditorSnapshot => ({ documentKind, source, graph, selection, viewport, edgeRouting, layoutMode }),
    [documentKind, source, graph, selection, viewport, edgeRouting, layoutMode]
  );

  function restoreSnapshot(next: EditorSnapshot) {
    if (next.documentKind === "markdown") {
      setDocumentKind("markdown");
      setSource(next.source);
      setCanvasDocument(createBlankCanvasDocument());
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setDiagnostics([]);
      setSelection(next.selection);
      setViewport(next.viewport);
      setEdgeRouting(next.edgeRouting);
      setLayoutMode(next.layoutMode);
      setWorkspaceView(workspaceViewForDocument("render-only", workspaceView, "markdown"));
      return;
    }

    const loaded = loadMermaidDocument(next.source, next.graph);
    setDocumentKind("mermaid");
    setSource(next.source);
    setCanvasDocument(createBlankCanvasDocument());
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
    if (documentKind === "markdown") {
      applyMarkdownSource(nextSource);
      return;
    }

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

  function applyMarkdownSource(nextSource: string) {
    const startedSourceEdit = !sourceEditBaseRef.current;
    if (!sourceEditBaseRef.current) sourceEditBaseRef.current = snapshot();
    setSource(nextSource);
    setCanvasDocument(createBlankCanvasDocument());
    setGraph(createEmptyDocumentGraph());
    setDiagramType("unknown");
    setEditableKind("render-only");
    setSelection(emptySelection);
    setDiagnostics([]);
    setStatus("Markdown 已更新。");
    if (startedSourceEdit) recordRecentAction("source.edit", { kind: "source" }, "用户开始编辑 Markdown。");
    if (sourceEditTimerRef.current) window.clearTimeout(sourceEditTimerRef.current);
    sourceEditTimerRef.current = window.setTimeout(() => {
      flushSourceHistory();
    }, 700);
  }

  function applyCanvasDocument(nextDocument: CanvasDocument, message?: string) {
    const normalized = normalizeCanvasDocument(nextDocument);
    setCanvasDocument(normalized);
    setSource(serializeCanvasDocument(normalized));
    setViewport(normalized.viewport);
    setGraph(createEmptyDocumentGraph());
    setDiagramType("unknown");
    setEditableKind("render-only");
    setSelection(emptySelection);
    setDiagnostics([]);
    if (message) {
      setStatus(message);
      recordRecentAction("canvas.edit", { kind: "canvas" }, message);
    }
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

  function showFileWorkflowError(error: unknown, fallbackMessage = "文件操作失败。") {
    setFileWorkflowError(normalizeFileWorkflowError(error, fallbackMessage));
  }

  function buildStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}): StoredEditor {
    const draftDocumentKind = overrides.documentKind ?? documentKind;
    const draftSource = overrides.source ?? source;
    const draftCanvasDocument = overrides.canvasDocument ?? canvasDocument;
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
      documentKind: draftDocumentKind,
      source: draftDocumentKind === "canvas" ? serializeCanvasDocument(draftCanvasDocument) : draftSource,
      ...(draftDocumentKind === "canvas" ? { canvasDocument: draftCanvasDocument } : {}),
      ...(draftDocumentKind === "mermaid"
        ? { layout: layoutFromGraph(draftGraph, draftViewport, draftEdgeRouting, draftLayoutMode, draftFileTheme) }
        : {}),
      viewport: draftDocumentKind === "canvas" ? draftCanvasDocument.viewport : draftViewport,
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
    if (documentKind === "markdown") {
      const keepCurrentFile = Boolean(lastSavedDocument?.trim());
      await persistStoredEditorDraft({
        documentKind: "markdown",
        source: keepCurrentFile ? lastSavedDocument : BLANK_MARKDOWN_SOURCE,
        graph: createEmptyDocumentGraph(),
        fileName: keepCurrentFile ? fileName : FALLBACK_MARKDOWN_FILE_NAME,
        fileRef: keepCurrentFile ? fileRef : null,
        lastSavedDocument: keepCurrentFile ? lastSavedDocument : BLANK_MARKDOWN_SOURCE,
        workspaceView: workspaceViewForDocument("render-only", workspaceView, "markdown")
      });
      return;
    }

    if (documentKind === "canvas") {
      const keepCurrentFile = Boolean(lastSavedDocument?.trim());
      const cleanDocument = keepCurrentFile ? parseCanvasDocument(lastSavedDocument) : createBlankCanvasDocument();
      const cleanSource = serializeCanvasDocument(cleanDocument);
      await persistStoredEditorDraft({
        documentKind: "canvas",
        source: cleanSource,
        canvasDocument: cleanDocument,
        graph: createEmptyDocumentGraph(),
        viewport: cleanDocument.viewport,
        fileName: keepCurrentFile ? fileName : FALLBACK_CANVAS_FILE_NAME,
        fileRef: keepCurrentFile ? fileRef : null,
        lastSavedDocument: cleanSource,
        workspaceView: "canvas"
      });
      return;
    }

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
      workspaceView: workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid"),
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
    const nextDocumentKind = documentKindFromPath(file?.path || name) || "mermaid";
    if (nextDocumentKind === "canvas") {
      let nextCanvasDocument = createBlankCanvasDocument();
      try {
        nextCanvasDocument = parseCanvasDocument(text);
      } catch (error) {
        showFileWorkflowError({ code: "read_failed", message: `画布 JSON 解析失败：${readableError(error)}`, path: file?.path }, "打开画布失败。");
        return;
      }
      const savedDocument = serializeCanvasDocument(nextCanvasDocument);

      setDocumentKind("canvas");
      setSource(savedDocument);
      setCanvasDocument(nextCanvasDocument);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(nextCanvasDocument.viewport);
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setWorkspaceView("canvas");
      setSelection(emptySelection);
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(ensureEditorDocumentFileName(name, "canvas"));
      setFileTheme(null);
      setFileRef(file);
      setLastSavedDocument(savedDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, file));
      setFileWorkflowError(null);
      setStatus(`已打开 ${name}。`);
      recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
      if (source !== "restore") void syncWorkspaceForOpenedFile(file);
      return;
    }

    if (nextDocumentKind === "markdown") {
      const savedDocument = text;

      setDocumentKind("markdown");
      setSource(text);
      setCanvasDocument(createBlankCanvasDocument());
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport({ x: 160, y: 90, scale: 1 });
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setWorkspaceView("markdown");
      setSelection(emptySelection);
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(ensureEditorDocumentFileName(name, "markdown"));
      setFileTheme(null);
      setFileRef(file);
      setLastSavedDocument(savedDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, file));
      setFileWorkflowError(null);
      setStatus(`已打开 ${name}。`);
      recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
      if (source !== "restore") void syncWorkspaceForOpenedFile(file);
      return;
    }

    const loaded = loadMermaidDocument(text);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const nextThemeId = normalizeThemeId(loaded.fileTheme?.themeId ?? themeId);
    const nextCustomTheme = loaded.fileTheme?.customTheme ? normalizeEditorTheme(loaded.fileTheme.customTheme) : customTheme;
    const savedDocument = buildMermaidDocument(loaded.source, loadedGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, loaded.fileTheme ?? null);

    setDocumentKind("mermaid");
    setSource(loaded.source);
    setCanvasDocument(createBlankCanvasDocument());
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
    setFileName(ensureEditorDocumentFileName(name, "mermaid"));
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

  async function syncWorkspaceForOpenedFile(file: RuntimeFileRef | null, options: { announce?: boolean; revealExplorer?: boolean } = {}) {
    if (runtime.kind !== "desktop" || !file?.path) return;

    const revealExplorer = options.revealExplorer ?? true;
    const rootPath = workspaceRootForOpenedFile(file.path, projectWorkspace);
    if (!rootPath) {
      if (projectWorkspace && revealExplorer) setLeftCollapsed(false);
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
      if (revealExplorer) setLeftCollapsed(false);
      if (options.announce ?? true) setStatus(`已显示 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "同步文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  function applyStoredEditorState(stored: StoredEditor) {
    flushSourceHistory();
    const storedDocumentKind = normalizeStoredDocumentKind(stored.documentKind, stored.fileName, stored.fileRef?.path);
    if (storedDocumentKind === "canvas") {
      const nextPreferences = normalizeEditorPreferences(stored.preferences);
      const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
      const nextCanvasDocument = canvasDocumentFromStored(stored);
      const nextSource = serializeCanvasDocument(nextCanvasDocument);
      const nextFileName = ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_CANVAS_FILE_NAME, "canvas");

      setDocumentKind("canvas");
      setSource(nextSource);
      setCanvasDocument(nextCanvasDocument);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(nextCanvasDocument.viewport);
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setLeftCollapsed(shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace: nextProjectWorkspace,
        recentFiles: nextRecentFiles,
        fileRef: stored.fileRef || null,
        fileName: nextFileName,
        fallbackFileName: FALLBACK_CANVAS_FILE_NAME
      }));
      setRightCollapsed(true);
      setWorkspaceView("canvas");
      setViewFilters(nextViewFilters);
      setSelection(emptySelection);
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(stored.fileRef || null);
      setRecentFiles(nextRecentFiles);
      setProjectWorkspace(nextProjectWorkspace);
      setLastSavedDocument(stored.lastSavedDocument || "");
      isDirtyRef.current = !stored.lastSavedDocument || nextSource !== stored.lastSavedDocument;
      setFileTheme(null);
      setThemeId(normalizeThemeId(stored.themeId));
      setCustomTheme(stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null);
      setPreferences(nextPreferences);
      setFileWorkflowError(null);

      return {
        documentKind: "canvas" as DocumentKind,
        currentDocument: nextSource,
        fileRef: stored.fileRef || null,
        lastSavedDocument: stored.lastSavedDocument || "",
        preferences: nextPreferences
      };
    }

    if (storedDocumentKind === "markdown") {
      const nextPreferences = normalizeEditorPreferences(stored.preferences);
      const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
      const nextSource = stored.source || BLANK_MARKDOWN_SOURCE;
      const nextFileName = ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_MARKDOWN_FILE_NAME, "markdown");

      setDocumentKind("markdown");
      setSource(nextSource);
      setCanvasDocument(createBlankCanvasDocument());
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(stored.viewport || { x: 160, y: 90, scale: 1 });
      setEdgeRouting(stored.edgeRouting || DEFAULT_EDGE_ROUTING);
      setLayoutMode(stored.layoutMode || DEFAULT_LAYOUT_MODE);
      setLeftCollapsed(shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace: nextProjectWorkspace,
        recentFiles: nextRecentFiles,
        fileRef: stored.fileRef || null,
        fileName: nextFileName,
        fallbackFileName: FALLBACK_MARKDOWN_FILE_NAME
      }));
      setRightCollapsed(nextPreferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false);
      setWorkspaceView(workspaceViewForDocument("render-only", stored.workspaceView, "markdown"));
      setViewFilters(nextViewFilters);
      setSelection(emptySelection);
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(stored.fileRef || null);
      setRecentFiles(nextRecentFiles);
      setProjectWorkspace(nextProjectWorkspace);
      setLastSavedDocument(stored.lastSavedDocument || "");
      isDirtyRef.current = !stored.lastSavedDocument || nextSource !== stored.lastSavedDocument;
      setFileTheme(null);
      setThemeId(normalizeThemeId(stored.themeId));
      setCustomTheme(stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null);
      setPreferences(nextPreferences);
      setFileWorkflowError(null);

      return {
        documentKind: "markdown" as DocumentKind,
        currentDocument: nextSource,
        fileRef: stored.fileRef || null,
        lastSavedDocument: stored.lastSavedDocument || "",
        preferences: nextPreferences
      };
    }

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

    setDocumentKind("mermaid");
    setSource(loaded.source);
    setCanvasDocument(createBlankCanvasDocument());
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
    setWorkspaceView(workspaceViewForDocument(loaded.editableKind, stored.workspaceView, "mermaid"));
    setViewFilters(nextViewFilters);
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_FILE_NAME, "mermaid"));
    setFileRef(stored.fileRef || null);
    setRecentFiles(nextRecentFiles);
    setProjectWorkspace(nextProjectWorkspace);
    setLastSavedDocument(stored.lastSavedDocument || "");
    isDirtyRef.current = !stored.lastSavedDocument || currentStoredDocument !== stored.lastSavedDocument;
    setFileTheme(nextFileTheme);
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
    setPreferences(nextPreferences);
    setFileWorkflowError(null);

    return {
      documentKind: "mermaid" as DocumentKind,
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

    setDocumentKind("mermaid");
    setSource(nextSource);
    setCanvasDocument(createBlankCanvasDocument());
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
        documentKind: "mermaid",
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

  async function newMarkdownFile() {
    if (!(await prepareFileSwitch(FALLBACK_MARKDOWN_FILE_NAME))) return;

    flushSourceHistory();
    const nextGraph = createEmptyDocumentGraph();

    setDocumentKind("markdown");
    setSource(BLANK_MARKDOWN_SOURCE);
    setCanvasDocument(createBlankCanvasDocument());
    setGraph(nextGraph);
    setDiagramType("unknown");
    setEditableKind("render-only");
    setViewport({ x: 160, y: 90, scale: 1 });
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("markdown");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_MARKDOWN_FILE_NAME);
    setFileRef(null);
    setFileTheme(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白 Markdown 文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白 Markdown 文件。");

    try {
      await persistStoredEditorDraft({
        documentKind: "markdown",
        source: BLANK_MARKDOWN_SOURCE,
        graph: nextGraph,
        viewport: { x: 160, y: 90, scale: 1 },
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileTheme: null,
        fileName: FALLBACK_MARKDOWN_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "markdown"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  async function newCanvasFile() {
    if (!(await prepareFileSwitch(FALLBACK_CANVAS_FILE_NAME))) return;

    flushSourceHistory();
    const nextCanvasDocument = createBlankCanvasDocument();
    const nextSource = serializeCanvasDocument(nextCanvasDocument);

    setDocumentKind("canvas");
    setSource(nextSource);
    setCanvasDocument(nextCanvasDocument);
    setGraph(createEmptyDocumentGraph());
    setDiagramType("unknown");
    setEditableKind("render-only");
    setViewport(nextCanvasDocument.viewport);
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("canvas");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_CANVAS_FILE_NAME);
    setFileRef(null);
    setFileTheme(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白无限画布文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白无限画布文件。");

    try {
      await persistStoredEditorDraft({
        documentKind: "canvas",
        source: nextSource,
        canvasDocument: nextCanvasDocument,
        graph: createEmptyDocumentGraph(),
        viewport: nextCanvasDocument.viewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileTheme: null,
        fileName: FALLBACK_CANVAS_FILE_NAME,
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
    if (!isSupportedDocumentFilePath(file.path)) {
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
      setLeftCollapsed(false);
      setStatus(`已打开工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
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
      setStatus(`已刷新工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
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

  function dropFeedbackForFiles(files: FileDropCandidate[], position?: DropPoint): FileDropFeedback {
    const localPosition = windowPointToWorkspacePoint(position);
    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      return { message: `释放以打开 ${documentKindLabel(classification.documentKind)} 文件`, tone: "ready", position: localPosition };
    }
    if (classification.kind === "image") {
      if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
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

  function browserDroppedFiles(dataTransfer: DataTransfer): BrowserDroppedFile[] {
    return Array.from(dataTransfer.files).map((file) => ({
      file,
      name: file.name,
      path: exposedDroppedFilePath(file)
    }));
  }

  function isExternalFileDrag(dataTransfer: DataTransfer | null) {
    return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
  }

  function exposedDroppedFilePath(file: File) {
    const path = (file as File & { path?: unknown }).path;
    return typeof path === "string" && path ? path : undefined;
  }

  function dragEventDropPoint(event: ReactDragEvent<HTMLElement>): DropPoint {
    return { x: event.clientX, y: event.clientY };
  }

  function updateBrowserFileDragFeedback(event: ReactDragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    if (files.length) {
      setFileDropFeedback(dropFeedbackForFiles(files, position));
      return;
    }
    setFileDropFeedback((current) =>
      current
        ? { ...current, position: windowPointToWorkspacePoint(position) || current.position }
        : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(position) }
    );
  }

  function handleBrowserFileDragLeave(event: ReactDragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setFileDropFeedback(null);
  }

  function handleBrowserFileDrop(event: ReactDragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    setFileDropFeedback(null);
    void handleBrowserDroppedFiles(files, position);
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

  async function handleBrowserDroppedFiles(files: BrowserDroppedFile[], dropPosition?: DropPoint) {
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
      await openBrowserDroppedDocumentFile(classification.file);
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      await importBrowserDroppedImageAsset(classification.file, dropPosition);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path || classification.file?.name }, "文件类型不支持。");
  }

  async function openBrowserDroppedDocumentFile(file: BrowserDroppedFile) {
    const identity = file.path || file.name;
    if (!isSupportedDocumentFilePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return;
    }
    if (file.path) {
      await openRuntimeFileRequest({ name: file.name, path: file.path }, "drop");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      applyLoadedDocument(await file.file.text(), file.name, { name: file.name }, "drop");
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function importBrowserDroppedImageAsset(file: BrowserDroppedFile, dropPosition?: DropPoint) {
    const identity = file.path || file.name;
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: identity
        },
        "无法导入图片。"
      );
      return;
    }
    if (!isSupportedImagePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return;
    }

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = file.path
        ? await runtime.importImageAssetPath(targetFile, file.path)
        : await runtime.importImageAssetFile(targetFile, file.file);
      await applyImportedImageAssetResult(result, identity, dropPosition);
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
  }

  async function applyImportedImageAssetResult(result: RuntimeImageAssetResult, sourcePath: string, dropPosition?: DropPoint) {
    if (result.status !== "ready") {
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: sourcePath }, "文件类型不支持。");
      }
      if (result.status === "needs-document") {
        showFileWorkflowError({ code: "unsupported_type", message: "请先保存当前文档，再拖入本地图片。", path: sourcePath }, "无法导入图片。");
      }
      return;
    }

    const dimensions = await loadImageDimensions(result.displaySrc);
    const point = windowPointToCanvasWorldPoint(dropPosition) || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
    if (documentKind === "canvas") {
      const element = createCanvasImageElement(
        canvasDocument.elements,
        point.x - dimensions.width / 2,
        point.y - dimensions.height / 2,
        result.src,
        dimensions.width,
        dimensions.height
      );
      applyCanvasDocument({ ...canvasDocument, elements: [...canvasDocument.elements, element] }, result.copied ? "已复制并添加拖入的图片。" : "已添加拖入的图片。");
      return;
    }
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
  }

  async function importImageAssetRequest(file: RuntimeFileOpenRequest, dropPosition?: DropPoint) {
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
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
      await applyImportedImageAssetResult(result, file.path, dropPosition);
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
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
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

  async function openProjectMarkdownWindow(file: ProjectFileEntry) {
    if (!isSupportedMarkdownFilePath(file.path)) return;
    const panelId = markdownWindowPanelId(file);
    const existingWindow = detachedMarkdownWindows.find((window) => window.id === panelId);
    if (existingWindow) {
      bringWorkspacePanelToFront(panelId);
      setStatus(`已切换到 ${existingWindow.title} 窗口。`);
      return;
    }

    try {
      const result = await runtime.openFilePath(file.path);
      if (result.status !== "opened") return;
      const title = result.file.name || file.name;
      const nextWindow: DetachedMarkdownWindow = {
        id: panelId,
        file: result.file,
        title,
        value: result.text,
        savedValue: result.text
      };
      setDetachedMarkdownWindows((current) => [...current, nextWindow]);
      bringWorkspacePanelToFront(panelId);
      setWorkspacePanelWindowState(panelId, "normal");
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setStatus(`已在窗口中打开 ${title}。`);
    } catch (error) {
      showFileWorkflowError(error, "打开 Markdown 窗口失败。");
    }
  }

  function updateDetachedMarkdownWindow(panelId: MarkdownWindowPanelId, value: string) {
    setDetachedMarkdownWindows((current) => current.map((window) => (window.id === panelId ? { ...window, value } : window)));
  }

  function closeDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    setDetachedMarkdownWindows((current) => current.filter((window) => window.id !== panelId));
    setWorkspacePanelWindowState(panelId, "normal");
    setWorkspacePanelStack((current) => current.filter((item) => item !== panelId));
  }

  async function saveDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    const targetWindow = detachedMarkdownWindows.find((window) => window.id === panelId);
    if (!targetWindow) return;

    try {
      const result = await runtime.saveFile(targetWindow.file, targetWindow.value, targetWindow.title, "markdown");
      if (result.status === "cancelled") return;
      const savedTitle = ensureEditorDocumentFileName(result.file.name, "markdown");
      setDetachedMarkdownWindows((current) =>
        current.map((window) =>
          window.id === panelId
            ? {
                ...window,
                file: result.file,
                title: savedTitle,
                savedValue: window.value
              }
            : window
        )
      );
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setStatus(`已保存 ${savedTitle}。`);
    } catch (error) {
      showFileWorkflowError(error, "保存 Markdown 窗口失败。");
    }
  }

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileRef) {
      return saveMermaidFileAs();
    }
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要保存吗？")) return false;

    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName, documentKind);
      if (result.status === "cancelled") return false;
      const savedName = ensureEditorDocumentFileName(result.file.name, documentKind);
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
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return true;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function saveMermaidFileAsResult(): Promise<RuntimeFileRef | null> {
    flushSourceHistory();
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要另存为吗？")) return null;
    const suggestedName = ensureEditorDocumentFileName(fileName, documentKind);
    try {
      const result = await runtime.saveFileAs(currentDocument, suggestedName, documentKind);
      if (result.status === "cancelled") return null;
      const savedName = ensureEditorDocumentFileName(result.file.name || suggestedName, documentKind);
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
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
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

      if (documentKind !== "mermaid") {
        const diagnostic = editorCommandDiagnostic(
          "UNSUPPORTED_DOCUMENT_KIND",
          "当前打开的是 Markdown 文件，AI Mermaid patch 只能应用到 Mermaid 文件。",
          "请切换到 Mermaid 文件后再执行图表修改。"
        );
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [diagnostic]
        });
        setStatus("AI 修改被拒绝：当前文件不是 Mermaid。");
        return;
      }

      if (command.targetFileName && comparableDocumentFileName(command.targetFileName, documentKind) !== comparableDocumentFileName(fileName, documentKind)) {
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
            const saveResult = await runtime.saveFile(fileRef, nextDocument, fileName, documentKind);
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
      setWorkspaceView(workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid"));
      setSelection(emptySelection);
      setDiagnostics([]);
      if (fileRef) setFileName(ensureEditorDocumentFileName(fileRef.name, "mermaid"));
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
    [currentDocument, documentKind, fileName, fileRef, fileTheme, graph, postAiApplyResult, runtime, snapshot, viewport, workspaceView]
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

  const bringWorkspacePanelToFront = useCallback((panelId: WorkspaceFloatingPanelId) => {
    setWorkspacePanelStack((current) => bringFloatingPanelToFront(current, panelId));
  }, []);

  const setWorkspacePanelWindowState = useCallback((panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => {
    setWorkspacePanelWindowStates((current) => ({ ...current, [panelId]: state }));
  }, []);

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

  function changeWorkspaceView(nextView: WorkspaceView) {
    const resolvedView = workspaceViewForDocument(editableKind, nextView, documentKind);
    setWorkspaceView(resolvedView);
  }

  function changeToolMode(nextMode: EditorMode) {
    if (mode === nextMode) return;
    applyEditorCommand({ type: "mode.set", mode: setEditorMode(nextMode), source: "menu" });
  }

  const openWorkspacePanelIds: WorkspaceFloatingPanelId[] = [];
  if (!leftCollapsed) openWorkspacePanelIds.push("explorer");
  if (!rightCollapsed && documentKind === "mermaid") openWorkspacePanelIds.push("inspector");
  if (terminalOpen) openWorkspacePanelIds.push("terminal");
  openWorkspacePanelIds.push(...detachedMarkdownWindows.map((window) => window.id));

  let activeWorkspacePanel: WorkspaceFloatingPanelId | null = null;
  for (let index = workspacePanelStack.length - 1; index >= 0; index -= 1) {
    const panelId = workspacePanelStack[index];
    if (openWorkspacePanelIds.includes(panelId)) {
      activeWorkspacePanel = panelId;
      break;
    }
  }

  function workspacePanelStackPosition(panelId: WorkspaceFloatingPanelId) {
    return floatingPanelStackIndex(workspacePanelStack, panelId);
  }

  function workspacePanelWindowState(panelId: WorkspaceFloatingPanelId) {
    return workspacePanelWindowStates[panelId] ?? "normal";
  }

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
          <PanelHeader
            windowState={workspacePanelWindowState("inspector")}
            onWindowStateChange={(state) => setWorkspacePanelWindowState("inspector", state)}
            onCollapse={() => closeWorkspacePanel("inspector")}
          />
          <div className="grid min-h-0">
            <InspectorPanel graph={graph} selection={selection} onEditorCommand={applyEditorCommand} />
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
            className={cn(EDITOR_CHROME_CLASSES.sidePanel, "relative grid h-full w-full min-h-0")}
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
              <DesktopWindowControls />
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
        {preferences.statusMessages && status ? (
          <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
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
    </EditorMotionProvider>
  );
}

function WorkspaceViewCluster({
  workspaceView,
  editableKind,
  documentKind,
  canvasViewTooltip,
  onChange
}: {
  workspaceView: WorkspaceView;
  editableKind: EditableKind;
  documentKind: DocumentKind;
  canvasViewTooltip: string;
  onChange: (view: WorkspaceView) => void;
}) {
  const views = workspaceViewOptionsFor(editableKind, documentKind);

  return (
    <FloatingButtonCluster orientation="vertical">
      {views.map((view) => {
        const label = view === "canvas" ? canvasViewTooltip : workspaceViewLabels[view];
        const Icon = view === "canvas" ? SquareDashedMousePointer : view === "render" ? Workflow : view === "markdown" ? Text : Code;
        return (
          <FloatingIconButton
            key={view}
            label={label}
            tooltipSide="left"
            active={workspaceView === view}
            aria-pressed={workspaceView === view}
            onClick={() => onChange(view)}
          >
            <Icon />
          </FloatingIconButton>
        );
      })}
    </FloatingButtonCluster>
  );
}

function workspaceViewOptionsFor(editableKind: EditableKind, documentKind: DocumentKind): WorkspaceView[] {
  if (documentKind === "markdown") return ["markdown", "source"];
  return editableKind === "flowchart" ? ["canvas", "render", "source"] : ["render", "source"];
}

function ToolModeCluster({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) {
  return (
    <FloatingButtonCluster>
      <FloatingIconButton
        label="选择模式"
        tooltipSide="top"
        active={mode === "select"}
        aria-pressed={mode === "select"}
        onClick={() => onChange("select")}
      >
        <SquareDashedMousePointer />
      </FloatingIconButton>
      <FloatingIconButton
        label="连接模式"
        tooltipSide="top"
        active={mode === "connect"}
        aria-pressed={mode === "connect"}
        onClick={() => onChange("connect")}
      >
        <Link />
      </FloatingIconButton>
    </FloatingButtonCluster>
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
    <div className="flex items-center gap-2" data-window-drag-exclude>
      <FloatingIconButton type="button" label="最小化" tooltipSide="bottom" onClick={() => void runWindowAction("minimize")}>
        <Minus />
      </FloatingIconButton>
      <FloatingIconButton type="button" label="最大化/还原" tooltipSide="bottom" onClick={() => void runWindowAction("toggleMaximize")}>
        <Maximize />
      </FloatingIconButton>
      <FloatingIconButton type="button" label="关闭" tooltipSide="bottom" danger onClick={() => void runWindowAction("close")}>
        <Xmark />
      </FloatingIconButton>
    </div>
  );
}

function MarkdownWindowPanel({
  title,
  path,
  value,
  dirty,
  windowState,
  onWindowStateChange,
  onClose,
  onSave,
  onChange
}: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  onSave: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <section className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="flex min-w-0 items-center gap-2">
          <Text className="size-4 shrink-0 text-icon" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
              <span className="truncate">{title}</span>
              {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-foreground/60" aria-hidden /> : null}
            </div>
            <div className="truncate text-[11px] leading-4 text-muted-foreground" title={path || title}>{path || "Markdown 窗口"}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")} onClick={onSave} aria-label="保存 Markdown 窗口">
                <FloppyDisk className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">保存 Markdown 窗口</TooltipContent>
          </Tooltip>
          <WorkspacePanelControls
            windowState={windowState}
            onWindowStateChange={onWindowStateChange}
            onClose={onClose}
            closeLabel="关闭 Markdown 窗口"
            closeTooltipSide="top"
            closeIcon={<Xmark />}
          />
        </div>
      </header>
      <MarkdownPanel
        key={`${title}:markdown-window`}
        value={value}
        onChange={onChange}
        className="bg-background/95"
      />
    </section>
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
        "pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card/95 px-3 py-2 text-xs shadow-sm backdrop-blur",
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
          {error.path ? <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{error.path}</div> : null}
          <div className="mt-2 text-xs text-muted-foreground">{fileWorkflowErrorSuggestion(error.code)}</div>
        </div>
        <Button size="icon" variant="ghost" className="size-8 shrink-0 text-icon hover:text-icon" onClick={onClose} aria-label="关闭文件错误提示">
          <Xmark className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function UnsavedFilePrompt({ prompt, onResolve }: { prompt: UnsavedPromptState; onResolve: (choice: UnsavedPromptChoice) => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/10 px-4 backdrop-blur-[1px]">
      <section className="w-[min(416px,100%)] rounded-md border bg-card p-4 shadow-sm">
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
  projectWorkspace,
  projectFiles,
  currentFileRef,
  projectBusy,
  onOpenProject,
  onRefreshProject,
  onCloseProject,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  windowState,
  onWindowStateChange,
  onCollapse
}: {
  runtimeKind: "web" | "desktop";
  projectWorkspace: ProjectWorkspace | null;
  projectFiles: ProjectFileEntry[];
  currentFileRef: RuntimeFileRef | null;
  projectBusy: boolean;
  onOpenProject: () => void;
  onRefreshProject: () => void;
  onCloseProject: () => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onCollapse: () => void;
}) {
  const tree = useMemo(() => buildProjectFileTree(projectFiles), [projectFiles]);
  const [fileContextMenu, setFileContextMenu] = useState<{ file: ProjectFileEntry; x: number; y: number } | null>(null);
  const topLevelDirectoryKey = useMemo(
    () => tree.filter((node): node is Extract<ProjectTreeNode, { kind: "directory" }> => node.kind === "directory").map((node) => node.id).join("\n"),
    [tree]
  );
  const [expandedDirectoryIds, setExpandedDirectoryIds] = useState<Set<string>>(() => new Set());
  const projectAvailable = runtimeKind === "desktop";

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

  function openFileContextMenu(file: ProjectFileEntry, event: ReactMouseEvent) {
    event.preventDefault();
    setFileContextMenu({ file, x: event.clientX, y: event.clientY });
  }

  return (
    <aside className="grid h-full min-h-0 grid-rows-[42px_minmax(0,1fr)] bg-card/95">
      <header data-floating-panel-drag-handle className="flex min-w-0 cursor-grab items-center justify-between gap-2 border-b bg-card/95 px-3 active:cursor-grabbing">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">资源管理器</div>
        </div>
        <WorkspacePanelControls
          windowState={windowState}
          onWindowStateChange={onWindowStateChange}
          onClose={onCollapse}
          closeLabel="关闭资源管理器"
          closeTooltipSide="right"
          closeIcon={<Xmark />}
        />
      </header>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-2">
          <div className="min-w-0">
            <ExplorerSectionTitle>文件夹</ExplorerSectionTitle>
            <div className="truncate text-xs text-muted-foreground" title={projectWorkspace?.rootPath}>
              {projectWorkspace
                ? `${projectWorkspace.rootName} · ${projectWorkspace.files.length}${projectWorkspace.truncated ? "+" : ""} 个项目文档`
                : projectAvailable
                  ? "打开文件后会自动显示同目录文档"
                  : "桌面版支持文件夹浏览"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={!projectAvailable || projectBusy} onClick={onOpenProject} aria-label="打开工作区文件夹">
                  <Folder className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">打开文件夹</TooltipContent>
            </Tooltip>
            {projectWorkspace ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={projectBusy} onClick={onRefreshProject} aria-label="刷新工作区文件">
                      <RefreshCw className={cn("size-4", projectBusy && "animate-spin")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">刷新文件夹</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className={EDITOR_CHROME_CLASSES.panelIconButton} disabled={projectBusy} onClick={onCloseProject} aria-label="关闭工作区文件夹">
                      <Xmark className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">关闭文件夹</TooltipContent>
                </Tooltip>
              </>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-1 py-2">
          {!projectWorkspace ? (
            <WorkspaceFolderEmptyState projectAvailable={projectAvailable} projectBusy={projectBusy} onOpenProject={onOpenProject} />
          ) : tree.length ? (
            <div className="grid gap-0.5">
              {tree.map((node) => (
                <ProjectTreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedDirectoryIds}
                  currentFileRef={currentFileRef}
                  onToggleDirectory={toggleDirectory}
                  onOpenProjectFile={onOpenProjectFile}
                  onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                  onOpenFileContextMenu={openFileContextMenu}
                />
              ))}
            </div>
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground">此文件夹下没有项目文档</div>
          )}
        </div>
        <ProjectFileContextMenu
          menu={fileContextMenu}
          onOpenChange={(open) => {
            if (!open) setFileContextMenu(null);
          }}
          onOpenProjectFile={(file) => {
            setFileContextMenu(null);
            onOpenProjectFile(file);
          }}
          onOpenProjectMarkdownWindow={(file) => {
            setFileContextMenu(null);
            onOpenProjectMarkdownWindow(file);
          }}
        />
      </div>
    </aside>
  );
}

function ExplorerSectionTitle({ children }: { children: ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{children}</div>;
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
      <div className="text-xs text-muted-foreground">{projectAvailable ? "打开文件后会自动显示同目录文档" : "桌面版支持文件夹浏览"}</div>
      <Button variant="outline" className={cn(EDITOR_CHROME_CLASSES.menuRow, "text-xs")} disabled={!projectAvailable || projectBusy} onClick={onOpenProject}>
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
  onOpenProjectFile,
  onOpenProjectMarkdownWindow,
  onOpenFileContextMenu
}: {
  node: ProjectTreeNode;
  depth: number;
  expandedIds: Set<string>;
  currentFileRef: RuntimeFileRef | null;
  onToggleDirectory: (id: string) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
  onOpenFileContextMenu: (file: ProjectFileEntry, event: ReactMouseEvent) => void;
}) {
  const paddingLeft = 8 + depth * 16;

  if (node.kind === "directory") {
    const expanded = expandedIds.has(node.id);
    return (
      <div className="grid gap-0.5">
        <Button
          type="button"
          variant="ghost"
          className={cn(EDITOR_CHROME_CLASSES.treeRow, "gap-1")}
          style={{ paddingLeft }}
          aria-expanded={expanded}
          onClick={() => onToggleDirectory(node.id)}
          title={node.relativePath}
        >
          {expanded ? <NavArrowDown className="size-4 shrink-0" /> : <NavArrowRight className="size-4 shrink-0" />}
          <Folder className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
          <span className="text-xs text-muted-foreground">{node.fileCount}</span>
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
                onOpenProjectMarkdownWindow={onOpenProjectMarkdownWindow}
                onOpenFileContextMenu={onOpenFileContextMenu}
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
      className={cn(EDITOR_CHROME_CLASSES.treeRow, "gap-2")}
      style={{ paddingLeft }}
      title={node.file.path}
      onClick={() => onOpenProjectFile(node.file)}
      onContextMenu={(event) => onOpenFileContextMenu(node.file, event)}
    >
      <EmptyPage className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs">{node.name}</span>
    </Button>
  );
}

function ProjectFileContextMenu({
  menu,
  onOpenChange,
  onOpenProjectFile,
  onOpenProjectMarkdownWindow
}: {
  menu: { file: ProjectFileEntry; x: number; y: number } | null;
  onOpenChange: (open: boolean) => void;
  onOpenProjectFile: (file: ProjectFileEntry) => void;
  onOpenProjectMarkdownWindow: (file: ProjectFileEntry) => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open: Boolean(menu), onOpenChange });
  if (!menu) return null;

  const markdownFile = isSupportedMarkdownFilePath(menu.file.path);
  const menuWidth = 224;
  const menuHeight = markdownFile ? 122 : 82;
  const left = typeof window === "undefined" ? menu.x : Math.max(12, Math.min(menu.x, window.innerWidth - menuWidth - 12));
  const top = typeof window === "undefined" ? menu.y : Math.max(12, Math.min(menu.y, window.innerHeight - menuHeight - 12));

  return (
    <div
      ref={menuRef}
      className="fixed z-[90] w-56 rounded-lg border bg-popover/95 p-2 text-popover-foreground shadow-lg backdrop-blur"
      style={{ left, top }}
      data-editor-floating-menu-ignore
    >
      <div className="mb-1 min-w-0 truncate px-2 py-1 text-xs text-muted-foreground" title={menu.file.path}>
        {menu.file.name}
      </div>
      <Button data-floating-action-item variant="ghost" className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")} onClick={() => onOpenProjectFile(menu.file)}>
        <EmptyPage className="size-4 shrink-0" />
        <span className="block min-w-0 flex-1 truncate">打开为当前文档</span>
      </Button>
      {markdownFile ? (
        <Button
          data-floating-action-item
          variant="ghost"
          className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")}
          onClick={() => onOpenProjectMarkdownWindow(menu.file)}
        >
          <Text className="size-4 shrink-0" />
          <span className="block min-w-0 flex-1 truncate">以窗口形式打开</span>
        </Button>
      ) : null}
    </div>
  );
}

function FileMenu({
  open,
  recentFiles,
  runtimeKind,
  projectBusy,
  isDirty,
  onOpenChange,
  onNewMermaidFile,
  onNewMarkdownFile,
  onNewCanvasFile,
  onOpenFile,
  onOpenRecent,
  onOpenProject,
  onSaveFile,
  onSaveAs
}: {
  open: boolean;
  recentFiles: RecentFileEntry[];
  runtimeKind: "web" | "desktop";
  projectBusy: boolean;
  isDirty: boolean;
  onOpenChange: (open: boolean) => void;
  onNewMermaidFile: () => void;
  onNewMarkdownFile: () => void;
  onNewCanvasFile: () => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFileEntry) => void;
  onOpenProject: () => void;
  onSaveFile: () => void;
  onSaveAs: () => void;
}) {
  const menuRef = useDismissableFloatingMenu<HTMLDivElement>({ open, onOpenChange });
  const projectAvailable = runtimeKind === "desktop";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <FloatingIconButton label="文件" dirty={isDirty} onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <Folder />
      </FloatingIconButton>

      <FloatingPanel open={open} placement="top-left" kind="popover" dismissMode="outside" className="w-72">
        <div className="grid gap-0.5">
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMermaidFile)}>
            <Plus className="size-4" />
            新建 Mermaid
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewMarkdownFile)}>
            <Text className="size-4" />
            新建 Markdown
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onNewCanvasFile)}>
            <FrameSimple className="size-4" />
            新建无限画布
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onOpenFile)}>
            <Folder className="size-4" />
            打开文件
          </Button>
          {projectAvailable ? (
            <Button
              data-floating-action-item
              variant="ghost"
              className={EDITOR_CHROME_CLASSES.menuRow}
              disabled={projectBusy}
              onClick={() => runAndClose(onOpenProject)}
            >
              <Workflow className="size-4" />
              打开文件夹
            </Button>
          ) : null}
          <Separator className="my-1" />
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveFile)}>
            <FloppyDisk className="size-4" />
            保存
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveAs)}>
            <FloppyDiskArrowOut className="size-4" />
            另存为
          </Button>
          <Separator className="my-1" />
          <div data-floating-action-item className="px-2 py-1 text-xs text-muted-foreground">最近打开</div>
          {recentFiles.length ? (
            recentFiles.map((file) => (
              <Button
                key={file.path}
                data-floating-action-item
                variant="ghost"
                className={cn(EDITOR_CHROME_CLASSES.menuRow, "w-full min-w-0 gap-2 overflow-hidden text-left")}
                title={file.path}
                onClick={() => runAndClose(() => onOpenRecent(file))}
              >
                <ClockRotateRight className="size-4 shrink-0" />
                <span className="block min-w-0 flex-1 overflow-hidden truncate">{file.name}</span>
              </Button>
            ))
          ) : (
            <div data-floating-action-item className="px-2 py-2 text-xs text-muted-foreground">暂无最近文件</div>
          )}
        </div>
      </FloatingPanel>
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
      <FloatingIconButton
        label={hiddenCount > 0 ? `视图过滤器：已隐藏 ${hiddenCount} 项` : "视图过滤器"}
        tooltipSide="left"
        active={hiddenCount > 0}
        badgeCount={hiddenCount}
        onClick={() => onOpenChange(!open)}
        disabled={!editable}
        aria-expanded={open}
      >
        <FilterAlt />
      </FloatingIconButton>

      <FloatingPanel open={open} placement="right" kind="popover" dismissMode="outside" className="w-72">
        <div data-floating-action-item className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-medium text-foreground">视图过滤器</span>
          <span className="text-xs text-muted-foreground">{hiddenCount > 0 ? `隐藏 ${hiddenCount} 项` : "全部显示"}</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={onReset}>
            <Eye className="size-4" />
            全部显示
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={hideEdges}>
            <Link className="size-4" />
            隐藏连线
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={showNodesOnly}>
            <SquareDashedMousePointer className="size-4" />
            仅节点
          </Button>
          <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={hideLabels}>
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
      </FloatingPanel>
    </div>
  );
}

function FilterToggle({ active, label, icon, compact = false, onClick }: { active: boolean; label: string; icon?: ReactNode; compact?: boolean; onClick: () => void }) {
  return (
    <Button
      data-floating-action-item
      type="button"
      variant="ghost"
      className={cn(
        EDITOR_CHROME_CLASSES.menuRow,
        compact ? "gap-2 text-xs" : "",
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
      data-floating-action-item
      type="button"
      variant="ghost"
      className={cn(EDITOR_CHROME_CLASSES.menuRow, "gap-2", !active && "text-muted-foreground")}
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
  documentKind,
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
  documentKind: DocumentKind;
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
  const isCanvasDocument = documentKind === "canvas";

  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  function updatePreference(nextPreferences: EditorPreferences, message: string) {
    onPreferencesChange(nextPreferences, message);
  }

  return (
    <div ref={menuRef} className="relative">
      <FloatingIconButton label="更多操作" tooltipSide="top" onClick={() => onOpenChange(!open)} aria-expanded={open}>
        <MoreHoriz />
      </FloatingIconButton>

      <FloatingPanel
        open={open}
        placement="bottom-left"
        kind="popover"
        dismissMode="outside"
        className="max-h-[min(720px,calc(100vh-112px))] w-64 overflow-y-auto"
      >
        <div className="grid gap-0.5">
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onAddNode)}
              disabled={!editable}
            >
              <Plus className="size-4" />
              新增节点
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onAddImageNode)}
              disabled={!editable}
            >
              <FrameSimple className="size-4" />
              添加图片节点
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onCreateGroup)}
              disabled={!editable}
            >
              <SquareDashedMousePointer className="size-4" />
              选中内容成组
            </Button>
            <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onSaveAs)}>
              <FloppyDiskArrowOut className="size-4" />
              另存为
            </Button>
            <Separator className="my-1" />
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
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
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PositionAlign className="size-4 text-icon" />
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
            <div data-floating-action-item className="grid gap-2 px-2 py-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <PathArrow className="size-4 text-icon" />
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
            <div data-floating-action-item className="grid gap-0.5 px-1 py-1">
              <span className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                <Eye className="size-4 text-icon" />
                应用设置
              </span>
              <div className="grid gap-2 px-1 py-1">
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
            <Button data-floating-action-item variant="ghost" className={EDITOR_CHROME_CLASSES.menuRow} onClick={() => runAndClose(onOpenThemeSettings)}>
              <ColorWheel className="size-4" />
              主题
            </Button>
            <Button data-floating-action-item variant="ghost" className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")} disabled={documentKind !== "mermaid"} onClick={() => runAndClose(onRefreshSource)}>
              <RefreshCw className="size-4" />
              从源码刷新
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onSyncAutoLayout)}
              disabled={!editable}
            >
              <PositionAlign className="size-4" />
              立即自动布局
            </Button>
            <Button
              data-floating-action-item
              variant="ghost"
              className={cn(EDITOR_CHROME_CLASSES.menuRow, "disabled:opacity-40")}
              onClick={() => runAndClose(onResetView)}
              disabled={!editable && !isCanvasDocument}
            >
              <Maximize2 className="size-4" />
              重置画布视图
            </Button>
        </div>
      </FloatingPanel>
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

  function updateTerminalColor(key: keyof EditorTheme["terminal"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, terminal: { ...theme.terminal, [key]: value } }));
  }

  function updateAnsiColor(key: keyof EditorTheme["ansi"], value: string) {
    updateCustomTheme((theme) => ({ ...theme, ansi: { ...theme.ansi, [key]: value } }));
  }

  function resetTerminalColors() {
    updateCustomTheme((theme) => ({ ...theme, terminal: { ...DEFAULT_EDITOR_THEME.terminal } }));
  }

  function resetAnsiColors() {
    updateCustomTheme((theme) => ({ ...theme, ansi: { ...DEFAULT_EDITOR_THEME.ansi } }));
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

  function updateMotionDurationNumber(key: keyof EditorTheme["motion"]["duration"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, duration: { ...theme.motion.duration, [key]: value } } }));
  }

  function updateMotionDistanceNumber(key: keyof EditorTheme["motion"]["distance"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, distance: { ...theme.motion.distance, [key]: value } } }));
  }

  function updateMotionStaggerNumber(key: keyof EditorTheme["motion"]["stagger"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, stagger: { ...theme.motion.stagger, [key]: value } } }));
  }

  function updateMotionCanvasNumber(key: keyof EditorTheme["motion"]["canvas"], value: number) {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...theme.motion, canvas: { ...theme.motion.canvas, [key]: value } } }));
  }

  function resetMotion() {
    updateCustomTheme((theme) => ({ ...theme, motion: { ...DEFAULT_EDITOR_THEME.motion } }));
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
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">动效</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetMotion}>
                  重置动效
                </Button>
              </div>
              <ThemeMotionPreview theme={activeTheme} />
              <ThemeNumberField label="快速时长" value={activeTheme.motion.duration.fast} min={0} max={0.4} step={0.01} onChange={(value) => updateMotionDurationNumber("fast", value)} />
              <ThemeNumberField label="基础时长" value={activeTheme.motion.duration.base} min={0} max={0.8} step={0.01} onChange={(value) => updateMotionDurationNumber("base", value)} />
              <ThemeNumberField label="面板时长" value={activeTheme.motion.duration.slow} min={0} max={1.2} step={0.01} onChange={(value) => updateMotionDurationNumber("slow", value)} />
              <ThemeNumberField label="布局时长" value={activeTheme.motion.duration.layout} min={0} max={1.6} step={0.01} onChange={(value) => updateMotionDurationNumber("layout", value)} />
              <ThemeNumberField label="控件距离" value={activeTheme.motion.distance.chrome} min={0} max={32} step={1} onChange={(value) => updateMotionDistanceNumber("chrome", value)} />
              <ThemeNumberField label="面板距离" value={activeTheme.motion.distance.panel} min={0} max={96} step={1} onChange={(value) => updateMotionDistanceNumber("panel", value)} />
              <ThemeNumberField label="视图距离" value={activeTheme.motion.distance.viewport} min={0} max={320} step={4} onChange={(value) => updateMotionDistanceNumber("viewport", value)} />
              <ThemeNumberField label="按钮错峰" value={activeTheme.motion.stagger.button} min={0} max={0.16} step={0.005} onChange={(value) => updateMotionStaggerNumber("button", value)} />
              <ThemeNumberField label="列表错峰" value={activeTheme.motion.stagger.list} min={0} max={0.16} step={0.005} onChange={(value) => updateMotionStaggerNumber("list", value)} />
              <ThemeNumberField label="新建缩放" value={activeTheme.motion.canvas.createScale} min={0.7} max={1} step={0.01} onChange={(value) => updateMotionCanvasNumber("createScale", value)} />
              <ThemeNumberField label="选中缩放" value={activeTheme.motion.canvas.selectedScale} min={1} max={1.08} step={0.005} onChange={(value) => updateMotionCanvasNumber("selectedScale", value)} />
              <ThemeNumberField label="高亮时长" value={activeTheme.motion.canvas.highlightDuration} min={0} max={1.8} step={0.01} onChange={(value) => updateMotionCanvasNumber("highlightDuration", value)} />
              <ThemeNumberField label="动画上限" value={activeTheme.motion.canvas.maxAnimatedItems} min={0} max={400} step={10} onChange={(value) => updateMotionCanvasNumber("maxAnimatedItems", value)} />
              <ThemeNumberField label="靠近半径" value={activeTheme.motion.canvas.proximityRadiusPx} min={0} max={600} step={10} onChange={(value) => updateMotionCanvasNumber("proximityRadiusPx", value)} />
              <ThemeNumberField label="靠近缩放" value={activeTheme.motion.canvas.proximityMaxScale} min={1} max={3} step={0.01} onChange={(value) => updateMotionCanvasNumber("proximityMaxScale", value)} />
              <ThemeNumberField label="靠近时长" value={activeTheme.motion.canvas.proximityDuration} min={0} max={0.8} step={0.01} onChange={(value) => updateMotionCanvasNumber("proximityDuration", value)} />
            </div>

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
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">终端</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetTerminalColors}>
                  重置终端
                </Button>
              </div>
              <ThemeTerminalPreview theme={activeTheme} />
              <ThemeColorField label="背景" value={activeTheme.terminal.background} onChange={(value) => updateTerminalColor("background", value)} />
              <ThemeColorField label="文字" value={activeTheme.terminal.foreground} onChange={(value) => updateTerminalColor("foreground", value)} />
              <ThemeColorField label="光标" value={activeTheme.terminal.cursor} onChange={(value) => updateTerminalColor("cursor", value)} />
              <ThemeColorField label="光标文字" value={activeTheme.terminal.cursorAccent} onChange={(value) => updateTerminalColor("cursorAccent", value)} />
              <ThemeColorField label="选区" value={activeTheme.terminal.selectionBackground} onChange={(value) => updateTerminalColor("selectionBackground", value)} />
              <ThemeColorField label="选区文字" value={activeTheme.terminal.selectionForeground} onChange={(value) => updateTerminalColor("selectionForeground", value)} />
              <ThemeNumberField label="字号" value={activeTheme.font.sizeTerminal} min={10} max={22} step={1} onChange={(value) => updateFontNumber("sizeTerminal", value)} />
              <ThemeNumberField label="行高" value={activeTheme.font.lineHeightTerminal} min={14} max={32} step={1} onChange={(value) => updateFontNumber("lineHeightTerminal", value)} />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-medium text-muted-foreground">ANSI 16 色</h3>
                <Button variant="ghost" className="h-8 px-2" onClick={resetAnsiColors}>
                  重置 ANSI
                </Button>
              </div>
              <div className="grid gap-2">
                {ansiColorRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-4 gap-2">
                    {row.map((key) => (
                      <ThemeAnsiColorField key={key} label={ansiColorLabels[key]} value={activeTheme.ansi[key]} onChange={(value) => updateAnsiColor(key, value)} />
                    ))}
                  </div>
                ))}
              </div>
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

function ThemeAnsiColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        className="h-8 w-full cursor-pointer rounded-md border bg-background p-1"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="truncate font-mono text-[10px] leading-4">{value}</span>
    </label>
  );
}

function ThemeTerminalPreview({ theme }: { theme: EditorTheme }) {
  return (
    <div
      className="grid gap-2 rounded-md border p-3 font-mono text-xs"
      style={{
        borderColor: theme.ui.border,
        backgroundColor: theme.terminal.background,
        color: theme.terminal.foreground,
        fontSize: theme.font.sizeTerminal,
        lineHeight: `${theme.font.lineHeightTerminal}px`
      }}
    >
      <div className="flex items-center gap-2">
        <Terminal className="size-4" style={{ color: theme.ui.icon }} />
        <span style={{ color: theme.ansi.green }}>project</span>
        <span style={{ color: theme.ansi.blue }}>main</span>
        <span style={{ color: theme.terminal.cursor }}>$</span>
        <span>npm run build</span>
      </div>
      <div className="grid gap-1">
        <span style={{ color: theme.ansi.green }}>✓ 类型检查通过</span>
        <span style={{ color: theme.ansi.yellow }}>! 发现 1 条主题诊断</span>
        <span style={{ color: theme.ansi.red }}>x 终端输出错误示例</span>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {ansiColorRows.flat().map((key) => (
          <span key={key} className="h-5 rounded-sm border" style={{ borderColor: theme.ui.border, backgroundColor: theme.ansi[key] }} title={ansiColorLabels[key]} />
        ))}
      </div>
    </div>
  );
}

function ThemeMotionPreview({ theme }: { theme: EditorTheme }) {
  return (
    <div className="grid gap-2 rounded-md border p-3" style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.background }}>
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ backgroundColor: theme.ui.primary }} />
        <span className="size-3 rounded-full opacity-80" style={{ backgroundColor: theme.ui.icon }} />
        <span className="size-3 rounded-full opacity-60" style={{ backgroundColor: theme.ui.border }} />
      </div>
      <div className="text-xs text-muted-foreground">
        {`快速 ${Math.round(theme.motion.duration.fast * 1000)}ms · 基础 ${Math.round(theme.motion.duration.base * 1000)}ms · 布局 ${Math.round(theme.motion.duration.layout * 1000)}ms`}
      </div>
    </div>
  );
}

function ThemePreview({ theme }: { theme: EditorTheme }) {
  return (
    <div className="grid gap-2 rounded-md border p-3" style={{ backgroundColor: theme.ui.background, color: theme.ui.foreground }}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-md border" style={{ borderColor: theme.ui.border, backgroundColor: theme.ui.card }}>
          <ColorWheel className="m-2 size-4" style={{ color: theme.ui.icon }} />
        </div>
        <div className="h-8 rounded-md px-3 py-1 text-sm" style={{ backgroundColor: theme.ui.primary, color: theme.ui.background }}>
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
      <div className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: theme.ui.border, backgroundColor: theme.terminal.background, color: theme.terminal.foreground }}>
        <span style={{ color: theme.ansi.green }}>project</span> <span style={{ color: theme.terminal.cursor }}>$</span> terminal
      </div>
    </div>
  );
}

function toCustomTheme(theme: EditorTheme): EditorTheme {
  return {
    version: 4,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    description: theme.description,
    baseThemeId: theme.id === "custom" ? theme.baseThemeId : theme.id,
    ui: { ...theme.ui },
    canvas: { ...theme.canvas },
    source: { ...theme.source },
    render: { ...theme.render },
    ansi: { ...theme.ansi },
    terminal: { ...theme.terminal },
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
    motion: {
      duration: { ...theme.motion.duration },
      ease: { ...theme.motion.ease },
      distance: { ...theme.motion.distance },
      stagger: { ...theme.motion.stagger },
      canvas: { ...theme.motion.canvas }
    },
    diagnostics: { ...theme.diagnostics }
  };
}

function PanelHeader({
  windowState,
  onWindowStateChange,
  onCollapse
}: {
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onCollapse: () => void;
}) {
  return (
    <div className="absolute right-2 top-2 z-30">
      <WorkspacePanelControls
        windowState={windowState}
        onWindowStateChange={onWindowStateChange}
        onClose={onCollapse}
        closeLabel="关闭检查器"
        closeTooltipSide="left"
        closeIcon={<Xmark />}
      />
    </div>
  );
}

function WorkspacePanelControls({
  windowState,
  onWindowStateChange,
  onClose,
  closeLabel,
  closeTooltipSide,
  closeIcon
}: {
  windowState: FloatingPanelWindowState;
  onWindowStateChange: (state: FloatingPanelWindowState) => void;
  onClose: () => void;
  closeLabel: string;
  closeTooltipSide: "top" | "right" | "bottom" | "left";
  closeIcon: ReactNode;
}) {
  const maximized = windowState === "maximized";

  return (
    <div className="flex shrink-0 items-center gap-1" data-floating-panel-drag-exclude>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")}
            onClick={() => onWindowStateChange(maximized ? "normal" : "maximized")}
            aria-label={maximized ? "还原面板" : "最大化面板"}
          >
            <Maximize className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={closeTooltipSide}>{maximized ? "还原面板" : "最大化面板"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className={cn(EDITOR_CHROME_CLASSES.panelIconButton, "bg-card/85")} onClick={onClose} aria-label={closeLabel}>
            {closeIcon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={closeTooltipSide}>{closeLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
