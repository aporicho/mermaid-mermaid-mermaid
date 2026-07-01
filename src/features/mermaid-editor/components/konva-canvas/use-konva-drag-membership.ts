import { useState } from "react";
import type Konva from "konva";
import type { Dispatch, SetStateAction } from "react";

import { unique } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { useKonvaDragDraft } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-draft";
import {
  computeAlignmentSnap,
  selectionBounds,
  type AlignmentGuide
} from "@/features/mermaid-editor/lib/alignment-guides";
import type { CanvasPoint, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasNodePreviewPositions } from "@/features/mermaid-editor/lib/canvas-motion";
import {
  descendantNodeIds,
  descendantSubgraphIds,
  selectOnlyNode,
  selectOnlySubgraph,
  setNodeParent,
  setNodePositions,
  setSubgraphParent
} from "@/features/mermaid-editor/lib/editor-actions";
import type { CanvasNode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { buildNodeGeometry, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import {
  buildSubgraphGeometries,
  subgraphAtPoint,
  type SubgraphGeometry,
  type SubgraphGeometryTokens
} from "@/features/mermaid-editor/lib/subgraph-geometry";

type UseKonvaDragMembershipArgs = {
  dragRuntime: ReturnType<typeof useKonvaDragDraft>;
  graph: MermaidGraph;
  selection: Selection;
  interactionState: InteractionState;
  selectedNodeIds: Set<string>;
  selectedSubgraphIds: Set<string>;
  dragEnabled: boolean;
  geometrySpec: NodeGeometrySpec;
  subgraphGeometryById: Map<string, SubgraphGeometry>;
  renderedSubgraphGeometries: SubgraphGeometry[];
  subgraphThemeTokens: SubgraphGeometryTokens;
  pointerScreenPoint: () => CanvasPoint | null;
  pointerWorldPoint: () => CanvasPoint | null;
  currentViewport: () => ViewportState;
  setInteractionState: Dispatch<SetStateAction<InteractionState>>;
  invalidateBlankClickIntent: () => void;
  resetInteraction: () => void;
  stopActiveMotionTweens: () => void;
  clearNodeMotionVisual: (nodeId: string) => void;
  clearNodeProximityScales: (immediate?: boolean, options?: { preservePointer?: boolean }) => void;
  onEditorCommand: (command: EditorCommand) => void;
};

export function useKonvaDragMembership({
  dragRuntime,
  graph,
  selection,
  interactionState,
  selectedNodeIds,
  selectedSubgraphIds,
  dragEnabled,
  geometrySpec,
  subgraphGeometryById,
  renderedSubgraphGeometries,
  subgraphThemeTokens,
  pointerScreenPoint,
  pointerWorldPoint,
  currentViewport,
  setInteractionState,
  invalidateBlankClickIntent,
  resetInteraction,
  stopActiveMotionTweens,
  clearNodeMotionVisual,
  clearNodeProximityScales,
  onEditorCommand
}: UseKonvaDragMembershipArgs) {
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);
  const {
    dragRef,
    subgraphDragFrameRef,
    dragDraftGraphRef,
    dragPreviewPositions,
    setDragPreviewPositionsVisual,
    scheduleDragDraftCommand,
    flushDragDraftCommand,
    clearPendingDragDraftCommand,
    clearDragRuntimeState
  } = dragRuntime;

  function startNodeDrag(node: CanvasNode) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: node.x, y: node.y };
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingNodes", pointerId: 0, nodeId: node.id, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => ids.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    clearPendingDragDraftCommand();
    clearNodeProximityScales(true, { preservePointer: true });
    setDragPreviewPositionsVisual(null);
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
  }

  function startSubgraphDrag(subgraphId: string, geometry: SubgraphGeometry) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedSubgraphIds.has(subgraphId) ? selection.subgraphIds || [] : [subgraphId];
    const nodeIds = unique(ids.flatMap((id) => descendantNodeIds(graph, id)));
    if (!nodeIds.length) return;
    const screen = pointerScreenPoint() || { x: 0, y: 0 };
    const world = pointerWorldPoint() || { x: geometry.frame.x, y: geometry.frame.y };
    if (!selectedSubgraphIds.has(subgraphId)) onEditorCommand({ type: "selection.set", selection: selectOnlySubgraph(subgraphId), source: "pointer" });
    invalidateBlankClickIntent();
    setAlignmentGuides([]);
    setInteractionState({ kind: "draggingSubgraphs", pointerId: 0, subgraphId, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => nodeIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    clearPendingDragDraftCommand();
    clearNodeProximityScales(true, { preservePointer: true });
    setDragPreviewPositionsVisual(null);
    subgraphDragFrameRef.current = Object.fromEntries(
      ids.map((id) => {
        const item = subgraphGeometryById.get(id);
        return [id, item ? { x: item.frame.x, y: item.frame.y } : { x: geometry.frame.x, y: geometry.frame.y }];
      })
    );
    dragDraftGraphRef.current = null;
    onEditorCommand({ type: "history.capture", source: "pointer" });
  }

  function moveSelectedNodes(node: CanvasNode, target: Konva.Node) {
    if (!dragRef.current) return;
    const origin = dragRef.current[node.id];
    if (!origin) return;
    const deltaX = target.x() - origin.x;
    const deltaY = target.y() - origin.y;
    const movingRects = graph.nodes
      .filter((item) => dragRef.current?.[item.id])
      .map((item) => {
        const start = dragRef.current![item.id];
        const movedNode = {
          ...item,
          x: start.x + deltaX,
          y: start.y + deltaY
        };
        return buildNodeGeometry(movedNode, geometrySpec).alignmentRect;
      });
    const movingBounds = selectionBounds(movingRects);
    const staticRects = graph.nodes.filter((item) => !dragRef.current?.[item.id]).map((item) => buildNodeGeometry(item, geometrySpec).alignmentRect);
    const snap = movingBounds ? computeAlignmentSnap(movingBounds, staticRects, currentViewport().scale) : { dx: 0, dy: 0, guides: [] };
    const snappedDeltaX = deltaX + snap.dx;
    const snappedDeltaY = deltaY + snap.dy;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + snappedDeltaX, y: position.y + snappedDeltaY }])
    ) as CanvasNodePreviewPositions;
    const draggedPosition = positions[node.id];
    if (draggedPosition) target.position(draggedPosition);
    setAlignmentGuides(snap.guides);
    dragDraftGraphRef.current = setNodePositions(graph, positions);
    setDragPreviewPositionsVisual(positions);
    scheduleDragDraftCommand(positions, "正在移动节点。");
  }

  function moveSelectedSubgraphs(subgraphId: string, target: Konva.Node) {
    if (!dragRef.current || !subgraphDragFrameRef.current) return;
    const origin = subgraphDragFrameRef.current[subgraphId];
    if (!origin) return;
    const deltaX = target.x() - origin.x;
    const deltaY = target.y() - origin.y;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + deltaX, y: position.y + deltaY }])
    ) as CanvasNodePreviewPositions;
    const draggedFrame = subgraphDragFrameRef.current[subgraphId];
    if (draggedFrame) target.position({ x: draggedFrame.x + deltaX, y: draggedFrame.y + deltaY });
    dragDraftGraphRef.current = setNodePositions(graph, positions);
    setDragPreviewPositionsVisual(positions);
    scheduleDragDraftCommand(positions, "正在移动组。");
  }

  function finishDragWithMembership() {
    if (!dragDraftGraphRef.current) return;
    const movingNodeIds = Object.keys(dragRef.current || {});
    let nextGraph = dragDraftGraphRef.current;
    const ignoredSubgraphIds =
      interactionState.kind === "draggingSubgraphs" ? [interactionState.subgraphId, ...descendantSubgraphIds(graph, interactionState.subgraphId)] : [];

    for (const nodeId of movingNodeIds) {
      const node = nextGraph.nodes.find((item) => item.id === nodeId);
      if (!node) continue;
      const geometry = buildNodeGeometry(node, geometrySpec);
      const center = {
        x: geometry.frame.x + geometry.frame.width / 2,
        y: geometry.frame.y + geometry.frame.height / 2
      };
      const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignoredSubgraphIds);
      nextGraph = setNodeParent(nextGraph, nodeId, targetSubgraph?.id);
    }

    if (interactionState.kind === "draggingSubgraphs") {
      const movingSubgraphIds = selectedSubgraphIds.has(interactionState.subgraphId) ? selection.subgraphIds || [] : [interactionState.subgraphId];
      const nextNodeGeometries = nextGraph.nodes.map((node) => buildNodeGeometry(node, geometrySpec));
      const nextSubgraphGeometries = buildSubgraphGeometries(nextGraph, nextNodeGeometries, subgraphThemeTokens);

      for (const subgraphId of movingSubgraphIds) {
        const geometry = nextSubgraphGeometries.find((item) => item.id === subgraphId);
        if (!geometry) continue;
        const center = {
          x: geometry.frame.x + geometry.frame.width / 2,
          y: geometry.frame.y + geometry.frame.height / 2
        };
        const ignored = [subgraphId, ...descendantSubgraphIds(nextGraph, subgraphId)];
        const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center, ignored);
        nextGraph = setSubgraphParent(nextGraph, subgraphId, targetSubgraph?.id);
      }
    }

    onEditorCommand({ type: "graph.commitDragMembership", graph: nextGraph, message: "已移动并更新组成员。", source: "pointer" });
  }

  function finishKonvaDrag() {
    flushDragDraftCommand();
    if (dragDraftGraphRef.current) finishDragWithMembership();
    clearDragRuntimeState();
    setAlignmentGuides([]);
    resetInteraction();
  }

  return {
    alignmentGuides,
    dragPreviewPositions,
    clearAlignmentGuides: () => setAlignmentGuides([]),
    startNodeDrag,
    startSubgraphDrag,
    moveSelectedNodes,
    moveSelectedSubgraphs,
    finishKonvaDrag
  };
}
