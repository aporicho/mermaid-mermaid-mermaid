"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CodeBracketsSquare as FileCode2,
  ColorWheel,
  DotsGrid3x3 as Grid3X3,
  Eye,
  EyeClosed,
  Expand as Maximize2,
  FilterAlt,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  Group as GroupIcon,
  GitBranch as Workflow,
  Link,
  MoreHoriz,
  PathArrow,
  PositionAlign,
  Plus,
  Refresh as RefreshCw,
  SidebarCollapse as PanelRightClose,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  SquareCursor as SquareDashedMousePointer,
  Text
} from "iconoir-react/regular";

import { InspectorPanel } from "@/features/mermaid-editor/components/inspector-panel";
import { PreviewPanel } from "@/features/mermaid-editor/components/preview-panel";
import { SourcePanel } from "@/features/mermaid-editor/components/source-panel";
import { ToolModeBar } from "@/features/mermaid-editor/components/tool-mode-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyLayout, edgeRoutingFromLayout, layoutFromGraph, layoutModeFromLayout, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import { applyDagreAutoLayout, deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { buildAiEditorContext, type AiCanvasSize, type AiEditingContext, type AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import type { AiApplyResult, AiEditorCommand, AiNextCommandResponse } from "@/features/mermaid-editor/lib/ai-command-types";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import {
  copySelection,
  emptySelection,
  hasSelection,
  setMode as setEditorMode
} from "@/features/mermaid-editor/lib/editor-actions";
import { createHistory, pushHistory, redo, undo } from "@/features/mermaid-editor/lib/editor-history";
import { hasBlockingDiagnostics, normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
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
import type { CanvasLayout } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE } from "@/features/mermaid-editor/lib/editor-types";
import {
  applyEditorThemeToDocument,
  BUILT_IN_EDITOR_THEMES,
  DEFAULT_EDITOR_THEME,
  type EditorTheme,
  type EditorThemeId,
  isHexColor,
  normalizeEditorTheme,
  resolveEditorTheme,
  themeToCanvasVisualTokens,
  themeToMermaidThemeVariables
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
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mermaid-canvas-editor:v1";

const KonvaCanvas = dynamic(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => mod.KonvaCanvas), {
  ssr: false,
  loading: () => <div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>
});

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
  dotted: "虚线"
};
const arrowTypeFilterLabels: Record<FlowchartArrowType, string> = {
  arrow: "箭头",
  none: "无箭头",
  circle: "圆点",
  cross: "叉号"
};
type WorkspaceView = "canvas" | "render";
const FALLBACK_FILE_NAME = "diagram.mmd";
const FILE_PICKER_TYPES = [
  {
    description: "Mermaid 文件",
    accept: {
      "text/plain": [".mmd", ".mermaid", ".txt"]
    }
  }
];

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
  themeId?: EditorThemeId;
  customTheme?: EditorTheme | null;
};

type MermaidWritableFile = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

type MermaidFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<MermaidWritableFile>;
};

type MermaidFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<MermaidFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<MermaidFileHandle>;
};

type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
  editing?: Exclude<AiEditingContext, { kind: "source" }> | null;
  interaction?: string;
};

function loadInitialState() {
  const fallbackGraph = parseMermaid(initialMermaidSource);
  const fallbackViewport = { x: 160, y: 90, scale: 1 };
  const fallbackSource = serializeMermaid(fallbackGraph);
  const fallbackDocument = loadMermaidDocument(fallbackSource);

  if (typeof window === "undefined") {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      diagramType: fallbackDocument.diagramType,
      editableKind: fallbackDocument.editableKind,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      layoutMode: DEFAULT_LAYOUT_MODE,
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("No saved editor state");
    const stored = JSON.parse(raw) as StoredEditor;
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
    const themeId = normalizeThemeId(stored.themeId);
    const customTheme = stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null;
    const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });

    return {
      source,
      graph: resolvedGraph,
      diagramType: loaded.diagramType,
      editableKind: loaded.editableKind,
      viewport,
      edgeRouting,
      layoutMode,
      leftCollapsed: stored.leftCollapsed || false,
      rightCollapsed: stored.rightCollapsed || false,
      workspaceView: loaded.editableKind === "flowchart" ? stored.workspaceView || "canvas" : "render",
      viewFilters,
      fileName: stored.fileName || FALLBACK_FILE_NAME,
      themeId,
      customTheme
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
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null
    };
  }
}

