import type Konva from "konva";
import type { RefObject } from "react";
import { useMemo } from "react";

import { AlignmentGuideOverlay } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { CanvasActiveDragVisuals } from "@/features/mermaid-editor/components/konva-canvas/active-drag-visuals";
import { KonvaDragEdgeLayer } from "@/features/mermaid-editor/components/konva-canvas/drag-edge-layer";
import { KonvaEdgeOverlayLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import { CanvasConnectionAnchorOverlay } from "@/features/mermaid-editor/components/konva-canvas/connection-anchor-overlay";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";

export function KonvaInteractionLayerContent({
  sceneLayerRef,
  interactionLayerRef,
  stageProps
}: {
  sceneLayerRef: RefObject<Konva.Layer | null>;
  interactionLayerRef: RefObject<Konva.Layer | null>;
  stageProps: KonvaCanvasStageProps;
}) {
  const {
    viewFilters, mode, selection, inlineEdit, interactionState,
    hoveredNodeId, hoveredEdgeId, hoveredHitTarget, visualTokens, dragPreviewStore,
    dragPreviewEdges, resolveDragEdgeGeometryMap, edgeLabelThemeTokens, edgeLabelSpec,
    retargetDraft, retargetDraftGeometry, retargetPreview, connectionDraftGeometry, connectionDraftVisual, selectionBox,
    selectedSingleEdge, selectedSingleEdgeGeometry, alignmentGuides,
    nodeMotion, nodeProximityScale, connectionTargetNodeId, connectionInvalidNodeId,
    connectionTargetSubgraphId, connectionInvalidSubgraphId, connectionPreview,
    nodeGeometryById, scopedSubgraphGeometries
  } = stageProps;
  const hoveredTableNodeId = hoveredHitTarget.kind === "tableCell" || hoveredHitTarget.kind === "tableHeader"
    ? hoveredNodeId
    : null;
  const activeNodeIds = useMemo(() => [...new Set([
    ...selection.nodeIds,
    ...Object.keys(nodeMotion),
    ...Object.entries(nodeProximityScale).filter(([, scale]) => Math.abs(scale - 1) > 0.0001).map(([id]) => id),
    hoveredTableNodeId, connectionTargetNodeId, connectionInvalidNodeId,
    inlineEdit?.type === "node" || inlineEdit?.type === "tableCell" || inlineEdit?.type === "tableHeader" ? inlineEdit.id : null
  ].filter((id): id is string => Boolean(id)))] , [connectionInvalidNodeId, connectionTargetNodeId, hoveredTableNodeId, inlineEdit, nodeMotion, nodeProximityScale, selection.nodeIds]);
  const activeSubgraphIds = useMemo(() => [...new Set([
    ...(selection.subgraphIds || []),
    connectionTargetSubgraphId, connectionInvalidSubgraphId,
    inlineEdit?.type === "subgraph" ? inlineEdit.id : null
  ].filter((id): id is string => Boolean(id)))] , [connectionInvalidSubgraphId, connectionTargetSubgraphId, inlineEdit, selection.subgraphIds]);

  return <>
    <CanvasActiveDragVisuals
      sceneLayerRef={sceneLayerRef}
      activeLayerRef={interactionLayerRef}
      dragPreviewStore={dragPreviewStore}
      activeNodeIds={activeNodeIds}
      activeSubgraphIds={activeSubgraphIds}
    />
    <KonvaDragEdgeLayer
      dragPreviewStore={dragPreviewStore}
      dragPreviewEdges={dragPreviewEdges}
      resolveDragEdgeGeometryMap={resolveDragEdgeGeometryMap}
      viewFilters={viewFilters}
      selection={selection}
      hoveredEdgeId={hoveredEdgeId}
      interactionState={interactionState}
      inlineEdit={inlineEdit}
      visualTokens={visualTokens}
      edgeLabelThemeTokens={edgeLabelThemeTokens}
      edgeLabelSpec={edgeLabelSpec}
    />
    <KonvaEdgeOverlayLayer
      viewFilters={viewFilters}
      mode={mode}
      hoveredHitTarget={hoveredHitTarget}
      visualTokens={visualTokens}
      retargetDraft={retargetDraft}
      connectionDraftGeometry={connectionDraftGeometry}
      connectionDraftVisual={connectionDraftVisual}
      selectionBox={selectionBox}
      selectedSingleEdge={selectedSingleEdge}
      selectedSingleEdgeGeometry={selectedSingleEdgeGeometry}
      retargetDraftGeometry={retargetDraftGeometry}
      retargetPreview={retargetPreview}
    />
    <CanvasConnectionAnchorOverlay
      hoveredHitTarget={hoveredHitTarget}
      connectionPreview={connectionPreview}
      retargetPreview={retargetPreview}
      nodeGeometryById={nodeGeometryById}
      subgraphGeometries={scopedSubgraphGeometries}
      nodeProximityScale={nodeProximityScale}
      visualTokens={visualTokens}
    />
    {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} visualTokens={visualTokens} /> : null}
  </>;
}
