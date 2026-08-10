import { useLayoutEffect, useRef } from "react";
import type Konva from "konva";
import { Group, Line, Rect } from "react-konva";

import type { CanvasDragPreviewSnapshot, CanvasDragPreviewStore } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import type { CanvasViewportCompositor } from "@/features/mermaid-editor/components/konva-canvas/canvas-viewport-compositor";
import type { AlignmentGuide } from "@/features/mermaid-editor/lib/alignment-guides";
import { edgeVisualId, nodeVisualId, subgraphVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";
import type { EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import { buildEdgeLabelGeometry, type EdgeLabelGeometrySpec } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasEdge } from "@/features/mermaid-editor/lib/editor-types";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { getAlignmentGuideVisualState, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";

type PromotedVisual = {
  id: string;
  node: Konva.Node;
  parent: Konva.Container;
  zIndex: number;
};

export function CanvasActiveDragVisuals({
  dragPreviewStore,
  activeNodeIds,
  activeSubgraphIds,
  dragPreviewEdges,
  resolveDragEdgeGeometryMap,
  edgeLabelSpec,
  subgraphGeometries,
  visualTokens,
  directManipulation,
  viewportCompositor
}: {
  dragPreviewStore: CanvasDragPreviewStore;
  activeNodeIds: string[];
  activeSubgraphIds: string[];
  dragPreviewEdges: CanvasEdge[];
  resolveDragEdgeGeometryMap: (snapshot: CanvasDragPreviewSnapshot) => Map<string, EdgePathGeometry>;
  edgeLabelSpec: EdgeLabelGeometrySpec;
  subgraphGeometries: SubgraphGeometry[];
  visualTokens: CanvasVisualTokens;
  directManipulation: boolean;
  viewportCompositor: CanvasViewportCompositor;
}) {
  const promotedRef = useRef<PromotedVisual[]>([]);
  const activeVisualGroupRef = useRef<Konva.Group | null>(null);
  const xGuideRef = useRef<Konva.Line | null>(null);
  const yGuideRef = useRef<Konva.Line | null>(null);
  const dropTargetRef = useRef<Konva.Rect | null>(null);

  useLayoutEffect(() => {
    if (directManipulation) viewportCompositor.beginDirectManipulation();
    function syncVisuals(snapshot: CanvasDragPreviewSnapshot | null) {
      const activeVisualGroup = activeVisualGroupRef.current;
      const stage = activeVisualGroup?.getStage();
      if (!activeVisualGroup || !stage) return;
      const desired = new Set([
        ...activeNodeIds.map(nodeVisualId),
        ...activeSubgraphIds.map(subgraphVisualId),
        ...Object.keys(snapshot?.nodePositions || {}).map(nodeVisualId),
        ...Object.keys(snapshot?.subgraphPositions || {}).map(subgraphVisualId)
      ]);
      let sceneChanged = false;
      const restored = promotedRef.current.filter((item) => !desired.has(item.id));
      if (restored.length) {
        restorePromoted(restored);
        promotedRef.current = promotedRef.current.filter((item) => desired.has(item.id));
        sceneChanged = true;
      }
      for (const id of activeSubgraphIds) {
        if (ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current).created) sceneChanged = true;
      }
      for (const id of activeNodeIds) {
        if (ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current).created) sceneChanged = true;
      }
      for (const [id, position] of Object.entries(snapshot?.subgraphPositions || {})) {
        const promoted = ensurePromoted(subgraphVisualId(id), stage, activeVisualGroup, promotedRef.current);
        if (promoted.created) sceneChanged = true;
        promoted.item?.node.position(position);
      }
      for (const [id, position] of Object.entries(snapshot?.nodePositions || {})) {
        const promoted = ensurePromoted(nodeVisualId(id), stage, activeVisualGroup, promotedRef.current);
        if (promoted.created) sceneChanged = true;
        promoted.item?.node.position(position);
      }
      syncGuides(snapshot?.guides || [], xGuideRef.current, yGuideRef.current, visualTokens);
      syncDropTarget(snapshot?.dropTargetSubgraphId, subgraphGeometries, dropTargetRef.current, visualTokens);
      if (snapshot && dragPreviewEdges.length) {
        syncDragEdges(stage, dragPreviewEdges, resolveDragEdgeGeometryMap(snapshot), edgeLabelSpec);
      }
      viewportCompositor.commitActiveVisualMutation(sceneChanged, snapshot ? "drag-preview" : "active-visual-sync");
    }

    const unsubscribe = dragPreviewStore.subscribe(() => syncVisuals(dragPreviewStore.getSnapshot()));
    syncVisuals(dragPreviewStore.getSnapshot());
    if (!directManipulation) viewportCompositor.endDirectManipulation();
    return () => unsubscribe();
  }, [activeNodeIds, activeSubgraphIds, directManipulation, dragPreviewEdges, dragPreviewStore, edgeLabelSpec, resolveDragEdgeGeometryMap, subgraphGeometries, viewportCompositor, visualTokens]);

  useLayoutEffect(() => () => {
    const changed = promotedRef.current.length > 0;
    restorePromoted(promotedRef.current);
    promotedRef.current = [];
    if (changed) viewportCompositor.commitActiveVisualMutation(true, "active-visual-unmount");
    viewportCompositor.endDirectManipulation("active-visual-unmount");
  }, [viewportCompositor]);

  return (
    <Group ref={activeVisualGroupRef} name="canvas-active-visuals" listening={false}>
      <Rect ref={dropTargetRef} name="canvas-drop-target" visible={false} listening={false} />
      <Line ref={xGuideRef} name="canvas-alignment-guide-x" visible={false} listening={false} />
      <Line ref={yGuideRef} name="canvas-alignment-guide-y" visible={false} listening={false} />
    </Group>
  );
}