function ensureMermaidFileName(value: string | undefined) {
  const name = value?.trim() || FALLBACK_FILE_NAME;
  return /\.(mmd|mermaid)$/i.test(name) ? name : `${name.replace(/\.[^.]+$/, "")}.mmd`;
}

function comparableMermaidFileName(value: string | undefined) {
  const name = value?.split(/[\\/]/).pop();
  return ensureMermaidFileName(name).toLowerCase();
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
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

async function writeDocumentToHandle(handle: MermaidFileHandle, documentText: string) {
  const writable = await handle.createWritable();
  await writable.write(documentText);
  await writable.close();
}

function downloadMermaidDocument(documentText: string, name: string) {
  const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureMermaidFileName(name);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

export function MermaidEditor() {
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
  const [fileHandle, setFileHandle] = useState<MermaidFileHandle | null>(null);
  const [lastSavedDocument, setLastSavedDocument] = useState("");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const [viewFiltersOpen, setViewFiltersOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const [canvasLiveState, setCanvasLiveState] = useState<CanvasLiveState>({});
  const [recentActions, setRecentActions] = useState<AiRecentAction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const themeEditBaseRef = useRef<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);
  const storageWriteTimerRef = useRef<number | null>(null);
  const aiContextPostTimerRef = useRef<number | null>(null);
  const aiCommandBusyRef = useRef(false);
  const actionCounterRef = useRef(0);

  const currentDocument = useMemo(() => buildMermaidDocument(source, graph, viewport, edgeRouting, layoutMode), [source, graph, viewport, edgeRouting, layoutMode]);
  const hiddenViewFilters = useMemo(() => hiddenFilterCount(viewFilters), [viewFilters]);
  const mermaidEdgeRoutes = useMemo(
    () => (edgeRouting === "mermaid" ? deriveDagreAutoLayoutResult(graph).edgeRoutes : []),
    [edgeRouting, graph]
  );
  const activeTheme = useMemo(() => resolveEditorTheme(themeId, customTheme), [customTheme, themeId]);
  const canvasVisualTokens = useMemo(() => themeToCanvasVisualTokens(activeTheme), [activeTheme]);
  const mermaidThemeVariables = useMemo(() => themeToMermaidThemeVariables(activeTheme), [activeTheme]);
  const isDirty = !lastSavedDocument || currentDocument !== lastSavedDocument;
  const fileLabel = `${fileName || FALLBACK_FILE_NAME}${isDirty ? " *" : ""}`;
  const isCanvasEditable = editableKind === "flowchart";
  const canvasViewTooltip = isCanvasEditable ? "无限画布" : `${diagramTypeLabel(diagramType)} 仅支持渲染`;

  const updateCanvasLiveState = useCallback((next: CanvasLiveState) => {
    setCanvasLiveState((current) => (canvasLiveStateKey(current) === canvasLiveStateKey(next) ? current : next));
  }, []);

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
    return fetch("/api/ai/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(context)
    }).catch(() => {
      // The CLI context bridge is best-effort; editor usage should not be blocked by it.
    });
  }, []);

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
        setWorkspaceView("render");
        setSource(loaded.source);
        setStatus("当前 Mermaid 类型仅刷新渲染视图。");
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
    if (loaded.editableKind !== "flowchart") setWorkspaceView("render");
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
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    setSource(loaded.source);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setGraph(loadedGraph);
    setSelection(emptySelection);
    setDiagnostics([]);
    setStatus(loaded.editableKind === "flowchart" ? "源码已解析到画布。" : "当前 Mermaid 类型已切换到渲染视图。");
    if (startedSourceEdit) recordRecentAction("source.edit", { kind: "source" }, "用户开始编辑 Mermaid 源码。");

    if (loaded.editableKind !== "flowchart") setWorkspaceView("render");
    setEdgeRouting(nextEdgeRouting);
    setLayoutMode(nextLayoutMode);
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

  function openThemeSettings() {
    themeEditBaseRef.current = { themeId, customTheme };
    setThemeSettingsOpen(true);
    setSecondaryActionsOpen(false);
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
    themeEditBaseRef.current = null;
    setThemeSettingsOpen(false);
    setStatus("主题已保存。");
  }

  function confirmDiscardUnsaved() {
    return !isDirty || window.confirm("当前文件有未保存更改，继续会丢失这些更改。");
  }

  function applyLoadedDocument(text: string, name: string, handle: MermaidFileHandle | null) {
    flushSourceHistory();
    const loaded = loadMermaidDocument(text);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const savedDocument = buildMermaidDocument(loaded.source, loadedGraph, nextViewport, loaded.edgeRouting, nextLayoutMode);

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
    setFileHandle(handle);
    setLastSavedDocument(savedDocument);
    setStatus(loaded.editableKind === "flowchart" ? `已打开 ${name}。` : `已打开 ${name}，当前类型仅渲染。`);
    recordRecentAction("document.open", { kind: "document" }, `打开 ${name}。`);
  }

  async function openMermaidFile() {
    if (!confirmDiscardUnsaved()) return;

    const picker = window as MermaidFilePickerWindow;
    if (!picker.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const [handle] = await picker.showOpenFilePicker({
        multiple: false,
        types: FILE_PICKER_TYPES,
        excludeAcceptAllOption: false
      });
      if (!handle) return;

      const file = await handle.getFile();
      applyLoadedDocument(await file.text(), file.name, handle);
    } catch (error) {
      if (!isAbortError(error)) setStatus("打开文件失败。");
    }
  }

  async function openFallbackFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      applyLoadedDocument(await file.text(), file.name, null);
    } catch {
      setStatus("打开文件失败。");
    }
  }

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileHandle) {
      await saveMermaidFileAs();
      return;
    }
    if (hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要保存吗？")) return;

    try {
      await writeDocumentToHandle(fileHandle, currentDocument);
      setFileName(ensureMermaidFileName(fileHandle.name));
      setLastSavedDocument(currentDocument);
      setStatus(`已保存 ${fileHandle.name}。`);
      recordRecentAction("document.save", { kind: "document" }, `保存 ${fileHandle.name}。`);
    } catch (error) {
      if (!isAbortError(error)) setStatus("保存文件失败。");
    }
  }

  async function saveMermaidFileAs() {
    flushSourceHistory();
    if (hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要另存为吗？")) return;
    const suggestedName = ensureMermaidFileName(fileName);
    const picker = window as MermaidFilePickerWindow;

    if (!picker.showSaveFilePicker) {
      downloadMermaidDocument(currentDocument, suggestedName);
      setFileName(suggestedName);
      setFileHandle(null);
      setLastSavedDocument(currentDocument);
      setStatus(`已下载 ${suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, `下载 ${suggestedName}。`);
      return;
    }

    try {
      const handle = await picker.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Mermaid 文件",
            accept: {
              "text/plain": [".mmd", ".mermaid"]
            }
          }
        ],
        excludeAcceptAllOption: false
      });
      await writeDocumentToHandle(handle, currentDocument);
      setFileName(ensureMermaidFileName(handle.name || suggestedName));
      setFileHandle(handle);
      setLastSavedDocument(currentDocument);
      setStatus(`已保存 ${handle.name || suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, `另存为 ${handle.name || suggestedName}。`);
    } catch (error) {
      if (!isAbortError(error)) setStatus("保存文件失败。");
    }
  }

  const postAiApplyResult = useCallback(async (result: AiApplyResult) => {
    await fetch(`/api/ai/commands/${encodeURIComponent(result.commandId)}/result`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result)
    });
  }, []);

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
      const nextDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode);
      const resultDiagnostics: EditorDiagnostic[] = [];
      let saved = false;

      if (command.autoSave) {
        if (!fileHandle) {
          resultDiagnostics.push(
            editorCommandDiagnostic(
              "NO_FILE_HANDLE",
              "当前 WebUI 没有可覆盖保存的文件句柄，已更新编辑器但无法写回原文件。",
              "先通过浏览器打开文件，或在编辑器里另存为一次。",
              "warning"
            )
          );
        } else {
          try {
            await writeDocumentToHandle(fileHandle, nextDocument);
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
      setWorkspaceView(loaded.editableKind === "flowchart" ? workspaceView : "render");
      setSelection(emptySelection);
      setDiagnostics([]);
      if (fileHandle) setFileName(ensureMermaidFileName(fileHandle.name));
      if (saved) setLastSavedDocument(nextDocument);
      setStatus(saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");
      recordRecentAction("ai.apply", { kind: "document" }, saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");

      await postAiApplyResult({
        commandId: command.id,
        applied: true,
        saved,
        changed: patched.result.changed,
        fileName: fileHandle?.name || fileName,
        source: nextDocument,
        diff: patched.result.diff,
        diagnostics: resultDiagnostics
      });
    },
    [currentDocument, fileHandle, fileName, graph, postAiApplyResult, snapshot, viewport, workspaceView]
  );

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!secondaryActionsOpen && !viewFiltersOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSecondaryActionsOpen(false);
        setViewFiltersOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [secondaryActionsOpen, viewFiltersOpen]);

  useEffect(() => {
    applyEditorThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);

    storageWriteTimerRef.current = window.setTimeout(() => {
      incrementPerformanceCounter("local-storage-write");
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          source,
          layout: layoutFromGraph(graph, viewport, edgeRouting, layoutMode),
          viewport,
          edgeRouting,
          layoutMode,
          leftCollapsed,
          rightCollapsed,
          workspaceView,
          viewFilters,
          fileName,
          themeId,
          customTheme
        } satisfies StoredEditor)
      );
      storageWriteTimerRef.current = null;
    }, 160);

    return () => {
      if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);
    };
  }, [source, graph, viewport, edgeRouting, layoutMode, leftCollapsed, rightCollapsed, workspaceView, viewFilters, fileName, themeId, customTheme]);

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
        const response = await fetch("/api/ai/commands/next", { headers: { accept: "application/json" } });
        if (!response.ok) return;
        const body = (await response.json()) as AiNextCommandResponse;
        if (disposed || !body.command) return;
        await processAiCommand(body.command);
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
  }, [processAiCommand]);

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
      <input ref={fileInputRef} type="file" accept=".mmd,.mermaid,.txt,text/plain" className="hidden" onChange={openFallbackFile} />
      <main className="relative grid h-screen grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-background">
        <header className="relative z-40 grid grid-cols-[minmax(220px,360px)_minmax(0,1fr)_auto] items-center gap-3 border-b bg-background px-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 className="size-4 shrink-0 text-icon" />
            <div className="min-w-0">
              <h1 className="sr-only">Mermaid Canvas Editor</h1>
              <p className="truncate text-sm font-medium">{fileLabel}</p>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8 text-icon hover:text-icon" onClick={openMermaidFile} aria-label="打开 Mermaid 文件">
                    <Folder className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">打开文件</TooltipContent>
              </Tooltip>
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

          <div className="flex items-center gap-1">
            <div className="flex gap-1">
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
            </div>
            <ViewFilterMenu
              open={viewFiltersOpen}
              filters={viewFilters}
              hiddenCount={hiddenViewFilters}
              editable={isCanvasEditable}
              onOpenChange={setViewFiltersOpen}
              onChange={updateViewFilter}
              onReset={resetViewFilters}
            />
            <SecondaryActionsMenu
              open={secondaryActionsOpen}
              direction={graph.direction}
              edgeRouting={edgeRouting}
              layoutMode={layoutMode}
              editable={isCanvasEditable}
              onOpenChange={setSecondaryActionsOpen}
              onAddNode={addNode}
              onCreateGroup={createGroupFromSelection}
              onSaveAs={() => void saveMermaidFileAs()}
              onDirectionChange={updateDirection}
              onEdgeRoutingChange={updateEdgeRouting}
              onLayoutModeChange={updateLayoutMode}
              onRefreshSource={refreshFromSource}
              onSyncAutoLayout={() => applyEditorCommand({ type: "layout.syncAuto", source: "menu" })}
              onResetView={() => updateViewport({ x: 160, y: 90, scale: 1 }, "menu")}
              onOpenThemeSettings={openThemeSettings}
            />
          </div>
        </header>

        <div className="relative z-0 min-h-0 overflow-hidden">
          <div className="absolute inset-0 z-0">
            {workspaceView === "canvas" && isCanvasEditable ? (
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
                visualTokens={canvasVisualTokens}
                onEditorCommand={applyEditorCommand}
                onLiveStateChange={updateCanvasLiveState}
              />
            ) : (
              <PreviewPanel
                source={source}
                graph={isCanvasEditable ? graph : undefined}
                framed={false}
                diagnostics={diagnostics}
                mermaidThemeVariables={mermaidThemeVariables}
                onEditorCommand={isCanvasEditable ? applyEditorCommand : undefined}
              />
            )}
          </div>
          {!leftCollapsed ? (
            <div className="absolute inset-y-0 left-0 z-20 w-[clamp(300px,31vw,420px)]">
              <SourcePanel value={source} diagnostics={diagnostics} onChange={applySource} onRun={refreshFromSource} onCollapse={() => setLeftCollapsed(true)} />
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
          {leftCollapsed ? <FloatingPanelOpenButton side="left" label="Mermaid" onOpen={() => setLeftCollapsed(false)} /> : null}
          {rightCollapsed ? <FloatingPanelOpenButton side="right" label="侧栏" onOpen={() => setRightCollapsed(false)} /> : null}
        </div>
        {status ? (
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
    <div className="relative">
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

function LabelIcon() {
  return <Text className="size-4" />;
}

function SecondaryActionsMenu({
  open,
  direction,
  edgeRouting,
  layoutMode,
  editable,
  onOpenChange,
  onAddNode,
  onCreateGroup,
  onSaveAs,
  onDirectionChange,
  onEdgeRoutingChange,
  onLayoutModeChange,
  onRefreshSource,
  onSyncAutoLayout,
  onResetView,
  onOpenThemeSettings
}: {
  open: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  editable: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: () => void;
  onCreateGroup: () => void;
  onSaveAs: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onLayoutModeChange: (layoutMode: LayoutMode) => void;
  onRefreshSource: () => void;
  onSyncAutoLayout: () => void;
  onResetView: () => void;
  onOpenThemeSettings: () => void;
}) {
  function runAndClose(action: () => void) {
    action();
    onOpenChange(false);
  }

  return (
    <div className="relative">
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
        <div className="absolute right-0 top-10 z-50 w-52 rounded-md border bg-popover p-1.5 text-popover-foreground">
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
                  onOpenChange(false);
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
                  onOpenChange(false);
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
                  onOpenChange(false);
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
              <ThemeColorField label="边框" value={activeTheme.ui.border} onChange={(value) => updateUiColor("border", value)} />
              <ThemeColorField label="强调" value={activeTheme.ui.primary} onChange={(value) => updateUiColor("primary", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">画布</h3>
              <ThemeColorField label="节点描边" value={activeTheme.canvas.nodeStroke} onChange={(value) => updateCanvasColor("nodeStroke", value)} />
              <ThemeColorField label="节点文字" value={activeTheme.canvas.nodeText} onChange={(value) => updateCanvasColor("nodeText", value)} />
              <ThemeColorField label="连线" value={activeTheme.canvas.edge} onChange={(value) => updateCanvasColor("edge", value)} />
              <ThemeColorField label="标签描边" value={activeTheme.canvas.labelStroke} onChange={(value) => updateCanvasColor("labelStroke", value)} />
            </div>

            <div className="grid gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">源码</h3>
              <ThemeColorField label="行分隔" value={activeTheme.source.line} onChange={(value) => updateSourceColor("line", value)} />
            </div>
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
    version: 1,
    id: "custom",
    name: theme.id === "custom" ? theme.name : "自定义主题",
    ui: { ...theme.ui },
    canvas: { ...theme.canvas },
    source: { ...theme.source }
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

function FloatingPanelOpenButton({ side, label, onOpen }: { side: "left" | "right"; label: string; onOpen: () => void }) {
  const Icon = side === "left" ? PanelLeftOpen : PanelRightOpen;

  return (
    <div className={side === "left" ? "absolute left-2 top-3 z-30" : "absolute right-2 top-3 z-30"}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="size-8 bg-card/95 text-icon backdrop-blur hover:text-icon"
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
