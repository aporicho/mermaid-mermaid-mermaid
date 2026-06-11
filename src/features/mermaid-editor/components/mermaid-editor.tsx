"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CodeBracketsSquare as FileCode2,
  DotsGrid3x3 as Grid3X3,
  Expand as Maximize2,
  GitBranch as Workflow,
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
import { applyLayout, layoutFromGraph, parseCanvasLayout, stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
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
import type { ClipboardPayload, EditorHistory, EditorMode, EditorSnapshot, GraphDirection, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { CanvasLayout } from "@/features/mermaid-editor/lib/editor-types";
import { initialMermaidSource, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

const STORAGE_KEY = "mermaid-canvas-editor:v1";

const KonvaCanvas = dynamic(() => import("@/features/mermaid-editor/components/konva-canvas").then((mod) => mod.KonvaCanvas), {
  ssr: false,
  loading: () => <div className="grid min-h-0 place-items-center bg-card text-sm text-muted-foreground">正在载入画布</div>
});

const directions: GraphDirection[] = ["LR", "TD", "TB", "RL", "BT"];
type WorkspaceView = "canvas" | "render";

type StoredEditor = {
  source: string;
  layout?: CanvasLayout;
  viewport: ViewportState;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView?: WorkspaceView;
  showGrid?: boolean;
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
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true
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

    return {
      source,
      graph,
      viewport,
      leftCollapsed: stored.leftCollapsed || false,
      rightCollapsed: stored.rightCollapsed || false,
      workspaceView: stored.workspaceView || "canvas",
      showGrid: stored.showGrid ?? true
    };
  } catch {
    return {
      source: fallbackSource,
      graph: fallbackGraph,
      viewport: fallbackViewport,
      leftCollapsed: false,
      rightCollapsed: false,
      workspaceView: "canvas" as WorkspaceView,
      showGrid: true
    };
  }
}

export function MermaidEditor() {
  const initial = useMemo(loadInitialState, []);
  const [source, setSource] = useState(initial.source);
  const [graph, setGraph] = useState<MermaidGraph>(initial.graph);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [viewport, setViewport] = useState<ViewportState>(initial.viewport);
  const [mode, setMode] = useState<EditorMode>("select");
  const [spacePanning, setSpacePanning] = useState(false);
  const [history, setHistory] = useState<EditorHistory>(() => createHistory());
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null);
  const [status, setStatus] = useState("拖拽节点，滚轮缩放，Space 临时平移画布。");
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed);
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(initial.workspaceView);
  const [showGrid, setShowGrid] = useState(initial.showGrid);
  const sourceEditBaseRef = useRef<EditorSnapshot | null>(null);
  const sourceEditTimerRef = useRef<number | null>(null);

  const effectiveMode = spacePanning ? "pan" : mode;
  const selectedCount = selection.nodeIds.length + selection.edgeIds.length;
  const graphSummary = useMemo(() => `${graph.nodes.length} nodes, ${graph.edges.length} edges`, [graph.nodes.length, graph.edges.length]);

  function snapshot(): EditorSnapshot {
    return { source, graph, selection, viewport };
  }

  function restoreSnapshot(next: EditorSnapshot) {
    setSource(next.source);
    setGraph(next.graph);
    setSelection(next.selection);
    setViewport(next.viewport);
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

  function draftGraph(nextGraph: MermaidGraph, message = "正在整理画布。") {
    setGraph(nextGraph);
    setSource(serializeMermaid(nextGraph));
    setStatus(message);
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

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        source,
        layout: layoutFromGraph(graph, viewport),
        viewport,
        leftCollapsed,
        rightCollapsed,
        workspaceView,
        showGrid
      } satisfies StoredEditor)
    );
  }, [source, graph, viewport, leftCollapsed, rightCollapsed, workspaceView, showGrid]);

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
      <main className="grid h-screen grid-rows-[56px_minmax(0,1fr)]">
        <header className="grid grid-cols-[minmax(220px,300px)_minmax(0,1fr)_auto] items-center gap-3 border-b bg-card/95 px-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <FileCode2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="sr-only">Mermaid Canvas Editor</h1>
              <p className="truncate text-xs text-muted-foreground">{graphSummary}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-center">
            <ToolModeBar
              mode={mode}
              scale={viewport.scale}
              selectedCount={selectedCount}
              canUndo={history.undoStack.length > 0}
              canRedo={history.redoStack.length > 0}
              onModeChange={setMode}
              onUndo={performUndo}
              onRedo={performRedo}
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={graph.direction} onValueChange={(value) => updateDirection(value as GraphDirection)}>
              <SelectTrigger className="h-9 w-[86px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {directions.map((direction) => (
                  <SelectItem key={direction} value={direction}>
                    {direction}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="h-7" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={showGrid ? "default" : "outline"}
                  onClick={toggleGrid}
                  aria-label={showGrid ? "隐藏画布网格" : "显示画布网格"}
                  aria-pressed={showGrid}
                >
                  <Grid3X3 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showGrid ? "隐藏画布网格" : "显示画布网格"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" onClick={refreshFromSource} aria-label="从源码刷新画布">
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>从源码刷新画布</TooltipContent>
            </Tooltip>
            <div className="flex rounded-md border bg-background p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "canvas" ? "default" : "ghost"}
                    className="size-8"
                    onClick={() => setWorkspaceView("canvas")}
                    aria-label="切换到无限画布"
                  >
                    <SquareDashedMousePointer className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>无限画布</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={workspaceView === "render" ? "default" : "ghost"}
                    className="size-8"
                    onClick={() => setWorkspaceView("render")}
                    aria-label="切换到渲染视图"
                  >
                    <Workflow className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>渲染视图</TooltipContent>
              </Tooltip>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" onClick={() => updateViewport({ x: 160, y: 90, scale: 1 })} aria-label="重置视图">
                  <Maximize2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重置视图</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" onClick={addNode} aria-label="新增节点">
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>新增节点</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div
          className="grid min-h-0"
          style={{
            gridTemplateColumns: `${leftCollapsed ? "44px" : "minmax(280px,31vw)"} minmax(420px,1fr) ${
              rightCollapsed ? "44px" : "minmax(300px,30vw)"
            }`
          }}
        >
          {leftCollapsed ? (
            <CollapsedRail side="left" label="Mermaid" onOpen={() => setLeftCollapsed(false)} />
          ) : (
            <SourcePanel value={source} onChange={applySource} onRun={refreshFromSource} onCollapse={() => setLeftCollapsed(true)} />
          )}
          {workspaceView === "canvas" ? (
            <KonvaCanvas
              graph={graph}
              selection={selection}
              viewport={viewport}
              mode={effectiveMode}
              showGrid={showGrid}
              onGraphDraft={draftGraph}
              onGraphCommit={commitGraph}
              onCaptureHistory={captureHistory}
              onSelectionChange={setSelection}
              onViewportChange={updateViewport}
              onAddNodeAt={addNodeAtPoint}
            />
          ) : (
            <PreviewPanel source={source} graph={graph} framed={false} onGraphChange={commitGraph} />
          )}
          {rightCollapsed ? (
            <CollapsedRail side="right" label="侧栏" onOpen={() => setRightCollapsed(false)} />
          ) : (
            <aside className="relative grid min-h-0 border-l bg-card">
              <PanelHeader onCollapse={() => setRightCollapsed(true)} />
              <div className="grid min-h-0">
                <InspectorPanel graph={graph} selection={selection} onGraphChange={commitGraph} onSelectionChange={setSelection} onDelete={performDelete} />
              </div>
            </aside>
          )}
        </div>
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          {status}
        </div>
      </main>
    </TooltipProvider>
  );
}

function PanelHeader({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="absolute right-2 top-2 z-10">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="outline" className="size-8 bg-card" onClick={onCollapse} aria-label="收起右侧面板">
            <PanelRightClose className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>收起右侧面板</TooltipContent>
      </Tooltip>
    </div>
  );
}

function CollapsedRail({ side, label, onOpen }: { side: "left" | "right"; label: string; onOpen: () => void }) {
  const Icon = side === "left" ? PanelLeftOpen : PanelRightOpen;

  return (
    <section className={side === "left" ? "grid border-r bg-card" : "grid border-l bg-card"}>
      <div className="flex flex-col items-center gap-3 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" onClick={onOpen} aria-label={`展开${label}面板`}>
              <Icon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{`展开${label}面板`}</TooltipContent>
        </Tooltip>
        <span className="rotate-180 [writing-mode:vertical-rl] text-xs font-medium text-muted-foreground">{label}</span>
      </div>
    </section>
  );
}
