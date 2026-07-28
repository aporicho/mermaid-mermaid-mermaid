import { Group, Rect, Text } from "react-konva";

import type { InlineEdit } from "@/features/mermaid-editor/components/konva-canvas/inline-edit-overlays";
import type { useKonvaRenderModel } from "@/features/mermaid-editor/components/konva-canvas/use-konva-render-model";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import {
  canvasStrokeDash,
  canvasStrokeEnabled,
  getGroupVisualState,
  type CanvasVisualTokens
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { subgraphVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";

type RenderModel = ReturnType<typeof useKonvaRenderModel>;

type KonvaSubgraphLayerProps = {
  graph: MermaidGraph;
  inlineEdit: InlineEdit | null;
  scopedSubgraphGeometries: RenderModel["scopedSubgraphGeometries"];
  selectedSubgraphIds: RenderModel["selectedSubgraphIds"];
  hoveredSubgraphId: string | null;
  connectionTargetSubgraphId: string | null;
  connectionInvalidSubgraphId: string | null;
  visualTokens: CanvasVisualTokens;
  typography: TypographyRoleTokens;
};

export function KonvaSubgraphLayer({
  graph,
  inlineEdit,
  scopedSubgraphGeometries,
  selectedSubgraphIds,
  hoveredSubgraphId,
  connectionTargetSubgraphId,
  connectionInvalidSubgraphId,
  visualTokens,
  typography
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
          const groupVisual = getGroupVisualState({ hovered, selected, connectionTarget, connectionInvalid, visualTokens });
          const group = visualTokens.group;
          const title = group.title;

          return (
            <Group
              id={subgraphVisualId(geometry.id)}
              key={geometry.id}
              x={geometry.frame.x}
              y={geometry.frame.y}
              listening={false}
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
                listening={false}
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
            </Group>
          );
        })}
    </>
  );
}
