import { Arrow, Circle, Group, Path, Rect, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

import { EdgeMarkers, PathArrowHead } from "@/features/mermaid-editor/components/konva-canvas/edge-markers";
import { normalizeBox } from "@/features/mermaid-editor/components/konva-canvas/render-utils";
import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { CanvasEdgeMotionVisual } from "@/features/mermaid-editor/components/konva-canvas/types";
import type { HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  edgeEndpointHitId,
  edgeHitId,
  edgeLabelHitId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
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
  retargetDraft: RenderModel["retargetDraft"];
  retargetDraftGeometry: RenderModel["retargetDraftGeometry"];
  retargetPreview: RenderModel["retargetPreview"];
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasTap: (event: KonvaEventObject<Event>, hit: HitTarget) => void;
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
  onEdgeEndpointPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
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
  resolvedEdgeGeometry,
  retargetDraft,
  retargetDraftGeometry,
  retargetPreview,
  onCanvasClick,
  onCanvasDoubleClick,
  onCanvasTap
}: KonvaEdgeLayerProps) {
  return (
    <>
      {scopedVisibleEdges.map((edge) => {
        const baseGeometry = resolvedEdgeGeometry(edge);
        if (!baseGeometry) return null;
        const isRetargetPreviewEdge = retargetDraft?.edgeId === edge.id && !!retargetDraftGeometry && !!retargetPreview;
        const geometry = isRetargetPreviewEdge ? retargetDraftGeometry : baseGeometry;
        const edgeVisual = getEdgeVisualState({ edge, selection, hoveredEdgeId, interactionState, inlineEdit, visualTokens });
        const edgePreviewVisual = isRetargetPreviewEdge ? getConnectionDraftVisualState({ valid: retargetPreview.valid, edge, visualTokens }) : null;
        const edgeMotionVisual = edgeMotion[edge.id];
        const edgeStrokeWidth = (edgePreviewVisual?.strokeWidth ?? edgeVisual.strokeWidth) + (edgeMotionVisual?.highlight ?? 0) * visualTokens.edge.highlightBorderBoost;
        const edgeStrokeEnabled = edgePreviewVisual?.strokeEnabled ?? edgeVisual.strokeEnabled;
        const isEditingEdgeLabel = inlineEdit?.type === "edge" && inlineEdit.id === edge.id;
        const edgeLabel = isEditingEdgeLabel ? inlineEdit.value : edge.label;
        const edgeLabelGeometry = edgeLabel || isEditingEdgeLabel ? buildEdgeLabelGeometry(edgeLabel, geometry.labelPoint, edgeLabelSpec) : null;

        return (
          <Group key={edge.id}>
            {geometry.pathData ? (
              <>
                <Path
                  id={edgeHitId(edge.id)}
                  name={CANVAS_HIT_NAMES.edge}
                  data={geometry.pathData}
                  stroke="transparent"
                  strokeWidth={visualTokens.edge.hitStrokeWidth}
                  fillEnabled={false}
                  onClick={(event) => onCanvasClick(event, { kind: "edge", id: edge.id })}
                  onDblClick={(event) => onCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                  onTap={(event) => onCanvasTap(event, { kind: "edge", id: edge.id })}
                />
                <Path
                  data={geometry.pathData}
                  stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                  strokeWidth={edgeStrokeWidth}
                  strokeEnabled={edgeStrokeEnabled}
                  dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                  opacity={edgePreviewVisual?.opacity ?? edgeVisual.opacity ?? 1}
                  lineCap="round"
                  lineJoin="round"
                  fillEnabled={false}
                  listening={false}
                />
              </>
            ) : (
              <>
                <Arrow
                  id={edgeHitId(edge.id)}
                  name={CANVAS_HIT_NAMES.edge}
                  points={geometry.points}
                  stroke="transparent"
                  fill="transparent"
                  strokeWidth={visualTokens.edge.hitStrokeWidth}
                  pointerLength={0}
                  pointerWidth={0}
                  onClick={(event) => onCanvasClick(event, { kind: "edge", id: edge.id })}
                  onDblClick={(event) => onCanvasDoubleClick(event, { kind: "edge", id: edge.id })}
                  onTap={(event) => onCanvasTap(event, { kind: "edge", id: edge.id })}
                />
                <Arrow
                  points={geometry.points}
                  stroke={edgePreviewVisual?.stroke ?? edgeVisual.stroke}
                  fill={edgePreviewVisual?.fill ?? edgeVisual.fill}
                  strokeWidth={edgeStrokeWidth}
                  strokeEnabled={edgeStrokeEnabled}
                  dash={edgePreviewVisual?.dash ?? edgeVisual.dash}
                  opacity={edgePreviewVisual?.opacity ?? edgeVisual.opacity ?? 1}
                  lineCap="round"
                  lineJoin="round"
                  pointerLength={0}
                  pointerWidth={0}
                  listening={false}
                />
              </>
            )}
            {!edgePreviewVisual && edgeVisual.strokeEnabled ? (
              <EdgeMarkers edge={edge} geometry={geometry} stroke={edgeVisual.stroke} strokeWidth={edgeStrokeWidth} surfaceFill={visualTokens.surface.background} visualTokens={visualTokens} />
            ) : null}
            {viewFilters.edgeLabels && edgeLabelGeometry && !isEditingEdgeLabel ? (
              <Group
                id={edgeLabelHitId(edge.id)}
                name={CANVAS_HIT_NAMES.edgeLabel}
                x={edgeLabelGeometry.frame.x}
                y={edgeLabelGeometry.frame.y}
                onClick={(event) => onCanvasClick(event, { kind: "edgeLabel", id: edge.id })}
                onDblClick={(event) => onCanvasDoubleClick(event, { kind: "edgeLabel", id: edge.id })}
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
  onEdgeEndpointPointerDown
}: KonvaEdgeOverlayLayerProps) {
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
            id={edgeEndpointHitId(selectedSingleEdge.id, "from")}
            name={CANVAS_HIT_NAMES.edgeEndpoint}
            x={selectedSingleEdgeGeometry.start.x}
            y={selectedSingleEdgeGeometry.start.y}
            {...getEdgeEndpointVisualState({
              hovered: hoveredEdgeEndpoint(hoveredHitTarget, selectedSingleEdge.id, "from"),
              active: activeEdgeEndpoint(retargetDraft, "from", selectedSingleEdge.id),
              visualTokens
            })}
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onEdgeEndpointPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "from" });
            }}
          />
          <Circle
            id={edgeEndpointHitId(selectedSingleEdge.id, "to")}
            name={CANVAS_HIT_NAMES.edgeEndpoint}
            x={selectedSingleEdgeGeometry.end.x}
            y={selectedSingleEdgeGeometry.end.y}
            {...getEdgeEndpointVisualState({
              hovered: hoveredEdgeEndpoint(hoveredHitTarget, selectedSingleEdge.id, "to"),
              active: activeEdgeEndpoint(retargetDraft, "to", selectedSingleEdge.id),
              visualTokens
            })}
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onEdgeEndpointPointerDown(event, { kind: "edgeEndpoint", edgeId: selectedSingleEdge.id, side: "to" });
            }}
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
