import type Konva from "konva";
import type { RefObject } from "react";

import { AlignmentGuideOverlay } from "@/features/mermaid-editor/components/konva-canvas/canvas-overlays";
import { KonvaDragEdgeLayer } from "@/features/mermaid-editor/components/konva-canvas/drag-edge-layer";
import { KonvaEdgeOverlayLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";
import { KonvaNodeHitLayer } from "@/features/mermaid-editor/components/konva-canvas/node-hit-layer";

export function KonvaInteractionLayerContent({
  nodeLayerRef,
  interactionLayerRef,
  stageProps
}: {
  nodeLayerRef: RefObject<Konva.Layer | null>;
  interactionLayerRef: RefObject<Konva.Layer | null>;
  stageProps: KonvaCanvasStageProps;
}) {
  const {
    viewFilters, mode, panningRequested, dragEnabled, selection, inlineEdit, interactionState,
    hoveredNodeId, hoveredEdgeId, hoveredHitTarget, connectionPreview, retargetPreview,
    scopedRenderedNodes, nodeGeometryById, nodeProximityScale, visualTokens, dragPreviewStore,
    dragPreviewEdges, resolveDragEdgeGeometryMap, edgeLabelThemeTokens, edgeLabelSpec,
    retargetDraft, connectionDraftGeometry, connectionDraftVisual, selectionBox,
    selectedSingleEdge, selectedSingleEdgeGeometry, alignmentGuides, onStartNodeDrag,
    onMoveNode, onEndDrag, onCanvasClick, onCanvasDoubleClick, onCanvasTap,
    onNodeContextMenu, onOpenNodeAction, onCanvasPointerDown
  } = stageProps;

  return <>
    {viewFilters.nodes ? <KonvaNodeHitLayer
      nodeLayerRef={nodeLayerRef}
      interactionLayerRef={interactionLayerRef}
      mode={mode}
      panningRequested={panningRequested}
      dragEnabled={dragEnabled}
      selection={selection}
      inlineEdit={inlineEdit}
      interactionState={interactionState}
      hoveredNodeId={hoveredNodeId}
      connectionPreview={connectionPreview}
      retargetPreview={retargetPreview}
      scopedRenderedNodes={scopedRenderedNodes}
      nodeGeometryById={nodeGeometryById}
      nodeProximityScale={nodeProximityScale}
      visualTokens={visualTokens}
      dragPreviewStore={dragPreviewStore}
      onStartNodeDrag={onStartNodeDrag}
      onMoveNode={onMoveNode}
      onEndDrag={onEndDrag}
      onCanvasClick={onCanvasClick}
      onCanvasDoubleClick={onCanvasDoubleClick}
      onNodeContextMenu={onNodeContextMenu}
      onNodeAnchorPointerDown={(event, hit, world) => onCanvasPointerDown(event, hit, world)}
      onOpenNodeAction={onOpenNodeAction}
    /> : null}
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
      onCanvasClick={onCanvasClick}
      onCanvasDoubleClick={onCanvasDoubleClick}
      onCanvasTap={onCanvasTap}
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
      onEdgeEndpointPointerDown={(event, hit) => onCanvasPointerDown(event, hit)}
    />
    {alignmentGuides.length ? <AlignmentGuideOverlay guides={alignmentGuides} visualTokens={visualTokens} /> : null}
  </>;
}
