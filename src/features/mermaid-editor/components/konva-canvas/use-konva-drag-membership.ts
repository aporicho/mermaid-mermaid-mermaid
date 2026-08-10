import { useRef, type Dispatch, type SetStateAction } from "react";
import { unique } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { useKonvaDragDraft } from "@/features/mermaid-editor/components/konva-canvas/use-konva-drag-draft";
import {
  computeStatefulAlignmentSnapWithIndex,
  createAlignmentSnapIndex,
  selectionBounds,
  type AlignmentRect,
  type AlignmentSnapIndex,
  type AlignmentSnapState
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
import { dragGraphChanged } from "@/features/mermaid-editor/lib/drag-graph-change";
import { nodeDragDropTarget, subgraphDragDropTarget } from "@/features/mermaid-editor/lib/drag-drop-target";
import { buildNodeGeometry, type NodeGeometry, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
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
  nodeGeometryById: Map<string, NodeGeometry>;
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
  nodeGeometryById,
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
  const dragAlignmentRef = useRef<{ movingBounds: AlignmentRect | null; staticIndex: AlignmentSnapIndex; snapState: AlignmentSnapState } | null>(null);
  const dragPointerStartWorldRef = useRef<CanvasPoint | null>(null);
  const {
    dragRef,
    subgraphDragFrameRef,
    dragFinalPositionsRef,
    dragPreviewStore,
    beginDragRuntimeState,
    markDragPositionsCommitted,
    scheduleDragPreviewPositionsVisual,
    preserveCommittedDragPreview,
    clearDragRuntimeState
  } = dragRuntime;
  function startNodeDrag(node: CanvasNode, origin?: { screen: CanvasPoint; world: CanvasPoint; pointerId?: number }) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const ids = selectedNodeIds.has(node.id) ? selection.nodeIds : [node.id];
    const screen = origin?.screen || pointerScreenPoint() || { x: 0, y: 0 };
    const world = origin?.world || pointerWorldPoint() || { x: node.x, y: node.y };
    dragPointerStartWorldRef.current = world;
    if (!selectedNodeIds.has(node.id)) onEditorCommand({ type: "selection.set", selection: selectOnlyNode(node.id), source: "pointer" });
    invalidateBlankClickIntent();
    setInteractionState({ kind: "draggingNodes", pointerId: origin?.pointerId ?? 0, nodeId: node.id, startScreen: screen, startWorld: world });
    const movingIdSet = new Set(ids);
    dragRef.current = Object.fromEntries(graph.nodes.filter((item) => movingIdSet.has(item.id)).map((item) => [item.id, { x: item.x, y: item.y }]));
    const movingRects = Object.fromEntries(ids.flatMap((id) => {
      const rect = nodeGeometryById.get(id)?.alignmentRect;
      return rect ? [[id, rect]] : [];
    }));
    const staticRects = graph.nodes.flatMap((item) => {
      if (movingIdSet.has(item.id)) return [];
      const rect = nodeGeometryById.get(item.id)?.alignmentRect;
      return rect ? [rect] : [];
    });
    dragAlignmentRef.current = { movingBounds: selectionBounds(Object.values(movingRects)), staticIndex: createAlignmentSnapIndex(staticRects), snapState: {} };
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    clearNodeProximityScales(true, { preservePointer: true });
    beginDragRuntimeState();
  }

  function startSubgraphDrag(subgraphId: string, geometry: SubgraphGeometry, origin?: { screen: CanvasPoint; world: CanvasPoint; pointerId?: number }) {
    if (!dragEnabled) return;
    if (dragRef.current) return;
    const rootIds = selectedSubgraphIds.has(subgraphId) ? selection.subgraphIds || [] : [subgraphId];
    const ids = unique(rootIds.flatMap((id) => [id, ...descendantSubgraphIds(graph, id)]));
    const nodeIds = unique(rootIds.flatMap((id) => descendantNodeIds(graph, id)));
    if (!nodeIds.length) return;
    const screen = origin?.screen || pointerScreenPoint() || { x: 0, y: 0 };
    const world = origin?.world || pointerWorldPoint() || { x: geometry.frame.x, y: geometry.frame.y };
    dragPointerStartWorldRef.current = world;
    if (!selectedSubgraphIds.has(subgraphId)) onEditorCommand({ type: "selection.set", selection: selectOnlySubgraph(subgraphId), source: "pointer" });
    invalidateBlankClickIntent();
    setInteractionState({ kind: "draggingSubgraphs", pointerId: origin?.pointerId ?? 0, subgraphId, startScreen: screen, startWorld: world });
    dragRef.current = Object.fromEntries(
      graph.nodes.filter((item) => nodeIds.includes(item.id)).map((item) => [item.id, { x: item.x, y: item.y }])
    );
    dragAlignmentRef.current = null;
    stopActiveMotionTweens();
    for (const id of Object.keys(dragRef.current)) clearNodeMotionVisual(id);
    clearNodeProximityScales(true, { preservePointer: true });
    beginDragRuntimeState();
    subgraphDragFrameRef.current = Object.fromEntries(
      ids.map((id) => {
        const item = subgraphGeometryById.get(id);
        return [id, item ? { x: item.frame.x, y: item.frame.y } : { x: geometry.frame.x, y: geometry.frame.y }];
      })
    );
  }

  function moveSelectedNodes(nodeId: string, currentWorld: CanvasPoint, options: { disableSnap?: boolean } = {}) {
    if (!dragRef.current) return null;
    const pointerStart = dragPointerStartWorldRef.current;
    if (!pointerStart || !dragRef.current[nodeId]) return null;
    const deltaX = currentWorld.x - pointerStart.x;
    const deltaY = currentWorld.y - pointerStart.y;
    const alignment = dragAlignmentRef.current;
    const movingBounds = alignment?.movingBounds
      ? { ...alignment.movingBounds, x: alignment.movingBounds.x + deltaX, y: alignment.movingBounds.y + deltaY }
      : null;
    const snap = movingBounds && alignment
      ? computeStatefulAlignmentSnapWithIndex(movingBounds, alignment.staticIndex, currentViewport().scale, alignment.snapState, { disabled: options.disableSnap })
      : { dx: 0, dy: 0, guides: [], state: {} };
    if (alignment) alignment.snapState = snap.state;
    const snappedDeltaX = deltaX + snap.dx;
    const snappedDeltaY = deltaY + snap.dy;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + snappedDeltaX, y: position.y + snappedDeltaY }])
    ) as CanvasNodePreviewPositions;
    const baseNode = graph.nodes.find((item) => item.id === nodeId);
    const baseGeometry = nodeGeometryById.get(nodeId);
    const position = positions[nodeId];
    const targetSubgraph = nodeDragDropTarget(baseNode, baseGeometry, position, renderedSubgraphGeometries);
    scheduleDragPreviewPositionsVisual(positions, {}, snap.guides, targetSubgraph?.id);
    return positions;
  }

  function moveSelectedSubgraphs(subgraphId: string, currentWorld: CanvasPoint) {
    if (!dragRef.current || !subgraphDragFrameRef.current) return;
    const pointerStart = dragPointerStartWorldRef.current;
    if (!pointerStart || !subgraphDragFrameRef.current[subgraphId]) return;
    const deltaX = currentWorld.x - pointerStart.x;
    const deltaY = currentWorld.y - pointerStart.y;
    const positions = Object.fromEntries(
      Object.entries(dragRef.current).map(([id, position]) => [id, { x: position.x + deltaX, y: position.y + deltaY }])
    ) as CanvasNodePreviewPositions;
    const subgraphPositions = Object.fromEntries(
      Object.entries(subgraphDragFrameRef.current).map(([id, frame]) => [id, { x: frame.x + deltaX, y: frame.y + deltaY }])
    );
    const movingGeometry = subgraphGeometryById.get(subgraphId);
    const ignored = [subgraphId, ...descendantSubgraphIds(graph, subgraphId)];
    const targetSubgraph = subgraphDragDropTarget(movingGeometry, { x: deltaX, y: deltaY }, renderedSubgraphGeometries, ignored);
    scheduleDragPreviewPositionsVisual(positions, subgraphPositions, [], targetSubgraph?.id);
  }

  function finishDragWithMembership(positions: CanvasNodePreviewPositions) {
    const movingNodeIds = Object.keys(dragRef.current || {});
    let nextGraph = setNodePositions(graph, positions);
    // A group drag preserves its hierarchy; direct node drags may change membership.
    if (interactionState.kind !== "draggingSubgraphs") {
      for (const nodeId of movingNodeIds) {
        const node = nextGraph.nodes.find((item) => item.id === nodeId);
        if (!node) continue;
        const geometry = buildNodeGeometry(node, geometrySpec);
        const center = {
          x: geometry.frame.x + geometry.frame.width / 2,
          y: geometry.frame.y + geometry.frame.height / 2
        };
        const targetSubgraph = subgraphAtPoint(renderedSubgraphGeometries, center);
        nextGraph = setNodeParent(nextGraph, nodeId, targetSubgraph?.id);
      }
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

    if (dragGraphChanged(graph, nextGraph)) {
      onEditorCommand({ type: "graph.commitDragMembership", graph: nextGraph, message: "已移动并更新组成员。", source: "pointer" });
    }
  }

  function finishKonvaDrag() {
    dragRuntime.flushScheduledDragPreview();
    const positions = dragFinalPositionsRef.current;
    if (positions) {
      markDragPositionsCommitted(positions);
      finishDragWithMembership(positions);
      preserveCommittedDragPreview();
    } else {
      clearDragRuntimeState();
    }
    dragPointerStartWorldRef.current = null;
    dragAlignmentRef.current = null;
    resetInteraction();
  }
  function cancelDrag() {
    clearDragRuntimeState();
    dragPointerStartWorldRef.current = null;
    dragAlignmentRef.current = null;
    resetInteraction();
  }

  return {
    dragPreviewStore,
    clearAlignmentGuides: () => {
      const snapshot = dragPreviewStore.getSnapshot();
      if (snapshot?.guides?.length) dragPreviewStore.publish({ ...snapshot, guides: [] });
    },
    startNodeDrag,
    startSubgraphDrag,
    moveSelectedNodes,
    moveSelectedSubgraphs,
    finishKonvaDrag,
    cancelDrag
  };
}