function syncDropTarget(id: string | undefined, subgraphs: SubgraphGeometry[], target: Konva.Rect | null, visualTokens: CanvasVisualTokens) {
  if (!target) return;
  const geometry = id ? subgraphs.find((candidate) => candidate.id === id) : undefined;
  if (!geometry) {
    target.visible(false);
    return;
  }
  target.setAttrs({
    ...geometry.frame,
    cornerRadius: visualTokens.group.radius,
    fill: visualTokens.group.selectedBorderColor,
    opacity: 0.08,
    stroke: visualTokens.group.selectedBorderColor,
    strokeWidth: visualTokens.group.emphasizedBorderWidth,
    dash: visualTokens.group.customDash,
    visible: true
  });
}

function syncGuides(guides: AlignmentGuide[], xGuide: Konva.Line | null, yGuide: Konva.Line | null, visualTokens: CanvasVisualTokens) {
  for (const [axis, line] of [["x", xGuide], ["y", yGuide]] as const) {
    if (!line) continue;
    const guide = guides.find((candidate) => candidate.axis === axis);
    if (!guide) {
      line.visible(false);
      continue;
    }
    const visual = getAlignmentGuideVisualState(guide.kind, visualTokens);
    line.points(axis === "x" ? [guide.value, guide.from, guide.value, guide.to] : [guide.from, guide.value, guide.to, guide.value]);
    line.stroke(visual.stroke);
    line.strokeWidth(visual.strokeWidth);
    line.strokeEnabled(visual.strokeEnabled);
    line.dash(visual.dash);
    line.lineCap("round");
    line.visible(true);
  }
}

function syncDragEdges(stage: Konva.Stage, edges: CanvasEdge[], geometries: Map<string, EdgePathGeometry>, edgeLabelSpec: EdgeLabelGeometrySpec) {
  for (const edge of edges) {
    const group = stage.findOne((candidate: Konva.Node) => candidate.id() === edgeVisualId(edge.id)) as Konva.Container | undefined;
    const geometry = geometries.get(edge.id);
    if (!group || !geometry) continue;
    const path = group.findOne(".canvas-edge-path");
    if (path?.getClassName() === "Path") (path as Konva.Path).data(geometry.pathData || "");
    else if (path) (path as Konva.Arrow).points(geometry.points);
    syncMarker(group.findOne(".canvas-edge-marker-start"), geometry.start, { x: -geometry.startTangent.x, y: -geometry.startTangent.y });
    syncMarker(group.findOne(".canvas-edge-marker-end"), geometry.end, geometry.endTangent);
    const label = group.findOne(".canvas-edge-label");
    if (label && edge.label) {
      const labelGeometry = buildEdgeLabelGeometry(edge.label, geometry.labelPoint, edgeLabelSpec);
      label.position({ x: labelGeometry.frame.x, y: labelGeometry.frame.y });
    }
  }
}

function syncMarker(marker: Konva.Node | undefined, point: { x: number; y: number }, tangent: { x: number; y: number }) {
  if (!marker) return;
  marker.position(point);
  if (marker.getClassName() === "Line") marker.rotation((Math.atan2(tangent.y, tangent.x) * 180) / Math.PI);
}

function ensurePromoted(visualId: string, stage: Konva.Stage, activeLayer: Konva.Container, promoted: PromotedVisual[]) {
  const existing = promoted.find((item) => item.id === visualId);
  if (existing) return { item: existing, created: false };
  const node = stage.findOne((candidate: Konva.Node) => candidate.id() === visualId);
  const parent = node?.getParent();
  if (!node || !parent || parent === activeLayer) return { item: null, created: false };
  const item = { id: visualId, node, parent, zIndex: node.zIndex() };
  promoted.push(item);
  node.moveTo(activeLayer);
  return { item, created: true };
}

function restorePromoted(promoted: PromotedVisual[]) {
  for (const item of promoted) item.node.moveTo(item.parent);
  for (const item of [...promoted].sort((left, right) => left.zIndex - right.zIndex)) {
    item.node.zIndex(Math.min(item.zIndex, Math.max(0, item.parent.getChildren().length - 1)));
  }
}
