import { useMemo } from "react";

import { edgeLabelGeometrySpec, nodeGeometrySpec } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { CanvasNodeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { computeEdgeDraftPath, computeEdgePath, computeEdgePathMap, computeEdgeRetargetPath, resolveFinalEdgeGeometryMap, resolveParallelEdgeLanes, type EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { resolveCanvasRenderScope } from "@/features/mermaid-editor/lib/canvas-render-scope";
import { mergeCanvasNodePreviewPositions, resolveCanvasProximityEdgeIds, scaleRectFromCenter, type CanvasNodePreviewPositions, type CanvasProximityScales } from "@/features/mermaid-editor/lib/canvas-motion";
import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { CanvasEdge, EdgeRouting, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometryTokens } from "@/features/mermaid-editor/lib/node-geometry";
import { buildNodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometryTokens } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { buildSubgraphGeometries } from "@/features/mermaid-editor/lib/subgraph-geometry";
import { getConnectionDraftVisualState, type CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { isEdgeVisible, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

const CONNECTION_ANCHOR_SNAP_RADIUS_PX = 14;

type UseKonvaRenderModelArgs = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  dimensions: { width: number; height: number };
  viewFilters: ViewFilters;
  edgeRouting: EdgeRouting;
  mermaidEdgeRoutes: DagreEdgeRoute[];
  layoutMode: LayoutMode;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  hoveredNodeId: string | null;
  hoveredSubgraphId: string | null;
  hoveredEdgeId: string | null;
  dragPreviewPositions: CanvasNodePreviewPositions | null;
  nodeMotion: Record<string, CanvasNodeMotionVisual>;
  nodeProximityScale: CanvasProximityScales;
  nodeThemeTokens: NodeGeometryTokens;
  edgeLabelThemeTokens: EdgeLabelGeometryTokens;
  subgraphThemeTokens: SubgraphGeometryTokens;
  visualTokens: CanvasVisualTokens;
};

export function useKonvaRenderModel({
  graph,
  selection,
  viewport,
  dimensions,
  viewFilters,
  edgeRouting,
  mermaidEdgeRoutes,
  layoutMode,
  inlineEdit,
  interactionState,
  hoveredNodeId,
  hoveredSubgraphId,
  hoveredEdgeId,
  dragPreviewPositions,
  nodeMotion,
  nodeProximityScale,
  nodeThemeTokens,
  edgeLabelThemeTokens,
  subgraphThemeTokens,
  visualTokens
}: UseKonvaRenderModelArgs) {
  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedSubgraphIds = useMemo(() => new Set(selection.subgraphIds || []), [selection.subgraphIds]);
  const geometrySpec = useMemo(() => nodeGeometrySpec(nodeThemeTokens), [nodeThemeTokens]);
  const edgeLabelSpec = useMemo(() => edgeLabelGeometrySpec(edgeLabelThemeTokens), [edgeLabelThemeTokens]);
  const renderedNodes = useMemo(
    () =>
      mergeCanvasNodePreviewPositions(graph.nodes, dragPreviewPositions).map((node) => {
        const animated = dragPreviewPositions?.[node.id] ? undefined : nodeMotion[node.id];
        const labeled = inlineEdit?.type === "node" && node.id === inlineEdit.id ? { ...node, label: inlineEdit.value } : node;
        return animated ? { ...labeled, x: animated.x, y: animated.y } : labeled;
      }),
    [dragPreviewPositions, graph.nodes, inlineEdit, nodeMotion]
  );
  const renderedNodeGeometries = useMemo(() => renderedNodes.map((node) => buildNodeGeometry(node, geometrySpec)), [geometrySpec, renderedNodes]);
  const renderedGraph = useMemo(() => ({ ...graph, nodes: renderedNodes }), [graph, renderedNodes]);
  const renderedSubgraphGeometries = useMemo(
    () => buildSubgraphGeometries(renderedGraph, renderedNodeGeometries, subgraphThemeTokens),
    [renderedGraph, renderedNodeGeometries, subgraphThemeTokens]
  );
  const nodeGeometryById = useMemo(() => new Map(renderedNodeGeometries.map((geometry) => [geometry.id, geometry])), [renderedNodeGeometries]);
  const selectedNodeRects = useMemo(
    () =>
      graph.nodes.flatMap((node) => {
        if (!selectedNodeIds.has(node.id)) return [];
        const geometry = nodeGeometryById.get(node.id);
        if (!geometry) return [];
        return [{ ...geometry.alignmentRect, x: node.x, y: node.y }];
      }),
    [graph.nodes, nodeGeometryById, selectedNodeIds]
  );
  const subgraphGeometryById = useMemo(() => new Map(renderedSubgraphGeometries.map((geometry) => [geometry.id, geometry])), [renderedSubgraphGeometries]);
  const routedNodeRects = useMemo(() => renderedNodeGeometries.map((geometry) => geometry.routedRect), [renderedNodeGeometries]);
  const routedEntityRects = useMemo(
    () => [...routedNodeRects, ...renderedSubgraphGeometries.map((geometry) => geometry.routedRect)],
    [renderedSubgraphGeometries, routedNodeRects]
  );
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => isEdgeVisible(edge, graph, viewFilters)), [graph, viewFilters]);
  const mermaidRouteByEdgeId = useMemo(() => new Map(mermaidEdgeRoutes.map((route) => [route.edgeId, route])), [mermaidEdgeRoutes]);
  const draftEdgeRouting = edgeRouting;
  const parallelEdgeLaneSpacing = visualTokens.edge.parallelSpacing;
  const connectionAnchorSnapRadiusWorld = CONNECTION_ANCHOR_SNAP_RADIUS_PX / Math.max(viewport.scale, 0.01);
  const proximityEdgeIds = useMemo(() => resolveCanvasProximityEdgeIds(visibleEdges, nodeProximityScale), [nodeProximityScale, visibleEdges]);
  const parallelEdgeLaneById = useMemo(
    () => resolveParallelEdgeLanes(visibleEdges, routedEntityRects, { laneSpacing: parallelEdgeLaneSpacing }),
    [parallelEdgeLaneSpacing, routedEntityRects, visibleEdges]
  );
  const fallbackEdgeGeometryById = useMemo(
    () => computeEdgePathMap(visibleEdges, routedEntityRects, draftEdgeRouting, { laneSpacing: parallelEdgeLaneSpacing }),
    [draftEdgeRouting, parallelEdgeLaneSpacing, routedEntityRects, visibleEdges]
  );
  const proximityEdgeGeometryById = useMemo(() => {
    if (proximityEdgeIds.size === 0) return new Map<string, EdgePathGeometry>();

    const scaledNodeRectById = new Map(renderedNodeGeometries.map((geometry) => [geometry.id, scaleRectFromCenter(geometry.routedRect, nodeProximityScale[geometry.id] ?? 1)]));
    const proximityEntityRects = routedEntityRects.map((rect) => scaledNodeRectById.get(rect.id) ?? rect);
    const geometryById = new Map<string, EdgePathGeometry>();

    for (const edge of visibleEdges) {
      if (!proximityEdgeIds.has(edge.id)) continue;
      const geometry = computeEdgePath(edge, proximityEntityRects, draftEdgeRouting, { lane: parallelEdgeLaneById.get(edge.id) });
      if (geometry) geometryById.set(edge.id, geometry);
    }

    return geometryById;
  }, [draftEdgeRouting, nodeProximityScale, parallelEdgeLaneById, proximityEdgeIds, renderedNodeGeometries, routedEntityRects, visibleEdges]);
  const edgeGeometryById = useMemo(
    () =>
      resolveFinalEdgeGeometryMap({
        edges: visibleEdges,
        fallbackGeometryById: fallbackEdgeGeometryById,
        proximityGeometryById: proximityEdgeGeometryById,
        mermaidRouteByEdgeId,
        layoutMode
      }),
    [fallbackEdgeGeometryById, layoutMode, mermaidRouteByEdgeId, proximityEdgeGeometryById, visibleEdges]
  );

  function resolvedEdgeGeometry(edge: CanvasEdge) {
    return edgeGeometryById.get(edge.id) || null;
  }

  const selectedSingleEdge =
    selection.edgeIds.length === 1 ? visibleEdges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeBaseGeometry = selectedSingleEdge ? resolvedEdgeGeometry(selectedSingleEdge) : null;
  const selectionBox =
    interactionState.kind === "marqueeSelecting"
      ? {
          startX: interactionState.startWorld.x,
          startY: interactionState.startWorld.y,
          endX: interactionState.currentWorld.x,
          endY: interactionState.currentWorld.y
        }
      : null;
  const connectionDraft = interactionState.kind === "connectingEdge" ? interactionState : null;
  const retargetDraft = interactionState.kind === "retargetingEdge" ? interactionState : null;
  const connectionPreview = useMemo(
    () =>
      connectionDraft
        ? resolveConnectionPreview({
            fromId: connectionDraft.fromId,
            currentWorld: connectionDraft.currentWorld,
            nodes: renderedNodeGeometries,
            subgraphs: renderedSubgraphGeometries,
            anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
          })
        : null,
    [connectionAnchorSnapRadiusWorld, connectionDraft, renderedNodeGeometries, renderedSubgraphGeometries]
  );
  const connectionDraftGeometry = useMemo(() => {
    if (!connectionDraft || !connectionPreview) return null;

    const sourceRect = routedEntityRects.find((rect) => rect.id === connectionDraft.fromId);
    if (!sourceRect) return null;

    if (connectionPreview.valid && connectionPreview.targetId) {
      const draftEdge: CanvasEdge = {
        id: "__connection_draft__",
        from: connectionDraft.fromId,
        to: connectionPreview.targetId,
        label: "",
        style: "solid",
        markerStart: "none",
        markerEnd: "arrow",
        minLength: 1,
        arrowType: "arrow",
        ...(connectionDraft.fromAnchor ? { fromAnchor: connectionDraft.fromAnchor } : {}),
        ...(connectionPreview.targetAnchor ? { toAnchor: connectionPreview.targetAnchor } : {})
      };
      const draftGeometryById = computeEdgePathMap([...visibleEdges, draftEdge], routedEntityRects, draftEdgeRouting, { laneSpacing: parallelEdgeLaneSpacing });
      return draftGeometryById.get(draftEdge.id) || computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, draftEdgeRouting);
    }

    return computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, draftEdgeRouting);
  }, [connectionDraft, connectionPreview, draftEdgeRouting, parallelEdgeLaneSpacing, routedEntityRects, visibleEdges]);
  const connectionDraftVisual = useMemo(
    () => getConnectionDraftVisualState({ valid: connectionPreview?.valid ?? false, visualTokens }),
    [connectionPreview?.valid, visualTokens]
  );
  const retargetPreview = useMemo(() => {
    if (!retargetDraft) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    return resolveRetargetPreview({
      edge,
      side: retargetDraft.side,
      currentWorld: retargetDraft.currentWorld,
      nodes: renderedNodeGeometries,
      subgraphs: renderedSubgraphGeometries,
      anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
    });
  }, [connectionAnchorSnapRadiusWorld, graph.edges, renderedNodeGeometries, renderedSubgraphGeometries, retargetDraft]);
  const retargetDraftGeometry = useMemo(() => {
    if (!retargetDraft || !retargetPreview) return null;

    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    if (retargetPreview.valid && retargetPreview.targetId) {
      const anchorKey = retargetDraft.side === "from" ? "fromAnchor" : "toAnchor";
      const retargetedEdge = { ...edge, [retargetDraft.side]: retargetPreview.targetId, [anchorKey]: retargetPreview.targetAnchor || undefined };
      const previewEdges = visibleEdges.some((item) => item.id === edge.id)
        ? visibleEdges.map((item) => (item.id === edge.id ? retargetedEdge : item))
        : [...visibleEdges, retargetedEdge];
      const previewGeometryById = computeEdgePathMap(previewEdges, routedEntityRects, draftEdgeRouting, { laneSpacing: parallelEdgeLaneSpacing });
      return previewGeometryById.get(edge.id) || computeEdgeRetargetPath(edge, routedEntityRects, retargetDraft.side, retargetPreview.geometryTarget, draftEdgeRouting);
    }

    return computeEdgeRetargetPath(edge, routedEntityRects, retargetDraft.side, retargetPreview.geometryTarget, draftEdgeRouting);
  }, [draftEdgeRouting, graph.edges, parallelEdgeLaneSpacing, retargetDraft, retargetPreview, routedEntityRects, visibleEdges]);
  const selectedSingleEdgeGeometry =
    retargetDraft?.edgeId === selectedSingleEdge?.id && retargetDraftGeometry ? retargetDraftGeometry : selectedSingleEdgeBaseGeometry;
  const connectionTargetNodeId = connectionPreview?.targetNodeId ?? retargetPreview?.targetNodeId ?? null;
  const connectionInvalidNodeId = connectionPreview?.invalidNodeId ?? retargetPreview?.invalidNodeId ?? null;
  const connectionTargetSubgraphId = connectionPreview?.targetSubgraphId ?? retargetPreview?.targetSubgraphId ?? null;
  const connectionInvalidSubgraphId = connectionPreview?.invalidSubgraphId ?? retargetPreview?.invalidSubgraphId ?? null;
  const renderScope = useMemo(
    () =>
      resolveCanvasRenderScope({
        graph,
        viewport,
        canvasSize: dimensions,
        viewFilters,
        nodeBounds: renderedNodeGeometries,
        subgraphBounds: renderedSubgraphGeometries,
        edges: visibleEdges,
        selection,
        hoveredNodeId,
        hoveredSubgraphId,
        hoveredEdgeId,
        inlineEdit,
        interactionState,
        connectionTargetNodeId,
        connectionInvalidNodeId,
        connectionTargetSubgraphId,
        connectionInvalidSubgraphId
      }),
    [
      connectionInvalidNodeId,
      connectionInvalidSubgraphId,
      connectionTargetNodeId,
      connectionTargetSubgraphId,
      dimensions,
      graph,
      hoveredEdgeId,
      hoveredNodeId,
      hoveredSubgraphId,
      inlineEdit,
      interactionState,
      renderedNodeGeometries,
      renderedSubgraphGeometries,
      selection,
      viewFilters,
      viewport,
      visibleEdges
    ]
  );
  const scopedRenderedNodes = useMemo(() => renderedNodes.filter((node) => renderScope.nodeIds.has(node.id)), [renderScope, renderedNodes]);
  const scopedSubgraphGeometries = useMemo(
    () => renderedSubgraphGeometries.filter((geometry) => renderScope.subgraphIds.has(geometry.id)),
    [renderScope, renderedSubgraphGeometries]
  );
  const scopedVisibleEdges = useMemo(() => visibleEdges.filter((edge) => renderScope.edgeIds.has(edge.id)), [renderScope, visibleEdges]);

  return {
    selectedNodeIds,
    selectedSubgraphIds,
    geometrySpec,
    edgeLabelSpec,
    renderedNodes,
    renderedNodeGeometries,
    renderedSubgraphGeometries,
    nodeGeometryById,
    selectedNodeRects,
    subgraphGeometryById,
    routedEntityRects,
    visibleEdges,
    edgeGeometryById,
    resolvedEdgeGeometry,
    selectedSingleEdge,
    selectedSingleEdgeGeometry,
    selectionBox,
    connectionDraft,
    retargetDraft,
    connectionPreview,
    connectionDraftGeometry,
    connectionDraftVisual,
    retargetPreview,
    retargetDraftGeometry,
    connectionTargetNodeId,
    connectionInvalidNodeId,
    connectionTargetSubgraphId,
    connectionInvalidSubgraphId,
    scopedRenderedNodes,
    scopedSubgraphGeometries,
    scopedVisibleEdges,
    connectionAnchorSnapRadiusWorld
  };
}
