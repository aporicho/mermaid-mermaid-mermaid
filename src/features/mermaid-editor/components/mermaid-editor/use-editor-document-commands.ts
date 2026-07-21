import { useCallback, type Dispatch, type SetStateAction } from "react";

import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import {
  createBlankCanvasDocument,
  normalizeCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { copySelection, emptySelection } from "@/features/mermaid-editor/lib/editor-actions";
import { normalizeMermaidError, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { pushHistory, redo, undo } from "@/features/mermaid-editor/lib/editor-history";
import { measurePerformance } from "@/features/mermaid-editor/lib/editor-performance";
import {
  createEmptyDocumentGraph
} from "@/features/mermaid-editor/lib/editor-state";
import type {
  ClipboardPayload,
  DiagramType,
  EdgeRouting,
  EditableKind,
  EditorHistory,
  EditorMode,
  EditorSnapshot,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { applyEditorCommandTransaction } from "@/features/mermaid-editor/lib/interaction/transaction";
import { loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorDocumentCommandsArgs = {
  documentKind: DocumentKind;
  source: string;
  graph: MermaidGraph;
  history: EditorHistory;
  selection: Selection;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  workspaceView: WorkspaceView;
  viewFilters: ViewFilters;
  isCanvasEditable: boolean;
  nodeGeometrySpec: NodeGeometrySpec;
  sourceEditBaseRef: { current: EditorSnapshot | null };
  sourceEditTimerRef: { current: number | null };
  setDocumentKind: StateSetter<DocumentKind>;
  setSource: StateSetter<string>;
  setCanvasDocument: StateSetter<CanvasDocument>;
  setGraph: StateSetter<MermaidGraph>;
  setDiagramType: StateSetter<DiagramType>;
  setEditableKind: StateSetter<EditableKind>;
  setMode: StateSetter<EditorMode>;
  setClipboard: StateSetter<ClipboardPayload | null>;
  setHistory: StateSetter<EditorHistory>;
  setSelection: StateSetter<Selection>;
  setViewport: StateSetter<ViewportState>;
  setEdgeRouting: StateSetter<EdgeRouting>;
  setLayoutMode: StateSetter<LayoutMode>;
  setWorkspaceView: StateSetter<WorkspaceView>;
  setViewFilters: StateSetter<ViewFilters>;
  setDiagnostics: StateSetter<EditorDiagnostic[]>;
  setStatus: StateSetter<string>;
  recordRecentAction: (type: string, target?: AiRecentAction["target"], summary?: string) => void;
};

export function useEditorDocumentCommands({
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
  isCanvasEditable,
  nodeGeometrySpec,
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
  setDiagnostics,
  setStatus,
  recordRecentAction
}: UseEditorDocumentCommandsArgs) {
  function updateSelection(nextSelection: Selection) {
    const changed = selectionKey(selection) !== selectionKey(nextSelection);
    setSelection(nextSelection);
    if (changed) {
      recordRecentAction("selection.change", targetFromSelection(nextSelection), "用户更新了当前选中内容。");
    }
  }

  function switchToRenderUnlessSource() {
    setWorkspaceView((current) => (current === "source" ? current : "render"));
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
        const nextGraph = measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(graph, { spec: nodeGeometrySpec }), {
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

      const nextGraph = layoutMode === "auto" ? applyDagreAutoLayout(loaded.graph, { spec: nodeGeometrySpec }) : loaded.graph;
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
    return measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(nextGraph, { spec: nodeGeometrySpec }), {
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
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph, { spec: nodeGeometrySpec }) : loaded.graph;
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

      const nextGraph = measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(loaded.graph, { spec: nodeGeometrySpec }), {
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

  return {
    applyEditorCommand,
    applySource,
    applyMarkdownSource,
    applyCanvasDocument,
    flushSourceHistory,
    snapshot
  };
}

function edgeRoutingLabel(edgeRouting: EdgeRouting) {
  const labels: Record<EdgeRouting, string> = {
    straight: "直线",
    bezier: "曲线",
    orthogonal: "圆角折线",
    mermaid: "Mermaid 曲线"
  };

  return labels[edgeRouting];
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
