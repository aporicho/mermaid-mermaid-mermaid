import { useMemo } from "react";

import { KonvaEdgeLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";
import type { CanvasDragPreviewSnapshot } from "@/features/mermaid-editor/components/konva-canvas/canvas-drag-preview-store";

type DragEdgeLayerProps = Pick<KonvaCanvasStageProps,
  | "dragPreviewEdges"
  | "resolveDragEdgeGeometryMap"
  | "viewFilters"
  | "selection"
  | "hoveredEdgeId"
  | "interactionState"
  | "inlineEdit"
  | "visualTokens"
  | "edgeLabelThemeTokens"
  | "edgeLabelSpec"
>;

export function KonvaDragEdgeLayer({
  dragPreview,
  dragPreviewEdges,
  resolveDragEdgeGeometryMap,
  ...props
}: DragEdgeLayerProps & { dragPreview: CanvasDragPreviewSnapshot | null }) {
  const geometryById = useMemo(
    () => dragPreview ? resolveDragEdgeGeometryMap(dragPreview) : new Map(),
    [dragPreview, resolveDragEdgeGeometryMap]
  );
  if (!dragPreview || dragPreviewEdges.length === 0) return null;

  return <KonvaEdgeLayer
    {...props}
    edgeMotion={{}}
    scopedVisibleEdges={dragPreviewEdges}
    resolvedEdgeGeometry={(edge) => geometryById.get(edge.id) ?? null}
  />;
}
