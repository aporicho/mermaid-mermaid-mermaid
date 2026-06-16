"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CodeBracketsSquare as FileCode2,
  ColorWheel,
  DotsGrid3x3 as Grid3X3,
  Expand as Maximize2,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  GitBranch as Workflow,
  MoreHoriz,
  PathArrow,
  PositionAlign,
  Plus,
  Refresh as RefreshCw,
  SidebarCollapse as PanelRightClose,
  SidebarExpand as PanelLeftOpen,
  SidebarExpand as PanelRightOpen,
  SquareCursor as SquareDashedMousePointer
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
import { applyLayout, edgeRoutingFromLayout, layoutFromGraph, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { deriveLayoutFromMermaidRender } from "@/features/mermaid-editor/lib/mermaid-auto-layout";
import {
  addNode as addNodeAction,
  addNodeAt,
  copySelection,
  deleteSelection,
  emptySelection,
  hasSelection,
  pasteClipboard,
  setMode as setEditorMode
} from "@/features/mermaid-editor/lib/editor-actions";
import { createHistory, pushHistory, redo, undo } from "@/features/mermaid-editor/lib/editor-history";
import { hasBlockingDiagnostics, normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type {
  ClipboardPayload,
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorHistory,
  EditorMode,
  EditorSnapshot,
  GraphDirection,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasLayout } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING } from "@/features/mermaid-editor/lib/editor-types";
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
import { initialMermaidSource, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

const STORAGE_KEY = "mermaid-canvas-editor:v1";

const KonvaCanvas = dynamic(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => mod.KonvaCanvas), {
  ssr: false,
  loading: () => <div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>
});

const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];
const edgeRoutingOptions: { value: EdgeRouting; label: string }[] = [
  { value: "straight", label: "直线" },
  { value: "bezier", label: "曲线" }
];
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
  viewport: ViewportState;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView?: WorkspaceView;
  showGrid?: boolean;
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
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true,
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
    const themeId = normalizeThemeId(stored.themeId);
    const customTheme = stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null;

    return {
      source,
      graph,
      diagramType: loaded.diagramType,
      editableKind: loaded.editableKind,
      viewport,
      edgeRouting,
      leftCollapsed: stored.leftCollapsed || false,
      rightCollapsed: stored.rightCollapsed || false,
      workspaceView: loaded.editableKind === "flowchart" ? stored.workspaceView || "canvas" : "render",
      showGrid: stored.showGrid ?? true,
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
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true,
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
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

export function MermaidEditor() {
  const initial = useMemo(loadInitialState, []);
  const [source, setSource] = useState(initial.source);
  const [graph, setGraph] = useState<MermaidGraph>(initial.graph);
  const [diagramType, setDiagramType] = useState<DiagramType>(initial.diagramType);
  const [editableKind, setEditableKind] = useState<EditableKind>(initial.editableKind);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initial.edgeRouting);
  const [mode, setMode] = useState<EditorMode>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [history, setHistory] = useState<EditorHistory>(() => createHistory());
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [status, setStatus] = useState("");
  const [diagnostics, setDiagnostics] = useState<EditorDiagnostic[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initial.workspaceView);
  const [showGrid, setShowGrid] = useState(initial.showGrid);
  const [fileName, setFileName] = useState(initial.fileName);
  const [fileHandle, setFileHandle] = useState<MermaidFileHandle | null>(null);
  const [lastSavedDocument, setLastSavedDocument] = useState("");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [themeId, setThemeId] = useState<EditorThemeId>(initial.themeId);
  const [customTheme, setCustomTheme] = useState<EditorTheme | null>(initial.customTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);
  const themeEditBaseRef = useRef<{ themeId: EditorThemeId; customTheme: EditorTheme | null } | null>(null);

  const currentDocument = useMemo(() => buildMermaidDocument(source, graph, viewport, edgeRouting), [source, graph, viewport, edgeRouting]);
  const activeTheme = useMemo(() => resolveEditorTheme(themeId, customTheme), [customTheme, themeId]);
  const canvasVisualTokens = useMemo(() => themeToCanvasVisualTokens(activeTheme), [activeTheme]);
  const mermaidThemeVariables = useMemo(() => themeToMermaidThemeVariables(activeTheme), [activeTheme]);
  const isDirty = !lastSavedDocument || currentDocument !== lastSavedDocument;
  const fileLabel = `${fileName || FALLBACK_FILE_NAME}${isDirty ? " *" : ""}`;
  const isCanvasEditable = editableKind === "flowchart";
  const canvasViewTooltip = isCanvasEditable ? "无限画布" : `${diagramTypeLabel(diagramType)} 仅支持渲染`;

  function snapshot(): EditorSnapshot {
    return { source, graph, selection, viewport, edgeRouting };
  }

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
    const nextSource = serializeMermaid(nextGraph);
    setGraph(nextGraph);
    setSource(nextSource);
    setSelection(nextSelection);
    setDiagnostics([]);
    setStatus(message);
  }

  function draftGraph(nextGraph: MermaidGraph) {
    if (!isCanvasEditable) return;
    setGraph(nextGraph);
    setSource(serializeMermaid(nextGraph));
    setDiagnostics([]);
  }

  function captureHistory() {
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
  }

  function applySource(nextSource: string) {
    if (!sourceEditBaseRef.current) sourceEditBaseRef.current = snapshot();
    const loaded = loadMermaidDocument(nextSource, graph);
    setSource(loaded.source);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setGraph(loaded.graph);
    setSelection(emptySelection);
    setDiagnostics([]);
    setStatus(loaded.editableKind === "flowchart" ? "源码已解析到画布。" : "当前 Mermaid 类型已切换到渲染视图。");

    if (loaded.editableKind !== "flowchart") setWorkspaceView("render");
    setEdgeRouting(loaded.edgeRouting);
    if (loaded.viewport) setViewport(loaded.viewport);
    if (sourceEditTimerRef.current) window.clearTimeout(sourceEditTimerRef.current);
    sourceEditTimerRef.current = window.setTimeout(() => {
      flushSourceHistory();
    }, 700);
  }

  function addNode() {
    if (!isCanvasEditable) return;
    const result = addNodeAction(graph, viewport);
    commitGraph(result.graph, result.selection, "已新增节点。");
  }

  function addNodeAtPoint(point: { x: number; y: number }) {
    if (!isCanvasEditable) return;
    const result = addNodeAt(graph, point.x, point.y);
    commitGraph(result.graph, result.selection, "已在画布中新增节点。");
  }

  function updateDirection(direction: GraphDirection) {
    if (!isCanvasEditable) return;
    commitGraph({ ...graph, direction }, selection, `方向已切换为 ${direction}。`);
  }

  function updateEdgeRouting(nextEdgeRouting: EdgeRouting) {
    if (!isCanvasEditable) return;
    if (nextEdgeRouting === edgeRouting) return;
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
    setEdgeRouting(nextEdgeRouting);
    setStatus(`连线形状已切换为${edgeRoutingLabel(nextEdgeRouting)}。`);
  }

  function refreshFromSource() {
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
      return;
    }

    setSource(serializeMermaid(loaded.graph));
    setStatus("已从 Mermaid 源码刷新画布。");
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

      const layout = await deriveLayoutFromMermaidRender(loaded.source, loaded.graph, {
        edgeRouting,
        mermaidThemeVariables
      });
      const nextGraph = applyLayout(loaded.graph, layout);
      const nextSource = serializeMermaid(nextGraph);

      setHistory((current) => pushHistory(current, previousSnapshot));
      setSource(nextSource);
      setGraph(nextGraph);
      setDiagramType(loaded.diagramType);
      setEditableKind(loaded.editableKind);
      setSelection(emptySelection);
      setViewport(layout.viewport);
      setEdgeRouting(layout.edgeRouting || edgeRouting);
      setWorkspaceView("canvas");
      setDiagnostics([]);
      setStatus("已从 Mermaid 自动布局同步到无限画布。");
    } catch (error) {
      setDiagnostics([normalizeMermaidError(error, source, "mermaid-render")]);
      setWorkspaceView("render");
      setStatus("自动布局同步失败，请先修复 Mermaid 语法。");
    }
  }

  function performDelete() {
    if (!hasSelection(selection)) return;
    commitGraph(deleteSelection(graph, selection), emptySelection, "已删除选中项。");
  }

  function performUndo() {
    flushSourceHistory();
    const result = undo(history, snapshot());
    if (!result.snapshot) return;
    setHistory(result.history);
    restoreSnapshot(result.snapshot);
    setStatus("已撤销。");
  }

  function performRedo() {
    flushSourceHistory();
    const result = redo(history, snapshot());
    if (!result.snapshot) return;
    setHistory(result.history);
    restoreSnapshot(result.snapshot);
    setStatus("已重做。");
  }

  function performCopy() {
    if (!selection.nodeIds.length) return;
    setClipboard(copySelection(graph, selection));
    setStatus("已复制选中节点。");
  }

  function performPaste() {
    if (!clipboard) return;
    const result = pasteClipboard(graph, clipboard);
    commitGraph(result.graph, result.selection, "已粘贴节点。");
  }

  function updateViewport(nextViewport: ViewportState) {
    setViewport(nextViewport);
  }

  function toggleGrid() {
    setShowGrid((current) => {
      const next = !current;
      setStatus(next ? "已显示画布网格。" : "已隐藏画布网格。");
      return next;
    });
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
    const savedDocument = buildMermaidDocument(loaded.source, loaded.graph, nextViewport, loaded.edgeRouting);

    setSource(loaded.source);
    setGraph(loaded.graph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setViewport(nextViewport);
    setEdgeRouting(loaded.edgeRouting);
    setWorkspaceView(loaded.editableKind === "flowchart" ? "canvas" : "render");
    setSelection(emptySelection);
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(ensureMermaidFileName(name));
    setFileHandle(handle);
    setLastSavedDocument(savedDocument);
    setStatus(loaded.editableKind === "flowchart" ? `已打开 ${name}。` : `已打开 ${name}，当前类型仅渲染。`);
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
    } catch (error) {
      if (!isAbortError(error)) setStatus("保存文件失败。");
    }
  }

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!secondaryActionsOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSecondaryActionsOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [secondaryActionsOpen]);

  useEffect(() => {
    applyEditorThemeToDocument(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        source,
        layout: layoutFromGraph(graph, viewport, edgeRouting),
        viewport,
        edgeRouting,
        leftCollapsed,
        rightCollapsed,
        workspaceView,
        showGrid,
        fileName,
        themeId,
        customTheme
      } satisfies StoredEditor)
    );
  }, [source, graph, viewport, edgeRouting, leftCollapsed, rightCollapsed, workspaceView, showGrid, fileName, themeId, customTheme]);

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
      if (key === "v") setMode(setEditorMode("select"));
      if (key === "l") setMode(setEditorMode("connect"));
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
            {isCanvasEditable ? <ToolModeBar mode={mode} onModeChange={setMode} /> : null}
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
            <SecondaryActionsMenu
              open={secondaryActionsOpen}
              direction={graph.direction}
              edgeRouting={edgeRouting}
              editable={isCanvasEditable}
              showGrid={showGrid}
              onOpenChange={setSecondaryActionsOpen}
              onAddNode={addNode}
              onSaveAs={() => void saveMermaidFileAs()}
              onDirectionChange={updateDirection}
              onEdgeRoutingChange={updateEdgeRouting}
              onToggleGrid={toggleGrid}
              onRefreshSource={refreshFromSource}
              onSyncAutoLayout={() => void syncCanvasFromAutoLayout()}
              onResetView={() => updateViewport({ x: 160, y: 90, scale: 1 })}
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
                showGrid={showGrid}
                edgeRouting={edgeRouting}
                visualTokens={canvasVisualTokens}
                onGraphDraft={draftGraph}
                onGraphCommit={commitGraph}
                onCaptureHistory={captureHistory}
                onSelectionChange={setSelection}
                onViewportChange={updateViewport}
                onAddNodeAt={addNodeAtPoint}
              />
            ) : (
              <PreviewPanel
                source={source}
                graph={isCanvasEditable ? graph : undefined}
                framed={false}
                diagnostics={diagnostics}
                mermaidThemeVariables={mermaidThemeVariables}
                onGraphChange={isCanvasEditable ? commitGraph : undefined}
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
                <InspectorPanel graph={graph} selection={selection} onGraphChange={commitGraph} onSelectionChange={setSelection} onDelete={performDelete} />
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

function SecondaryActionsMenu({
  open,
  direction,
  edgeRouting,
  editable,
  showGrid,
  onOpenChange,
  onAddNode,
  onSaveAs,
  onDirectionChange,
  onEdgeRoutingChange,
  onToggleGrid,
  onRefreshSource,
  onSyncAutoLayout,
  onResetView,
  onOpenThemeSettings
}: {
  open: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  editable: boolean;
  showGrid: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: () => void;
  onSaveAs: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onToggleGrid: () => void;
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
            <Separator className="my-1" />
            <Button
              variant="ghost"
              className="h-8 justify-start px-2 text-foreground disabled:opacity-40 [&_svg]:text-icon"
              onClick={() => runAndClose(onToggleGrid)}
              disabled={!editable}
            >
              <Grid3X3 className="size-4" />
              {showGrid ? "隐藏网格" : "显示网格"}
            </Button>
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
              同步自动布局
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
