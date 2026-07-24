import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { scaleLocalRectFromCenter } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { InlineEdit, InlineEditStyle } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { CanvasPoint, InlineEditCommandTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasProximityScales } from "@/features/mermaid-editor/lib/canvas-motion";
import type { EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import { buildEdgeLabelGeometry, type EdgeLabelGeometrySpec } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasEdge, EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import {
  applyTableTsv,
  navigateTableCell,
  updateTableCell,
  updateTableHeader,
  type TableCellNavigation,
  type TableCellSelection,
  type TableHeaderSelection
} from "@/features/mermaid-editor/lib/table-node";

type UseKonvaInlineEditSessionArgs = {
  graph: MermaidGraph;
  selection: Selection;
  interactionState: InteractionState;
  mode: EditorMode;
  setInteractionState: Dispatch<SetStateAction<InteractionState>>;
  invalidateBlankClickIntent: () => void;
  resetInteraction: () => void;
  onEditorCommand: (command: EditorCommand) => void;
  selectedTableCell: TableCellSelection | null;
  setSelectedTableCell: Dispatch<SetStateAction<TableCellSelection | null>>;
};

export function useKonvaInlineEditSession({
  graph,
  selection,
  interactionState,
  mode,
  setInteractionState,
  invalidateBlankClickIntent,
  resetInteraction,
  onEditorCommand,
  selectedTableCell,
  setSelectedTableCell
}: UseKonvaInlineEditSessionArgs) {
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
  const nodeEditorRef = useRef<HTMLTextAreaElement>(null);
  const nodeEditorMeasureRef = useRef<HTMLDivElement>(null);

  function startInlineEdit(target: InlineEditCommandTarget) {
    if (target.type === "node") {
      const node = graph.nodes.find((item) => item.id === target.id);
      if (!node) return;
      if (resolveCanvasNodeKind(node) === "table") {
        if (node.content?.kind !== "table") return;
        const targetCell = selectedTableCell?.nodeId === node.id
          ? selectedTableCell
          : node.content.rows[0] && node.content.columns[0]
            ? { nodeId: node.id, rowId: node.content.rows[0].id, columnId: node.content.columns[0].id }
            : null;
        if (targetCell) startTableCellEdit(targetCell);
        return;
      }
      setInteractionState({ kind: "editingNodeText", nodeId: node.id });
      setInlineEdit({ type: "node", id: node.id, value: node.label });
      return;
    }

    if (target.type === "subgraph") {
      const subgraph = graph.subgraphs?.find((item) => item.id === target.id);
      if (!subgraph) return;
      setInteractionState({ kind: "editingSubgraphTitle", subgraphId: subgraph.id });
      setInlineEdit({ type: "subgraph", id: subgraph.id, value: subgraph.title || subgraph.id });
      return;
    }

    const edge = graph.edges.find((item) => item.id === target.id);
    if (!edge) return;
    setInteractionState({ kind: "editingEdgeLabel", edgeId: edge.id });
    setInlineEdit({ type: "edge", id: edge.id, value: edge.label });
  }

  const startTableCellEdit = useCallback((selection: TableCellSelection) => {
    const node = graph.nodes.find((item) => item.id === selection.nodeId);
    const content = node && resolveCanvasNodeKind(node) === "table" && node.content?.kind === "table" ? node.content : undefined;
    const row = content?.rows.find((item) => item.id === selection.rowId);
    const column = content?.columns.find((item) => item.id === selection.columnId);
    if (!node || !content || !row || !column) return;
    setSelectedTableCell(selection);
    setInteractionState({ kind: "editingNodeText", nodeId: node.id });
    setInlineEdit({ type: "tableCell", id: node.id, rowId: row.id, columnId: column.id, value: row.cells[column.id] || "", align: column.align });
  }, [graph.nodes, setInteractionState, setSelectedTableCell]);

  function startTableHeaderEdit(selection: TableHeaderSelection) {
    const node = graph.nodes.find((item) => item.id === selection.nodeId);
    const content = node && resolveCanvasNodeKind(node) === "table" && node.content?.kind === "table" ? node.content : undefined;
    const column = content?.columns.find((item) => item.id === selection.columnId);
    if (!node || !content || !column) return;
    setInteractionState({ kind: "editingNodeText", nodeId: node.id });
    setInlineEdit({ type: "tableHeader", id: node.id, columnId: column.id, value: column.label, align: column.align });
  }

  function commitInlineEdit(save: boolean, navigation?: TableCellNavigation) {
    if (!inlineEdit) return;

    if (save && inlineEdit.type === "node") {
      onEditorCommand({ type: "graph.updateNodeLabel", nodeId: inlineEdit.id, label: inlineEdit.value, message: "已更新节点文本。", source: "pointer" });
    }
    if (save && inlineEdit.type === "subgraph") {
      onEditorCommand({
        type: "graph.updateSubgraph",
        subgraphId: inlineEdit.id,
        patch: { title: inlineEdit.value },
        message: "已更新组标题。",
        source: "pointer"
      });
    }
    if (save && inlineEdit.type === "edge") {
      onEditorCommand({ type: "graph.updateEdgeLabel", edgeId: inlineEdit.id, label: inlineEdit.value, message: "已更新连线文本。", source: "pointer" });
    }
    if (inlineEdit.type === "tableCell") {
      const node = graph.nodes.find((item) => item.id === inlineEdit.id);
      const content = node && resolveCanvasNodeKind(node) === "table" && node.content?.kind === "table" ? node.content : undefined;
      if (save && content) {
        const nextContent = updateTableCell(content, inlineEdit.rowId, inlineEdit.columnId, inlineEdit.value);
        if (nextContent !== content) {
          onEditorCommand({ type: "graph.updateNode", nodeId: inlineEdit.id, patch: { content: nextContent }, message: "已更新表格单元格。", source: "pointer" });
        }
        const nextCell = navigation ? navigateTableCell(nextContent, inlineEdit.rowId, inlineEdit.columnId, navigation) : undefined;
        if (nextCell) {
          const column = nextContent.columns.find((item) => item.id === nextCell.columnId);
          const row = nextContent.rows.find((item) => item.id === nextCell.rowId);
          if (column && row) {
            const selection = { nodeId: inlineEdit.id, ...nextCell };
            setSelectedTableCell(selection);
            setInlineEdit({ type: "tableCell", id: inlineEdit.id, ...nextCell, value: row.cells[column.id] || "", align: column.align });
            return;
          }
        }
      }
      setInlineEdit(null);
      resetInteraction();
      return;
    }
    if (inlineEdit.type === "tableHeader") {
      const node = graph.nodes.find((item) => item.id === inlineEdit.id);
      if (save && node && resolveCanvasNodeKind(node) === "table" && node.content?.kind === "table") {
        const nextContent = updateTableHeader(node.content, inlineEdit.columnId, inlineEdit.value);
        if (nextContent !== node.content) {
          onEditorCommand({
            type: "graph.updateNode",
            nodeId: node.id,
            patch: { content: nextContent },
            message: "已更新表头。",
            source: "pointer"
          });
        }
      }
      setInlineEdit(null);
      resetInteraction();
      return;
    }
    setInlineEdit(null);
    resetInteraction();
  }

  function pasteTableCells(text: string) {
    if (inlineEdit?.type !== "tableCell") return;
    const node = graph.nodes.find((item) => item.id === inlineEdit.id);
    if (!node || resolveCanvasNodeKind(node) !== "table" || node.content?.kind !== "table") return;
    const nextContent = applyTableTsv(node.content, inlineEdit.rowId, inlineEdit.columnId, text);
    if (nextContent === node.content) return;
    const row = nextContent.rows.find((item) => item.id === inlineEdit.rowId);
    onEditorCommand({ type: "graph.updateNode", nodeId: node.id, patch: { content: nextContent }, message: "已粘贴表格数据。", source: "pointer" });
    setInlineEdit((current) => current?.type === "tableCell" ? { ...current, value: row?.cells[current.columnId] || current.value } : current);
  }

  useEffect(() => {
    if (inlineEdit?.type !== "node" && inlineEdit?.type !== "tableCell" && inlineEdit?.type !== "tableHeader") return;
    const editor = nodeEditorRef.current;
    if (!editor) return;

    editor.focus();
    editor.select();
  }, [inlineEdit?.id, inlineEdit?.type]);

  useEffect(() => {
    function isTextInput(target: EventTarget | null) {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (inlineEdit || isEditingInteractionState(interactionState) || interactionState.kind !== "idle" || mode !== "select" || isTextInput(event.target)) return;
      if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== "Enter" && event.key !== "F2") return;

      const node = graph.nodes.find((item) => item.id === selection.nodeIds[0]);
      if (!node) return;
      event.preventDefault();
      invalidateBlankClickIntent();
      if (resolveCanvasNodeKind(node) === "table") {
        if (node.content?.kind !== "table") return;
        const target = selectedTableCell?.nodeId === node.id
          ? selectedTableCell
          : node.content.rows[0] && node.content.columns[0]
            ? { nodeId: node.id, rowId: node.content.rows[0].id, columnId: node.content.columns[0].id }
            : null;
        if (target) startTableCellEdit(target);
      } else {
        setInteractionState({ kind: "editingNodeText", nodeId: node.id });
        setInlineEdit({ type: "node", id: node.id, value: node.label });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [graph.nodes, inlineEdit, interactionState, invalidateBlankClickIntent, mode, selectedTableCell, selection.edgeIds.length, selection.nodeIds, setInteractionState, startTableCellEdit]);

  return {
    inlineEdit,
    setInlineEdit,
    startInlineEdit,
    startTableCellEdit,
    startTableHeaderEdit,
    commitInlineEdit,
    pasteTableCells,
    nodeEditorRef,
    nodeEditorMeasureRef
  };
}

export function useKonvaNodeEditorLayout({
  inlineEdit,
  editStyle,
  nodeEditorMeasureRef,
  lineHeight
}: {
  inlineEdit: InlineEdit | null;
  editStyle: InlineEditStyle | null;
  nodeEditorMeasureRef: RefObject<HTMLDivElement | null>;
  lineHeight: number;
}) {
  const [nodeEditorLayout, setNodeEditorLayout] = useState({ insetTop: 0, height: lineHeight, scrollable: false });

  useLayoutEffect(() => {
    if (inlineEdit?.type !== "node" || !editStyle) return;
    const measure = nodeEditorMeasureRef.current;
    if (!measure) return;

    const minimumHeight = lineHeight * editStyle.textScale;
    const measuredHeight = Math.max(minimumHeight, Math.ceil(measure.scrollHeight));
    const scrollable = measuredHeight > editStyle.height + 1;
    const height = scrollable ? editStyle.height : Math.min(editStyle.height, measuredHeight);
    const insetTop = Math.max(0, Math.floor((editStyle.height - height) / 2));

    setNodeEditorLayout((current) => {
      if (current.height === height && current.insetTop === insetTop && current.scrollable === scrollable) return current;
      return { height, insetTop, scrollable };
    });
  }, [editStyle, inlineEdit?.type, inlineEdit?.value, lineHeight, nodeEditorMeasureRef]);

  return nodeEditorLayout;
}

export function resolveKonvaInlineEditStyle({
  inlineEdit,
  graph,
  viewFilters,
  nodeGeometryById,
  subgraphGeometryById,
  currentViewport,
  nodeProximityScale,
  worldToScreen,
  resolvedEdgeGeometry,
  edgeLabelSpec
}: {
  inlineEdit: InlineEdit | null;
  graph: MermaidGraph;
  viewFilters: ViewFilters;
  nodeGeometryById: Map<string, NodeGeometry>;
  subgraphGeometryById: Map<string, SubgraphGeometry>;
  currentViewport: () => ViewportState;
  nodeProximityScale: CanvasProximityScales;
  worldToScreen: (point: CanvasPoint) => CanvasPoint;
  resolvedEdgeGeometry: (edge: CanvasEdge) => EdgePathGeometry | null;
  edgeLabelSpec: EdgeLabelGeometrySpec;
}): InlineEditStyle | null {
  if (!inlineEdit) return null;
  if (inlineEdit.type === "tableHeader") {
    if (!viewFilters.nodes) return null;
    const geometry = nodeGeometryById.get(inlineEdit.id);
    const cell = geometry?.table?.headerCells.find((item) => item.columnId === inlineEdit.columnId);
    if (!geometry || !cell) return null;
    const viewportScale = currentViewport().scale;
    const proximityScale = nodeProximityScale[inlineEdit.id] ?? 1;
    const frame = scaleLocalRectFromCenter(cell.frame, geometry.frame, proximityScale);
    const screen = worldToScreen({ x: geometry.frame.x + frame.x, y: geometry.frame.y + frame.y });
    return { left: screen.x, top: screen.y, width: frame.width * viewportScale, height: frame.height * viewportScale, textScale: viewportScale * proximityScale };
  }
  if (inlineEdit.type === "tableCell") {
    if (!viewFilters.nodes) return null;
    const geometry = nodeGeometryById.get(inlineEdit.id);
    const cell = geometry?.table?.cells.find((item) => item.rowId === inlineEdit.rowId && item.columnId === inlineEdit.columnId);
    if (!geometry || !cell) return null;
    const viewportScale = currentViewport().scale;
    const proximityScale = nodeProximityScale[inlineEdit.id] ?? 1;
    const frame = scaleLocalRectFromCenter(cell.frame, geometry.frame, proximityScale);
    const screen = worldToScreen({ x: geometry.frame.x + frame.x, y: geometry.frame.y + frame.y });
    return {
      left: screen.x,
      top: screen.y,
      width: frame.width * viewportScale,
      height: frame.height * viewportScale,
      textScale: viewportScale * proximityScale
    };
  }
  if (inlineEdit.type === "node") {
    if (!viewFilters.nodes || !viewFilters.nodeLabels) return null;
    const geometry = nodeGeometryById.get(inlineEdit.id);
    if (!geometry) return null;
    const viewportScale = currentViewport().scale;
    const proximityScale = nodeProximityScale[inlineEdit.id] ?? 1;
    const textBox = scaleLocalRectFromCenter(geometry.textBox, geometry.frame, proximityScale);
    const screen = worldToScreen({
      x: geometry.frame.x + textBox.x,
      y: geometry.frame.y + textBox.y
    });
    return {
      left: screen.x,
      top: screen.y,
      width: textBox.width * viewportScale,
      height: textBox.height * viewportScale,
      textScale: viewportScale * proximityScale
    };
  }

  if (inlineEdit.type === "subgraph") {
    if (!viewFilters.subgraphs) return null;
    const geometry = subgraphGeometryById.get(inlineEdit.id);
    if (!geometry) return null;
    const viewportScale = currentViewport().scale;
    const screen = worldToScreen({
      x: geometry.titleBox.x,
      y: geometry.titleBox.y
    });
    return {
      left: screen.x,
      top: screen.y,
      width: geometry.titleBox.width * viewportScale,
      height: geometry.titleBox.height * viewportScale,
      textScale: viewportScale
    };
  }

  const edge = graph.edges.find((item) => item.id === inlineEdit.id);
  if (!edge || !viewFilters.edgeLabels || !isEdgeVisible(edge, graph, viewFilters)) return null;
  const geometry = resolvedEdgeGeometry(edge);
  if (!geometry) return null;
  const viewportScale = currentViewport().scale;
  const labelGeometry = buildEdgeLabelGeometry(inlineEdit.value, geometry.labelPoint, edgeLabelSpec);
  const screen = worldToScreen({ x: labelGeometry.frame.x, y: labelGeometry.frame.y });
  return {
    left: screen.x,
    top: screen.y,
    width: labelGeometry.frame.width * viewportScale,
    height: labelGeometry.frame.height * viewportScale,
    textScale: viewportScale
  };
}

function isEditingInteractionState(state: InteractionState) {
  return state.kind === "editingNodeText" || state.kind === "editingSubgraphTitle" || state.kind === "editingEdgeLabel";
}
