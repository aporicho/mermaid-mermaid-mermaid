"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CodeBracketsSquare as FileCode2,
  DotsGrid3x3 as Grid3X3,
  Expand as Maximize2,
  FloppyDisk,
  FloppyDiskArrowOut,
  Folder,
  GitBranch as Workflow,
  MoreHoriz,
  PathArrow,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { applyLayout, edgeRoutingFromLayout, layoutFromGraph, parseCanvasLayout, stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
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
import type { ClipboardPayload, EdgeRouting, EditorHistory, EditorMode, EditorSnapshot, GraphDirection, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasLayout } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING } from "@/features/mermaid-editor/lib/editor-types";
import { initialMermaidSource, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

const STORAGE_KEY = "mermaid-canvas-editor:v1";

const KonvaCanvas = dynamic(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => mod.KonvaCanvas), {
  ssr: false,
  loading: () => <div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>
});

const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];
const edgeRoutingOptions: { value: EdgeRouting; label: string }[] = [
  { value: "smooth-step", label: "圆角折线" },
  { value: "straight", label: "直线" },
  { value: "bezier", label: "曲线" },
  { value: "orthogonal", label: "正交折线" }
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

  if (typeof window === "undefined") {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true,
      fileName: FALLBACK_FILE_NAME
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("No saved editor state");
    const stored = JSON.parse(raw) as StoredEditor;
    const legacyLayout = parseCanvasLayout(stored.source);
    const source = stripCanvasLayout(stored.source);
    const layout = stored.layout || legacyLayout;
    const parsedGraph = parseMermaid(source);
    const graph = applyLayout(parsedGraph, layout);
    const viewport = stored.viewport || layout?.viewport || fallbackViewport;
    const edgeRouting = stored.edgeRouting || edgeRoutingFromLayout(layout);

    return {
      source,
      graph,
      viewport,
      edgeRouting,
      leftCollapsed: stored.leftCollapsed || false,
      rightCollapsed: stored.rightCollapsed || false,
      workspaceView: stored.workspaceView || "canvas",
      showGrid: stored.showGrid ?? true,
      fileName: stored.fileName || FALLBACK_FILE_NAME
    };
  } catch {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true,
      fileName: FALLBACK_FILE_NAME
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
  return edgeRoutingOptions.find((option) => option.value === edgeRouting)?.label || "圆角折线";
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
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [edgeRouting, setEdgeRouting] = useState<EdgeRouting>(initial.edgeRouting);
  const [mode, setMode] = useState<EditorMode>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [history, setHistory] = useState<EditorHistory>(() => createHistory());
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [status, setStatus] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initial.workspaceView);
  const [showGrid, setShowGrid] = useState(initial.showGrid);
  const [fileName, setFileName] = useState(initial.fileName);
  const [fileHandle, setFileHandle] = useState<MermaidFileHandle | null>(null);
  const [lastSavedDocument, setLastSavedDocument] = useState("");
  const [secondaryActionsOpen, setSecondaryActionsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);

  const effectiveMode = spacePanning ? "pan" : mode;
  const currentDocument = useMemo(() => buildMermaidDocument(source, graph, viewport, edgeRouting), [source, graph, viewport, edgeRouting]);
  const isDirty = !lastSavedDocument || currentDocument !== lastSavedDocument;
  const fileLabel = `${fileName || FALLBACK_FILE_NAME}${isDirty ? " *" : ""}`;

  function snapshot(): EditorSnapshot {
    return { source, graph, selection, viewport, edgeRouting };
  }

  function restoreSnapshot(next: EditorSnapshot) {
    setSource(next.source);
    setGraph(next.graph);
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
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
    const nextSource = serializeMermaid(nextGraph);
    setGraph(nextGraph);
    setSource(nextSource);
    setSelection(nextSelection);
    setStatus(message);
  }

  function draftGraph(nextGraph: MermaidGraph) {
    setGraph(nextGraph);
    setSource(serializeMermaid(nextGraph));
  }

  function captureHistory() {
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
  }

  function applySource(nextSource: string) {
    if (!sourceEditBaseRef.current) sourceEditBaseRef.current = snapshot();
    const legacyLayout = parseCanvasLayout(nextSource);
    const pureSource = stripCanvasLayout(nextSource);
    const parsedGraph = parseMermaid(pureSource, graph);
    setSource(pureSource);
    setGraph(applyLayout(parsedGraph, legacyLayout));
    setSelection(emptySelection);
    setStatus("源码已解析到画布。");

    if (legacyLayout) setEdgeRouting(edgeRoutingFromLayout(legacyLayout));
    if (legacyLayout?.viewport) setViewport(legacyLayout.viewport);
    if (sourceEditTimerRef.current) window.clearTimeout(sourceEditTimerRef.current);
    sourceEditTimerRef.current = window.setTimeout(() => {
      flushSourceHistory();
    }, 700);
  }

  function addNode() {
    const result = addNodeAction(graph, viewport);
    commitGraph(result.graph, result.selection, "已新增节点。");
  }

  function addNodeAtPoint(point: { x: number; y: number }) {
    const result = addNodeAt(graph, point.x, point.y);
    commitGraph(result.graph, result.selection, "已在画布中新增节点。");
  }

  function updateDirection(direction: GraphDirection) {
    commitGraph({ ...graph, direction }, selection, `方向已切换为 ${direction}。`);
  }

  function updateEdgeRouting(nextEdgeRouting: EdgeRouting) {
    if (nextEdgeRouting === edgeRouting) return;
    flushSourceHistory();
    setHistory((current) => pushHistory(current, snapshot()));
    setEdgeRouting(nextEdgeRouting);
    setStatus(`连线形状已切换为${edgeRoutingLabel(nextEdgeRouting)}。`);
  }

  function refreshFromSource() {
    flushSourceHistory();
    const pureSource = stripCanvasLayout(source);
    const parsedGraph = parseMermaid(pureSource, graph);
    setHistory((current) => pushHistory(current, snapshot()));
    setGraph(parsedGraph);
    setSource(serializeMermaid(parsedGraph));
    setSelection(emptySelection);
    setStatus("已从 Mermaid 源码刷新画布。");
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
    setViewport(nextViewport);
    setEdgeRouting(loaded.edgeRouting);
    setSelection(emptySelection);
    setHistory(createHistory());
    setFileName(ensureMermaidFileName(name));
    setFileHandle(handle);
    setLastSavedDocument(savedDocument);
    setStatus(`已打开 ${name}。`);
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
        fileName
      } satisfies StoredEditor)
    );
  }, [source, graph, viewport, edgeRouting, leftCollapsed, rightCollapsed, workspaceView, showGrid, fileName]);

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isTextInput(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        setSpacePanning(true);
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
      if (key === "h") setMode(setEditorMode("pan"));
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
        <header className="relative z-40 grid grid-cols-[minmax(220px,360px)_minmax(0,1fr)_auto] items-center gap-3 border-b bg-card/95 px-3 shadow-sm backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="sr-only">Mermaid Canvas Editor</h1>
              <p className="truncate text-sm font-medium">{fileLabel}</p>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={openMermaidFile} aria-label="打开 Mermaid 文件">
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
                    className={isDirty ? "size-8 text-primary-foreground" : "size-8 text-muted-foreground hover:text-foreground"}
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
            <ToolModeBar
              mode={mode}
              onModeChange={setMode}
            />
          </div>

          <div className="flex items-center gap-1">
            <div className="flex gap-0.5 rounded-md border bg-background p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "canvas" ? "default" : "ghost"}
                    className={workspaceView === "canvas" ? "size-8 text-primary-foreground" : "size-8 text-muted-foreground hover:text-foreground"}
                    onClick={() => setWorkspaceView("canvas")}
                    aria-label="切换到无限画布"
                  >
                    <SquareDashedMousePointer className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">无限画布</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "render" ? "default" : "ghost"}
                    className={workspaceView === "render" ? "size-8 text-primary-foreground" : "size-8 text-muted-foreground hover:text-foreground"}
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
              showGrid={showGrid}
              onOpenChange={setSecondaryActionsOpen}
              onAddNode={addNode}
              onSaveAs={() => void saveMermaidFileAs()}
              onDirectionChange={updateDirection}
              onEdgeRoutingChange={updateEdgeRouting}
              onToggleGrid={toggleGrid}
              onRefreshSource={refreshFromSource}
              onResetView={() => updateViewport({ x: 160, y: 90, scale: 1 })}
            />
          </div>
        </header>

        <div className="relative z-0 min-h-0 overflow-hidden">
          <div className="absolute inset-0 z-0">
            {workspaceView === "canvas" ? (
              <KonvaCanvas
                graph={graph}
                selection={selection}
                viewport={viewport}
                mode={effectiveMode}
                showGrid={showGrid}
                edgeRouting={edgeRouting}
                onGraphDraft={draftGraph}
                onGraphCommit={commitGraph}
                onCaptureHistory={captureHistory}
                onSelectionChange={setSelection}
                onViewportChange={updateViewport}
                onAddNodeAt={addNodeAtPoint}
              />
            ) : (
              <PreviewPanel source={source} graph={graph} edgeRouting={edgeRouting} framed={false} onGraphChange={commitGraph} />
            )}
          </div>
          {!leftCollapsed ? (
            <div className="absolute inset-y-0 left-0 z-20 w-[clamp(300px,31vw,420px)] shadow-xl">
              <SourcePanel value={source} onChange={applySource} onRun={refreshFromSource} onCollapse={() => setLeftCollapsed(true)} />
            </div>
          ) : null}
          {!rightCollapsed ? (
            <aside className="absolute inset-y-0 right-0 z-20 grid w-[clamp(280px,28vw,380px)] min-h-0 border-l bg-card shadow-xl">
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
          <div className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            {status}
          </div>
        ) : null}
      </main>
    </TooltipProvider>
  );
}

