import { Circle, Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import {
  CANVAS_HIT_NAMES,
  subgraphAnchorHitId,
  subgraphHitId,
  subgraphTitleHitId
} from "@/features/mermaid-editor/lib/canvas-hit-target";
import type { EditorMode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import {
  canvasStrokeDash,
  canvasStrokeEnabled,
  getGroupVisualState,
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;
type RenderedSubgraphGeometry = RenderModel["scopedSubgraphGeometries"][number];
type SubgraphAnchor = RenderedSubgraphGeometry["anchorsLocal"][number];

type KonvaSubgraphLayerProps = {
  graph: MermaidGraph;
  mode: EditorMode;
  panningRequested: boolean;
  dragEnabled: boolean;
  inlineEdit: InlineEdit | null;
  interactionState: InteractionState;
  scopedSubgraphGeometries: RenderModel["scopedSubgraphGeometries"];
  selectedSubgraphIds: RenderModel["selectedSubgraphIds"];
  hoveredSubgraphId: string | null;
  connectionTargetSubgraphId: string | null;
  connectionInvalidSubgraphId: string | null;
  connectionPreview: RenderModel["connectionPreview"];
  retargetPreview: RenderModel["retargetPreview"];
  visualTokens: CanvasVisualTokens;
  typography: TypographyRoleTokens;
  onStartSubgraphDrag: (subgraphId: string) => void;
  onMoveSubgraph: (subgraphId: string, target: Konva.Node) => void;
  onEndDrag: () => void;
  onCanvasClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onCanvasDoubleClick: (event: KonvaEventObject<MouseEvent>, hit: HitTarget) => void;
  onSubgraphAnchorPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget, world: CanvasPoint) => void;
};

export function KonvaSubgraphLayer({
  graph,
  mode,
  panningRequested,
  dragEnabled,
  inlineEdit,
  interactionState,
  scopedSubgraphGeometries,
  selectedSubgraphIds,
  hoveredSubgraphId,
  connectionTargetSubgraphId,
  connectionInvalidSubgraphId,
  connectionPreview,
  retargetPreview,
  visualTokens,
  typography,
  onStartSubgraphDrag,
  onMoveSubgraph,
  onEndDrag,
  onCanvasClick,
  onCanvasDoubleClick,
  onSubgraphAnchorPointerDown
}: KonvaSubgraphLayerProps) {
  return (
    <>
      {[...scopedSubgraphGeometries]
        .sort((a, b) => a.depth - b.depth)
        .map((geometry) => {
          const subgraph = graph.subgraphs?.find((item) => item.id === geometry.id);
          if (!subgraph) return null;
          const selected = selectedSubgraphIds.has(geometry.id);
          const hovered = hoveredSubgraphId === geometry.id;
          const isEditingSubgraphTitle = inlineEdit?.type === "subgraph" && inlineEdit.id === geometry.id;
          const connectionTarget = connectionTargetSubgraphId === geometry.id;
          const connectionInvalid = connectionInvalidSubgraphId === geometry.id;
          const connectionAnchorTarget = subgraphConnectionAnchorTarget(geometry.id, connectionPreview, retargetPreview);
          const connectionAnchorsVisible = subgraphConnectionAnchorsVisible(geometry.id, connectionPreview, retargetPreview);
          const groupVisual = getGroupVisualState({ hovered, selected, connectionTarget, connectionInvalid, visualTokens });
          const group = visualTokens.group;
          const title = group.title;
          const anchorVisible =
            mode === "select" &&
            !inlineEdit &&
            (selected || hovered || connectionAnchorsVisible) &&
            interactionState.kind !== "panning" &&
            interactionState.kind !== "draggingNodes" &&
            interactionState.kind !== "draggingSubgraphs";

          return (
            <Group
              id={subgraphHitId(geometry.id)}
              name={CANVAS_HIT_NAMES.subgraph}
              key={geometry.id}
              x={geometry.frame.x}
              y={geometry.frame.y}
              draggable={dragEnabled && mode === "select" && !panningRequested && interactionState.kind !== "panning"}
              onDragStart={(event) => {
                if (event.evt.button !== 0) {
                  event.target.stopDrag();
                  return;
                }
                onStartSubgraphDrag(geometry.id);
              }}
              onDragMove={(event) => onMoveSubgraph(geometry.id, event.target)}
              onDragEnd={onEndDrag}
              onClick={(event) => onCanvasClick(event, { kind: "subgraph", id: geometry.id })}
              onDblClick={(event) => onCanvasDoubleClick(event, { kind: "subgraph", id: geometry.id })}
            >
              <Rect
                width={geometry.frame.width}
                height={geometry.frame.height}
                cornerRadius={group.radius}
                fill={groupVisual.fill}
                opacity={groupVisual.fillOpacity}
                shadowColor={groupVisual.shadow.color}
                shadowBlur={groupVisual.shadow.blur}
                shadowOpacity={groupVisual.shadow.opacity}
                shadowOffsetX={groupVisual.shadow.offsetX}
                shadowOffsetY={groupVisual.shadow.offsetY}
                shadowEnabled={groupVisual.shadow.opacity > 0}
                listening={false}
              />
              <Rect
                width={geometry.frame.width}
                height={geometry.frame.height}
                cornerRadius={group.radius}
                stroke={groupVisual.stroke}
                strokeWidth={groupVisual.strokeWidth}
                strokeEnabled={groupVisual.strokeEnabled}
                dash={groupVisual.dash}
                fillEnabled={false}
              />
              <Rect
                id={subgraphTitleHitId(geometry.id)}
                name={CANVAS_HIT_NAMES.subgraphTitle}
                x={geometry.titleBox.x - geometry.frame.x}
                y={geometry.titleBox.y - geometry.frame.y}
                width={geometry.titleBox.width}
                height={geometry.titleBox.height}
                cornerRadius={title.radius}
                fill={title.backgroundEnabled ? title.background : "rgba(0, 0, 0, 0)"}
                stroke={title.borderColor}
                strokeWidth={title.borderWidth}
                strokeEnabled={canvasStrokeEnabled(title.borderStyle)}
                dash={canvasStrokeDash(title.borderStyle, title.customDash)}
                shadowColor={title.shadow.color}
                shadowBlur={title.shadow.blur}
                shadowOpacity={title.shadow.opacity}
                shadowOffsetX={title.shadow.offsetX}
                shadowOffsetY={title.shadow.offsetY}
                shadowEnabled={title.shadow.opacity > 0}
                onClick={(event) => onCanvasClick(event, { kind: "subgraphTitle", id: geometry.id })}
                onDblClick={(event) => onCanvasDoubleClick(event, { kind: "subgraphTitle", id: geometry.id })}
              />
              <Text
                x={geometry.titleBox.x - geometry.frame.x + title.paddingX}
                y={geometry.titleBox.y - geometry.frame.y}
                width={Math.max(1, geometry.titleBox.width - title.paddingX * 2)}
                height={geometry.titleBox.height}
                align="left"
                verticalAlign="middle"
                text={subgraph.title || subgraph.id}
                fontSize={typography.fontSize}
                fontStyle={String(typography.fontWeight)}
                fontFamily={typography.family}
                lineHeight={typography.lineHeight / typography.fontSize}
                letterSpacing={typography.letterSpacing}
                fill={title.textColor}
                ellipsis
                listening={false}
                visible={!isEditingSubgraphTitle}
              />
              {anchorVisible
                ? geometry.anchorsLocal.map((anchor) => (
                    <SubgraphAnchorHandle
                      key={`${geometry.id}-${anchor.key}`}
                      geometry={geometry}
                      anchor={anchor}
                      connectionAnchorTarget={connectionAnchorTarget}
                      visualTokens={visualTokens}
                      onPointerDown={onSubgraphAnchorPointerDown}
                    />
                  ))
                : null}
            </Group>
          );
        })}
    </>
  );
}

function SubgraphAnchorHandle({
  geometry,
  anchor,
  connectionAnchorTarget,
  visualTokens,
  onPointerDown
}: {
  geometry: RenderedSubgraphGeometry;
  anchor: SubgraphAnchor;
  connectionAnchorTarget: string | null;
  visualTokens: CanvasVisualTokens;
  onPointerDown: (event: KonvaEventObject<MouseEvent>, hit: HitTarget, world: CanvasPoint) => void;
}) {
  return (
    <Group
      id={subgraphAnchorHitId(geometry.id, anchor.key)}
      name={CANVAS_HIT_NAMES.subgraphAnchor}
      x={anchor.x}
      y={anchor.y}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onPointerDown(
          event,
          { kind: "subgraphAnchor", subgraphId: geometry.id, anchor: anchor.key },
          {
            x: geometry.frame.x + anchor.x,
            y: geometry.frame.y + anchor.y
          }
        );
      }}
    >
      <Circle radius={visualTokens.overlay.anchor.radius} fill="rgba(0,0,0,0.001)" strokeEnabled={false} />
      <Circle
        radius={anchor.kind === "corner" ? visualTokens.overlay.anchor.radius * visualTokens.group.anchorCornerScale : visualTokens.overlay.anchor.radius}
        fill={anchor.key === connectionAnchorTarget ? visualTokens.overlay.anchor.targetColor : visualTokens.overlay.anchor.fillColor}
        stroke={visualTokens.overlay.anchor.strokeColor}
        strokeWidth={visualTokens.overlay.anchor.strokeWidth}
        opacity={anchor.kind === "corner" ? visualTokens.group.anchorCornerOpacity : 1}
        listening={false}
      />
    </Group>
  );
}

function subgraphConnectionAnchorTarget(
  subgraphId: string,
  connectionPreview: RenderModel["connectionPreview"],
  retargetPreview: RenderModel["retargetPreview"]
) {
  if (connectionPreview?.targetSubgraphId === subgraphId || connectionPreview?.invalidSubgraphId === subgraphId) {
    return connectionPreview.targetAnchor;
  }
  if (retargetPreview?.targetSubgraphId === subgraphId || retargetPreview?.invalidSubgraphId === subgraphId) {
    return retargetPreview.targetAnchor;
  }
  return null;
}

function subgraphConnectionAnchorsVisible(
  subgraphId: string,
  connectionPreview: RenderModel["connectionPreview"],
  retargetPreview: RenderModel["retargetPreview"]
) {
  return (
    connectionPreview?.targetSubgraphId === subgraphId ||
    connectionPreview?.invalidSubgraphId === subgraphId ||
    retargetPreview?.targetSubgraphId === subgraphId ||
    retargetPreview?.invalidSubgraphId === subgraphId
  );
}
