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
  | "dragPreviewStore"
>;

export function KonvaDragEdgeLayer({
  dragPreviewStore,
  dragPreviewEdges,
  resolveDragEdgeGeometryMap,
  ...props
}: DragEdgeLayerProps) {
  const geometryById = useMemo(
    () => resolveDragEdgeGeometryMap(dragPreviewStore.getSnapshot() ?? EMPTY_DRAG_PREVIEW),
    [dragPreviewStore, resolveDragEdgeGeometryMap]
  );
  if (dragPreviewEdges.length === 0) return null;

  return <KonvaEdgeLayer
    {...props}
    edgeMotion={{}}
    scopedVisibleEdges={dragPreviewEdges}
    resolvedEdgeGeometry={(edge) => geometryById.get(edge.id) ?? null}
  />;
}

const EMPTY_DRAG_PREVIEW: CanvasDragPreviewSnapshot = { nodePositions: {}, subgraphPositions: {}, guides: [] };
