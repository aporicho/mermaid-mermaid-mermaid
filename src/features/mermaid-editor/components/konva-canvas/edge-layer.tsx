import { Arrow, Circle, Group, Path, Rect, Text } from "react-konva";

import { EdgeMarkers, PathArrowHead } from "@/features/mermaid-editor/components/konva-canvas/edge-markers";
import { normalizeBox } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { CanvasEdgeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { EdgeLabelGeometrySpec, EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import { buildEdgeLabelGeometry, edgeLabelSingleLineText } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import {
  canvasStrokeDash,
  canvasStrokeEnabled,
  getConnectionDraftVisualState,
  getEdgeEndpointVisualState,
  getEdgeVisualState,
  getSelectionBoxVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import { edgeVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

type KonvaEdgeLayerProps = {
  viewFilters: ViewFilters;
  selection: Selection;
  hoveredEdgeId: string | null;
  interactionState: InteractionState;
  inlineEdit: InlineEdit | null;
  visualTokens: CanvasVisualTokens;
  edgeLabelThemeTokens: EdgeLabelGeometryTokens;
  edgeLabelSpec: EdgeLabelGeometrySpec;
  edgeMotion: Record<string, CanvasEdgeMotionVisual>;
  scopedVisibleEdges: RenderModel["scopedVisibleEdges"];
  resolvedEdgeGeometry: RenderModel["resolvedEdgeGeometry"];
};

type KonvaEdgeOverlayLayerProps = {
  viewFilters: ViewFilters;
  mode: EditorMode;
  hoveredHitTarget: HitTarget;
  visualTokens: CanvasVisualTokens;
  retargetDraft: RenderModel["retargetDraft"];
  connectionDraftGeometry: RenderModel["connectionDraftGeometry"];
  connectionDraftVisual: RenderModel["connectionDraftVisual"];
  selectionBox: RenderModel["selectionBox"];
  selectedSingleEdge: RenderModel["selectedSingleEdge"];
  selectedSingleEdgeGeometry: RenderModel["selectedSingleEdgeGeometry"];
  retargetDraftGeometry: RenderModel["retargetDraftGeometry"];
  retargetPreview: RenderModel["retargetPreview"];
};

export function KonvaEdgeLayer({
  viewFilters,
  selection,
  hoveredEdgeId,
  interactionState,
  inlineEdit,
  visualTokens,
  edgeLabelThemeTokens,
  edgeLabelSpec,
  edgeMotion,
  scopedVisibleEdges,
  resolvedEdgeGeometry
}: KonvaEdgeLayerProps) {
  return (
    <>
      {scopedVisibleEdges.map((edge) => {
        const baseGeometry = resolvedEdgeGeometry(edge);
        if (!baseGeometry) return null;
        const geometry = baseGeometry;
        const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit, visualTokens });
        const edgeMotionVisual = edgeMotion[edge.id];
        const edgeStrokeWidth = edgeVisual.strokeWidth + (edgeMotionVisual?.highlight ?? 0) * visualTokens.edge.highlightBorderBoost;
        const edgeStrokeEnabled = edgeVisual.strokeEnabled;
        const isEditingEdgeLabel = inlineEdit?.type === "edge" && inlineEdit.id === edge.id;
        const edgeLabel = isEditingEdgeLabel ? inlineEdit.value : edge.label;
        const edgeLabelGeometry = edgeLabel || isEditingEdgeLabel ? buildEdgeLabelGeometry(edgeLabel, geometry.labelPoint, edgeLabelSpec) : null;

        return (
          <Group key={edge.id} id={edgeVisualId(edge.id)} name="canvas-edge-visual" listening={false}>
            {geometry.pathData ? (
                <Path
                  name="canvas-edge-path"
                  data={geometry.pathData}
                  stroke={edgeVisual.stroke}
                  strokeWidth={edgeStrokeWidth}
                  strokeEnabled={edgeStrokeEnabled}
                  dash={edgeVisual.dash}
                  opacity={edgeVisual.opacity ?? 1}
                  lineCap="round"
                  lineJoin="round"
                  fillEnabled={false}
                  listening={false}
                />
            ) : (
                <Arrow
                  name="canvas-edge-path"
                  points={geometry.points}
                  stroke={edgeVisual.stroke}
                  fill={edgeVisual.fill}
                  strokeWidth={edgeStrokeWidth}
                  strokeEnabled={edgeStrokeEnabled}
                  dash={edgeVisual.dash}
                  opacity={edgeVisual.opacity ?? 1}
                  lineCap="round"
                  lineJoin="round"
                  pointerLength={0}
                  pointerWidth={0}
                  listening={false}
                />
            )}
            {edgeVisual.strokeEnabled ? (
              <EdgeMarkers edge={edge} geometry={geometry} stroke={edgeVisual.stroke} strokeWidth={edgeStrokeWidth} surfaceFill={visualTokens.surface.background} visualTokens={visualTokens} />
            ) : null}
            {viewFilters.edgeLabels && edgeLabelGeometry && !isEditingEdgeLabel ? (
              <Group
                name="canvas-edge-label"
                x={edgeLabelGeometry.frame.x}
                y={edgeLabelGeometry.frame.y}
                listening={false}
              >
                <Rect
                  width={edgeLabelGeometry.frame.width}
                  height={edgeLabelGeometry.frame.height}
                  cornerRadius={visualTokens.edgeLabel.radius}
                  fill={edgeVisual.labelFill}
                  stroke={edgeVisual.labelStroke}
                  strokeWidth={visualTokens.edgeLabel.borderWidth}
                  strokeEnabled={canvasStrokeEnabled(visualTokens.edgeLabel.borderStyle)}
                  dash={canvasStrokeDash(visualTokens.edgeLabel.borderStyle, visualTokens.edgeLabel.customDash)}
                />
                <Text
                  x={edgeLabelGeometry.textBox.x}
                  y={edgeLabelGeometry.textBox.y}
                  width={edgeLabelGeometry.textBox.width}
                  height={edgeLabelGeometry.textBox.height}
                  align="center"
                  verticalAlign="middle"
                  text={edgeLabelSingleLineText(edgeLabel)}
                  fontSize={edgeLabelThemeTokens.fontSize}
                  fontFamily={edgeLabelThemeTokens.fontFamily}
                  letterSpacing={edgeLabelThemeTokens.letterSpacing}
                  lineHeight={edgeLabelThemeTokens.lineHeight / edgeLabelThemeTokens.fontSize}
                  wrap="none"
                  fill={edgeVisual.labelTextFill}
                  ellipsis
                  listening={false}
                />
              </Group>
            ) : null}
          </Group>
        );
      })}
    </>
  );
}

export function KonvaEdgeOverlayLayer({
  viewFilters,
  mode,
  hoveredHitTarget,
  visualTokens,
  retargetDraft,
  connectionDraftGeometry,
  connectionDraftVisual,
  selectionBox,
  selectedSingleEdge,
  selectedSingleEdgeGeometry,
  retargetDraftGeometry,
  retargetPreview
}: KonvaEdgeOverlayLayerProps) {
  const retargetVisual = retargetDraftGeometry && retargetPreview && selectedSingleEdge
    ? getConnectionDraftVisualState({ valid: retargetPreview.valid, edge: selectedSingleEdge, visualTokens })
    : null;
  return (
    <>
      {connectionDraftGeometry ? (
        connectionDraftGeometry.pathData ? (
          <Group listening={false}>
            <Path
              data={connectionDraftGeometry.pathData}
              stroke={connectionDraftVisual.stroke}
              strokeWidth={connectionDraftVisual.strokeWidth}
              strokeEnabled={connectionDraftVisual.strokeEnabled}
              dash={connectionDraftVisual.dash}
              opacity={connectionDraftVisual.opacity}
              lineCap="round"
              lineJoin="round"
              fillEnabled={false}
            />
            {connectionDraftVisual.strokeEnabled ? (
              <PathArrowHead
                point={connectionDraftGeometry.end}
                tangent={connectionDraftGeometry.endTangent}
                fill={connectionDraftVisual.fill}
                length={connectionDraftVisual.pointerLength}
                width={connectionDraftVisual.pointerWidth}
              />
            ) : null}
          </Group>
        ) : (
          <Arrow points={connectionDraftGeometry.points} {...connectionDraftVisual} listening={false} />
        )
      ) : null}

      {retargetDraftGeometry && retargetVisual ? (
        retargetDraftGeometry.pathData ? (
          <Group listening={false}>
            <Path
              data={retargetDraftGeometry.pathData}
              stroke={retargetVisual.stroke}
              strokeWidth={retargetVisual.strokeWidth}
              strokeEnabled={retargetVisual.strokeEnabled}
              dash={retargetVisual.dash}
              opacity={retargetVisual.opacity}
              lineCap="round"
              lineJoin="round"
              fillEnabled={false}
            />
            {retargetVisual.strokeEnabled ? (
              <PathArrowHead point={retargetDraftGeometry.end} tangent={retargetDraftGeometry.endTangent} fill={retargetVisual.fill} length={retargetVisual.pointerLength} width={retargetVisual.pointerWidth} />
            ) : null}
          </Group>
        ) : <Arrow points={retargetDraftGeometry.points} {...retargetVisual} listening={false} />
      ) : null}

      {selectionBox ? (
        <Rect
          {...normalizeBox(selectionBox)}
          {...getSelectionBoxVisualState(visualTokens)}
          listening={false}
        />
      ) : null}

      {viewFilters.edges && mode === "select" && selectedSingleEdge && selectedSingleEdgeGeometry ? (
        <>
          <Circle
            x={selectedSingleEdgeGeometry.start.x}
            y={selectedSingleEdgeGeometry.start.y}
            {...getEdgeEndpointVisualState({
              hovered: hoveredEdgeEndpoint(hoveredHitTarget, selectedSingleEdge.id, "from"),
              active: activeEdgeEndpoint(retargetDraft, "from", selectedSingleEdge.id),
              visualTokens
            })}
            listening={false}
          />
          <Circle
            x={selectedSingleEdgeGeometry.end.x}
            y={selectedSingleEdgeGeometry.end.y}
            {...getEdgeEndpointVisualState({
              hovered: hoveredEdgeEndpoint(hoveredHitTarget, selectedSingleEdge.id, "to"),
              active: activeEdgeEndpoint(retargetDraft, "to", selectedSingleEdge.id),
              visualTokens
            })}
            listening={false}
          />
        </>
      ) : null}
    </>
  );
}

function hoveredEdgeEndpoint(hoveredHitTarget: HitTarget, edgeId: string, side: "from" | "to") {
  return hoveredHitTarget.kind === "edgeEndpoint" && hoveredHitTarget.edgeId === edgeId && hoveredHitTarget.side === side;
}

function activeEdgeEndpoint(retargetDraft: RenderModel["retargetDraft"], side: "from" | "to", edgeId: string) {
  return retargetDraft?.edgeId === edgeId && retargetDraft.side === side;
}