function SecondaryActionsMenu({
  open,
  direction,
  edgeRouting,
  showGrid,
  onOpenChange,
  onAddNode,
  onSaveAs,
  onDirectionChange,
  onEdgeRoutingChange,
  onToggleGrid,
  onRefreshSource,
  onResetView
}: {
  open: boolean;
  direction: GraphDirection;
  edgeRouting: EdgeRouting;
  showGrid: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: () => void;
  onSaveAs: () => void;
  onDirectionChange: (direction: GraphDirection) => void;
  onEdgeRoutingChange: (edgeRouting: EdgeRouting) => void;
  onToggleGrid: () => void;
  onRefreshSource: () => void;
  onResetView: () => void;
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
            className="size-8 text-muted-foreground hover:text-foreground"
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
        <div className="absolute right-0 top-10 z-50 w-52 rounded-md border bg-popover p-1.5 text-popover-foreground shadow-lg">
          <div className="grid gap-0.5">
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-muted-foreground" onClick={() => runAndClose(onAddNode)}>
              <Plus className="size-4" />
              新增节点
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-muted-foreground" onClick={() => runAndClose(onSaveAs)}>
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
                <PathArrow className="size-3.5" />
                连线形状
              </span>
              <Select
                value={edgeRouting}
                onValueChange={(value) => {
                  onEdgeRoutingChange(value as EdgeRouting);
                  onOpenChange(false);
                }}
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
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-muted-foreground" onClick={() => runAndClose(onToggleGrid)}>
              <Grid3X3 className="size-4" />
              {showGrid ? "隐藏网格" : "显示网格"}
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-muted-foreground" onClick={() => runAndClose(onRefreshSource)}>
              <RefreshCw className="size-4" />
              从源码刷新
            </Button>
            <Button variant="ghost" className="h-8 justify-start px-2 text-foreground [&_svg]:text-muted-foreground" onClick={() => runAndClose(onResetView)}>
              <Maximize2 className="size-4" />
              重置画布视图
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PanelHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="absolute right-2 top-2 z-30">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8 bg-card/95 text-muted-foreground hover:text-foreground" onClick={onCollapse} aria-label="收起右侧面板">
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
            className="size-8 bg-card/95 text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
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
