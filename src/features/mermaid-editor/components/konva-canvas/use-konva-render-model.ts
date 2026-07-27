import { useCallback, useEffect, useMemo, useRef } from "react";

import { edgeLabelGeometrySpec, nodeGeometrySpec } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { CanvasNodeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import { computeEdgeDraftPath, computeEdgePathFromRectMap, computeEdgeRetargetPath, resolveFinalEdgeGeometryMap, resolveParallelEdgeLanes, type EdgePathGeometry, type RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import { pruneEdgeGeometryCache, resolveCachedEdgeGeometries, type EdgeGeometryCache } from "@/features/mermaid-editor/lib/edge-route-cache";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import {
  DEFAULT_CANVAS_IMAGE_WARM_SCOPE_OVERSCAN_PX,
  resolveCanvasRenderScope
} from "@/features/mermaid-editor/lib/canvas-render-scope";
import { createCanvasGeometryIndex } from "@/features/mermaid-editor/lib/canvas-geometry-index";
import { resolveCanvasProximityEdgeIds, scaleRectFromCenter, type CanvasProximityScales } from "@/features/mermaid-editor/lib/canvas-motion";
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
import type { SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { measurePerformance } from "@/features/mermaid-editor/lib/editor-performance";
import { updateTableCell, updateTableHeader } from "@/features/mermaid-editor/lib/table-node";
import type { CanvasDragPreviewSnapshot } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";
import { descendantNodeIds, descendantSubgraphIds } from "@/features/mermaid-editor/lib/editor-actions";

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
  nodeMotion: Record<string, CanvasNodeMotionVisual>;
  nodeProximityScale: CanvasProximityScales;
  nodeThemeTokens: NodeGeometryTokens;
  specialNodeTokens: SpecialNodeThemeTokens;
  tableTypography: TypographyRoleTokens;
  fontRevision: number;
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
  nodeMotion,
  nodeProximityScale,
  nodeThemeTokens,
  specialNodeTokens,
  tableTypography,
  fontRevision,
  edgeLabelThemeTokens,
  subgraphThemeTokens,
  visualTokens
}: UseKonvaRenderModelArgs) {
  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedSubgraphIds = useMemo(() => new Set(selection.subgraphIds || []), [selection.subgraphIds]);
  const edgeGeometryCacheRef = useRef<EdgeGeometryCache>(new Map());
  useEffect(() => {
    pruneEdgeGeometryCache(edgeGeometryCacheRef.current, graph.edges);
  }, [graph.edges]);
  const geometrySpec = useMemo(
    () => { void fontRevision; return nodeGeometrySpec(nodeThemeTokens, specialNodeTokens, tableTypography); },
    [fontRevision, nodeThemeTokens, specialNodeTokens, tableTypography]
  );
  const edgeLabelSpec = useMemo(() => { void fontRevision; return edgeLabelGeometrySpec(edgeLabelThemeTokens); }, [edgeLabelThemeTokens, fontRevision]);
  const renderedNodes = useMemo(() => {
    let changed = false;
    const nextNodes = graph.nodes.map((node) => {
      const animated = nodeMotion[node.id];
      let labeled = inlineEdit?.type === "node" && node.id === inlineEdit.id ? { ...node, label: inlineEdit.value } : node;
      if (node.id === inlineEdit?.id && node.content?.kind === "table" && inlineEdit.type === "tableCell") {
        labeled = { ...node, content: updateTableCell(node.content, inlineEdit.rowId, inlineEdit.columnId, inlineEdit.value) };
      }
      if (node.id === inlineEdit?.id && node.content?.kind === "table" && inlineEdit.type === "tableHeader") {
        labeled = { ...node, content: updateTableHeader(node.content, inlineEdit.columnId, inlineEdit.value) };
      }
      const rendered = animated ? { ...labeled, x: animated.x, y: animated.y } : labeled;
      if (rendered !== node) changed = true;
      return rendered;
    });
    return changed ? nextNodes : graph.nodes;
  }, [graph.nodes, inlineEdit, nodeMotion]);
  const baseNodeGeometries = useMemo(
    () => measurePerformance("canvas-node-geometry", () => graph.nodes.map((node) => buildNodeGeometry(node, geometrySpec)), { nodes: graph.nodes.length }),
    [geometrySpec, graph.nodes]
  );
  const baseNodeGeometryById = useMemo(() => new Map(baseNodeGeometries.map((geometry) => [geometry.id, geometry])), [baseNodeGeometries]);
  const graphNodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const renderedNodeGeometries = useMemo(
    () => renderedNodes.map((node) => {
      const graphNode = graphNodeById.get(node.id);
      return graphNode === node ? baseNodeGeometryById.get(node.id)! : buildNodeGeometry(node, geometrySpec);
    }),
    [baseNodeGeometryById, geometrySpec, graphNodeById, renderedNodes]
  );
  const baseSubgraphGeometries = useMemo(
    () => buildSubgraphGeometries(graph, baseNodeGeometries, subgraphThemeTokens),
    [baseNodeGeometries, graph, subgraphThemeTokens]
  );
  const baseRoutedEntityRects = useMemo(
    () => [...baseNodeGeometries.map((geometry) => geometry.routedRect), ...baseSubgraphGeometries.map((geometry) => geometry.routedRect)],
    [baseNodeGeometries, baseSubgraphGeometries]
  );
  const renderedGraph = useMemo(() => (renderedNodes === graph.nodes ? graph : { ...graph, nodes: renderedNodes }), [graph, renderedNodes]);
  const renderedSubgraphGeometries = useMemo(
    () => renderedGraph === graph
      ? baseSubgraphGeometries
      : buildSubgraphGeometries(renderedGraph, renderedNodeGeometries, subgraphThemeTokens),
    [baseSubgraphGeometries, graph, renderedGraph, renderedNodeGeometries, subgraphThemeTokens]
  );
  const geometryIndex = useMemo(() => createCanvasGeometryIndex(baseNodeGeometries, baseSubgraphGeometries), [baseNodeGeometries, baseSubgraphGeometries]);
  const nodeGeometryById = useMemo(() => new Map(renderedNodeGeometries.map((geometry) => [geometry.id, geometry])), [renderedNodeGeometries]);
  const selectionNodeGeometryById = interactionState.kind === "draggingNodes" ? baseNodeGeometryById : nodeGeometryById;
  const selectedNodeRects = useMemo(
    () =>
      graph.nodes.flatMap((node) => {
        if (!selectedNodeIds.has(node.id)) return [];
        const geometry = selectionNodeGeometryById.get(node.id);
        if (!geometry) return [];
        return [geometry.alignmentRect];
      }),
    [graph.nodes, selectedNodeIds, selectionNodeGeometryById]
  );
  const subgraphGeometryById = useMemo(() => new Map(renderedSubgraphGeometries.map((geometry) => [geometry.id, geometry])), [renderedSubgraphGeometries]);
  const routedNodeRects = useMemo(() => renderedNodeGeometries.map((geometry) => geometry.routedRect), [renderedNodeGeometries]);
  const routedEntityRects = useMemo(
    () => [...routedNodeRects, ...renderedSubgraphGeometries.map((geometry) => geometry.routedRect)],
    [renderedSubgraphGeometries, routedNodeRects]
  );
  const routedEntityRectById = useMemo(() => new Map(routedEntityRects.map((rect) => [rect.id, rect])), [routedEntityRects]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => isEdgeVisible(edge, graph, viewFilters)), [graph, viewFilters]);
  const parallelEdgesByPair = useMemo(() => groupEdgesByPair(visibleEdges), [visibleEdges]);
  const mermaidRouteByEdgeId = useMemo(() => new Map(mermaidEdgeRoutes.map((route) => [route.edgeId, route])), [mermaidEdgeRoutes]);
  const draftEdgeRouting = edgeRouting;
  const parallelEdgeLaneSpacing = visualTokens.edge.parallelSpacing;
  const edgeCurveSegments = visualTokens.edge.curveSegments;
  const connectionAnchorSnapRadiusWorld = CONNECTION_ANCHOR_SNAP_RADIUS_PX / Math.max(viewport.scale, 0.01);
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
            geometryIndex,
            nodeById: nodeGeometryById,
            subgraphById: subgraphGeometryById,
            anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
          })
        : null,
    [connectionAnchorSnapRadiusWorld, connectionDraft, geometryIndex, nodeGeometryById, renderedNodeGeometries, renderedSubgraphGeometries, subgraphGeometryById]
  );
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
      geometryIndex,
      nodeById: nodeGeometryById,
      subgraphById: subgraphGeometryById,
      anchorSnapRadiusWorld: connectionAnchorSnapRadiusWorld
    });
  }, [connectionAnchorSnapRadiusWorld, geometryIndex, graph.edges, nodeGeometryById, renderedNodeGeometries, renderedSubgraphGeometries, retargetDraft, subgraphGeometryById]);
  const connectionTargetNodeId = connectionPreview?.targetNodeId ?? retargetPreview?.targetNodeId ?? null;
  const connectionInvalidNodeId = connectionPreview?.invalidNodeId ?? retargetPreview?.invalidNodeId ?? null;
  const connectionTargetSubgraphId = connectionPreview?.targetSubgraphId ?? retargetPreview?.targetSubgraphId ?? null;
  const connectionInvalidSubgraphId = connectionPreview?.invalidSubgraphId ?? retargetPreview?.invalidSubgraphId ?? null;
  const scopeNodeGeometries = interactionState.kind === "draggingNodes" ? baseNodeGeometries : renderedNodeGeometries;
  const scopeSubgraphGeometries = interactionState.kind === "draggingNodes" ? baseSubgraphGeometries : renderedSubgraphGeometries;
  const renderScope = useMemo(
    () =>
      measurePerformance("canvas-render-scope", () => resolveCanvasRenderScope({
          graph,
          viewport,
          canvasSize: dimensions,
          viewFilters,
          nodeBounds: scopeNodeGeometries,
          subgraphBounds: scopeSubgraphGeometries,
          geometryIndex,
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
        }), { nodes: graph.nodes.length, edges: visibleEdges.length }),
    [
      connectionInvalidNodeId,
      connectionInvalidSubgraphId,
      connectionTargetNodeId,
      connectionTargetSubgraphId,
      dimensions,
      graph,
      geometryIndex,
      hoveredEdgeId,
      hoveredNodeId,
      hoveredSubgraphId,
      inlineEdit,
      interactionState,
      scopeNodeGeometries,
      scopeSubgraphGeometries,
      selection,
      viewFilters,
      viewport,
      visibleEdges
    ]
  );
  const warmRenderScope = useMemo(
    () => resolveCanvasRenderScope({
      graph,
      viewport,
      canvasSize: dimensions,
      viewFilters,
      nodeBounds: scopeNodeGeometries,
      subgraphBounds: scopeSubgraphGeometries,
      geometryIndex,
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
      connectionInvalidSubgraphId,
      overscanPx: DEFAULT_CANVAS_IMAGE_WARM_SCOPE_OVERSCAN_PX
    }),
    [
      connectionInvalidNodeId,
      connectionInvalidSubgraphId,
      connectionTargetNodeId,
      connectionTargetSubgraphId,
      dimensions,
      graph,
      geometryIndex,
      hoveredEdgeId,
      hoveredNodeId,
      hoveredSubgraphId,
      inlineEdit,
      interactionState,
      scopeNodeGeometries,
      scopeSubgraphGeometries,
      selection,
      viewFilters,
      viewport,
      visibleEdges
    ]
  );
  const scopedRenderedNodes = useMemo(() => renderedNodes.filter((node) => renderScope.nodeIds.has(node.id)), [renderScope, renderedNodes]);
  const warmRenderedNodes = useMemo(() => renderedNodes.filter((node) => warmRenderScope.nodeIds.has(node.id)), [renderedNodes, warmRenderScope]);
  const scopedRenderedNodeGeometries = useMemo(
    () => scopedRenderedNodes.flatMap((node) => {
      const geometry = nodeGeometryById.get(node.id);
      return geometry ? [geometry] : [];
    }),
    [nodeGeometryById, scopedRenderedNodes]
  );
  const scopedSubgraphGeometries = useMemo(
    () => renderedSubgraphGeometries.filter((geometry) => renderScope.subgraphIds.has(geometry.id)),
    [renderScope, renderedSubgraphGeometries]
  );
  const scopedVisibleEdges = useMemo(() => visibleEdges.filter((edge) => renderScope.edgeIds.has(edge.id)), [renderScope, visibleEdges]);
  const draggingEntityIds = useMemo(() => {
    if (interactionState.kind === "draggingNodes") {
      return new Set(selectedNodeIds.has(interactionState.nodeId) ? selection.nodeIds : [interactionState.nodeId]);
    }
    if (interactionState.kind === "draggingSubgraphs") {
      const subgraphIds = selectedSubgraphIds.has(interactionState.subgraphId)
        ? [...selectedSubgraphIds]
        : [interactionState.subgraphId];
      return new Set([
        ...subgraphIds,
        ...subgraphIds.flatMap((id) => descendantSubgraphIds(graph, id)),
        ...subgraphIds.flatMap((id) => descendantNodeIds(graph, id))
      ]);
    }
    return new Set<string>();
  }, [graph, interactionState, selectedNodeIds, selectedSubgraphIds, selection.nodeIds]);
  const dragPreviewEdges = useMemo(
    () => draggingEntityIds.size === 0
      ? []
      : scopedVisibleEdges.filter((edge) => draggingEntityIds.has(edge.from) || draggingEntityIds.has(edge.to)),
    [draggingEntityIds, scopedVisibleEdges]
  );
  const staticScopedVisibleEdges = useMemo(
    () => dragPreviewEdges.length === 0
      ? scopedVisibleEdges
      : scopedVisibleEdges.filter((edge) => !dragPreviewEdges.includes(edge)),
    [dragPreviewEdges, scopedVisibleEdges]
  );
  const parallelEdgeLaneById = useMemo(
    () => resolveParallelEdgeLanes(visibleEdges, baseRoutedEntityRects, { laneSpacing: parallelEdgeLaneSpacing }),
    [baseRoutedEntityRects, parallelEdgeLaneSpacing, visibleEdges]
  );
  const fallbackEdgeGeometryById = useMemo(
    () => measurePerformance("canvas-edge-routing", () => resolveCachedEdgeGeometries({
      cache: edgeGeometryCacheRef.current,
      edges: staticScopedVisibleEdges,
      rectById: routedEntityRectById,
      routing: draftEdgeRouting,
      lanes: parallelEdgeLaneById,
      curveSegments: edgeCurveSegments
    }), { edges: staticScopedVisibleEdges.length }),
    [draftEdgeRouting, edgeCurveSegments, parallelEdgeLaneById, routedEntityRectById, staticScopedVisibleEdges]
  );
  const proximityEdgeIds = useMemo(() => resolveCanvasProximityEdgeIds(staticScopedVisibleEdges, nodeProximityScale), [nodeProximityScale, staticScopedVisibleEdges]);
  const proximityEdgeGeometryById = useMemo(() => {
    if (proximityEdgeIds.size === 0) return new Map<string, EdgePathGeometry>();

    const proximityRectById = new Map(routedEntityRectById);
    for (const geometry of scopedRenderedNodeGeometries) {
      const scale = nodeProximityScale[geometry.id] ?? 1;
      if (scale > 1) proximityRectById.set(geometry.id, scaleRectFromCenter(geometry.routedRect, scale));
    }
    const geometryById = new Map<string, EdgePathGeometry>();
    for (const edge of staticScopedVisibleEdges) {
      if (!proximityEdgeIds.has(edge.id)) continue;
      const geometry = computeEdgePathFromRectMap(edge, proximityRectById, draftEdgeRouting, { lane: parallelEdgeLaneById.get(edge.id), curveSegments: edgeCurveSegments });
      if (geometry) geometryById.set(edge.id, geometry);
    }
    return geometryById;
  }, [draftEdgeRouting, edgeCurveSegments, nodeProximityScale, parallelEdgeLaneById, proximityEdgeIds, routedEntityRectById, scopedRenderedNodeGeometries, staticScopedVisibleEdges]);
  const edgeGeometryById = useMemo(
    () => resolveFinalEdgeGeometryMap({
      edges: staticScopedVisibleEdges,
      fallbackGeometryById: fallbackEdgeGeometryById,
      proximityGeometryById: proximityEdgeGeometryById,
      mermaidRouteByEdgeId,
      layoutMode
    }),
    [fallbackEdgeGeometryById, layoutMode, mermaidRouteByEdgeId, proximityEdgeGeometryById, staticScopedVisibleEdges]
  );

  const resolveDragEdgeGeometryMap = useCallback((snapshot: CanvasDragPreviewSnapshot) => {
    const rectById = new Map(routedEntityRectById);
    for (const [id, position] of Object.entries(snapshot.nodePositions)) {
      const node = graphNodeById.get(id);
      const rect = baseNodeGeometryById.get(id)?.routedRect;
      if (node && rect) rectById.set(id, { ...rect, x: rect.x + position.x - node.x, y: rect.y + position.y - node.y });
    }
    for (const [id, position] of Object.entries(snapshot.subgraphPositions)) {
      const geometry = subgraphGeometryById.get(id);
      if (geometry) rectById.set(id, {
        ...geometry.routedRect,
        x: geometry.routedRect.x + position.x - geometry.frame.x,
        y: geometry.routedRect.y + position.y - geometry.frame.y
      });
    }
    const geometries = new Map<string, EdgePathGeometry>();
    for (const edge of dragPreviewEdges) {
      const geometry = computeEdgePathFromRectMap(edge, rectById, draftEdgeRouting, {
        lane: parallelEdgeLaneById.get(edge.id),
        curveSegments: edgeCurveSegments
      });
      if (geometry) geometries.set(edge.id, geometry);
    }
    return geometries;
  }, [baseNodeGeometryById, draftEdgeRouting, dragPreviewEdges, edgeCurveSegments, graphNodeById, parallelEdgeLaneById, routedEntityRectById, subgraphGeometryById]);

  function resolvedEdgeGeometry(edge: CanvasEdge) {
    return edgeGeometryById.get(edge.id) || null;
  }

  const selectedSingleEdge = selection.edgeIds.length === 1 ? visibleEdges.find((edge) => edge.id === selection.edgeIds[0]) : undefined;
  const selectedSingleEdgeBaseGeometry = selectedSingleEdge ? resolvedEdgeGeometry(selectedSingleEdge) : null;
  const connectionDraftGeometry = useMemo(() => {
    if (!connectionDraft || !connectionPreview) return null;
    const sourceRect = routedEntityRectById.get(connectionDraft.fromId);
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
      return computePreviewEdgeGeometry(draftEdge, undefined, parallelEdgesByPair, routedEntityRectById, draftEdgeRouting, parallelEdgeLaneSpacing, edgeCurveSegments)
        || computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, draftEdgeRouting, { curveSegments: edgeCurveSegments });
    }

    return computeEdgeDraftPath(sourceRect, connectionPreview.geometryTarget, draftEdgeRouting, { curveSegments: edgeCurveSegments });
  }, [connectionDraft, connectionPreview, draftEdgeRouting, edgeCurveSegments, parallelEdgeLaneSpacing, parallelEdgesByPair, routedEntityRectById]);
  const retargetDraftGeometry = useMemo(() => {
    if (!retargetDraft || !retargetPreview) return null;
    const edge = graph.edges.find((item) => item.id === retargetDraft.edgeId);
    if (!edge) return null;

    if (retargetPreview.valid && retargetPreview.targetId) {
      const anchorKey = retargetDraft.side === "from" ? "fromAnchor" : "toAnchor";
      const retargetedEdge = { ...edge, [retargetDraft.side]: retargetPreview.targetId, [anchorKey]: retargetPreview.targetAnchor || undefined };
      return computePreviewEdgeGeometry(retargetedEdge, edge.id, parallelEdgesByPair, routedEntityRectById, draftEdgeRouting, parallelEdgeLaneSpacing, edgeCurveSegments)
        || computeEdgeRetargetPath(edge, routedEntityRects, retargetDraft.side, retargetPreview.geometryTarget, draftEdgeRouting, { curveSegments: edgeCurveSegments });
    }

    return computeEdgeRetargetPath(edge, routedEntityRects, retargetDraft.side, retargetPreview.geometryTarget, draftEdgeRouting, { curveSegments: edgeCurveSegments });
  }, [draftEdgeRouting, edgeCurveSegments, graph.edges, parallelEdgeLaneSpacing, parallelEdgesByPair, retargetDraft, retargetPreview, routedEntityRectById, routedEntityRects]);
  const selectedSingleEdgeGeometry = retargetDraft?.edgeId === selectedSingleEdge?.id && retargetDraftGeometry ? retargetDraftGeometry : selectedSingleEdgeBaseGeometry;

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
    geometryIndex,
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
    warmRenderedNodes,
    scopedRenderedNodeGeometries,
    scopedSubgraphGeometries,
    scopedVisibleEdges: staticScopedVisibleEdges,
    dragPreviewEdges,
    resolveDragEdgeGeometryMap,
    connectionAnchorSnapRadiusWorld
  };
}

