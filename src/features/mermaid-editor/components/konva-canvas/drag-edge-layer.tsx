import { useMemo, useSyncExternalStore } from "react";

import { KonvaEdgeLayer } from "@/features/mermaid-editor/components/konva-canvas/edge-layer";
import type { KonvaCanvasStageProps } from "@/features/mermaid-editor/components/konva-canvas/konva-canvas-stage-types";

type DragEdgeLayerProps = Pick<KonvaCanvasStageProps,
  | "dragPreviewStore"
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
  dragPreviewStore,
  dragPreviewEdges,
  resolveDragEdgeGeometryMap,
  ...props
}: DragEdgeLayerProps) {
  const snapshot = useSyncExternalStore(dragPreviewStore.subscribe, dragPreviewStore.getSnapshot, () => null);
  const geometryById = useMemo(
    () => snapshot ? resolveDragEdgeGeometryMap(snapshot) : new Map(),
    [resolveDragEdgeGeometryMap, snapshot]
  );
  if (!snapshot || dragPreviewEdges.length === 0) return null;

  return <KonvaEdgeLayer
    {...props}
    edgeMotion={{}}
    scopedVisibleEdges={dragPreviewEdges}
    resolvedEdgeGeometry={(edge) => geometryById.get(edge.id) ?? null}
  />;
}