function groupEdgesByPair(edges: CanvasEdge[]) {
  const groups = new Map<string, CanvasEdge[]>();
  for (const edge of edges) {
    const key = edgePairKey(edge.from, edge.to);
    const group = groups.get(key);
    if (group) group.push(edge);
    else groups.set(key, [edge]);
  }
  return groups;
}

function computePreviewEdgeGeometry(
  edge: CanvasEdge,
  replacedEdgeId: string | undefined,
  edgesByPair: Map<string, CanvasEdge[]>,
  rectById: Map<string, RoutedNodeRect>,
  routing: EdgeRouting,
  laneSpacing: number,
  curveSegments: number
) {
  if (!rectById.has(edge.from) || !rectById.has(edge.to)) return null;
  const parallelEdges = edgesByPair.get(edgePairKey(edge.from, edge.to)) || [];
  const replacesEdgeInSamePair = Boolean(replacedEdgeId && parallelEdges.some((candidate) => candidate.id === replacedEdgeId));
  const candidates = replacesEdgeInSamePair
    ? parallelEdges.map((candidate) => candidate.id === replacedEdgeId ? edge : candidate)
    : [...parallelEdges.filter((candidate) => candidate.id !== replacedEdgeId), edge];
  const endpointIds = new Set(candidates.flatMap((candidate) => [candidate.from, candidate.to]));
  const endpointRects = [...endpointIds].map((id) => rectById.get(id)).filter((rect): rect is RoutedNodeRect => Boolean(rect));
  const lanes = resolveParallelEdgeLanes(candidates, endpointRects, { laneSpacing });
  return computeEdgePathFromRectMap(edge, rectById, routing, { lane: lanes.get(edge.id), curveSegments });
}

function edgePairKey(from: string, to: string) {
  return from <= to ? JSON.stringify([from, to]) : JSON.stringify([to, from]);
}
