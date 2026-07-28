import { memo } from "react";
import type Konva from "konva";
import { Group, Rect } from "react-konva";

import { CanvasNodeImage } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import type { SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import { CanvasStaticCacheGroup, canvasStaticCacheKey } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";

export const CanvasNodeImageSurface = memo(function CanvasNodeImageSurface({
  src,
  nodeId,
  width,
  height,
  specialNode,
  interacting,
  visualState,
  cacheEnabled = true
}: {
  src: string;
  nodeId: string;
  width: number;
  height: number;
  specialNode: SpecialNodeThemeTokens;
  interacting: boolean;
  visualState?: SpecialNodeVisualState;
  cacheEnabled?: boolean;
}) {
  const image = specialNode.image;
  const surface = image.surface;
  const border = resolveSpecialNodeBorder(surface, image.state, visualState ?? (interacting ? "selected" : "normal"));
  return (
    <Group>
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:image-surface`}
        cacheKey={canvasStaticCacheKey(width, height, surface)}
        cacheKind="image"
        cacheEnabled={cacheEnabled && surface.shadow.opacity > 0 && surface.shadow.blur > 0}
        cachePriority={2}
      >
        <Rect
          width={width}
          height={height}
          fill={surface.background}
          cornerRadius={surface.radius}
          shadowColor={surface.shadow.color}
          shadowBlur={surface.shadow.blur}
          shadowOpacity={surface.shadow.opacity}
          shadowOffsetX={surface.shadow.offsetX}
          shadowOffsetY={surface.shadow.offsetY}
        />
      </CanvasStaticCacheGroup>
      <Group clipFunc={(context) => roundedRectClip(context, width, height, surface.radius)}>
        <CanvasNodeImage src={src} x={0} y={0} width={width} height={height} />
      </Group>
      <Rect
        width={width}
        height={height}
        fillEnabled={false}
        stroke={border.color}
        strokeWidth={border.width}
        strokeEnabled={border.style !== "none" && border.width > 0}
        dash={specialNodeBorderDash(border)}
        cornerRadius={surface.radius}
        listening={false}
      />
    </Group>
  );
});

function roundedRectClip(context: Konva.Context, width: number, height: number, radius: number) {
  const r = Math.min(Math.max(0, radius), width / 2, height / 2);
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(width - r, 0);
  context.arcTo(width, 0, width, r, r);
  context.lineTo(width, height - r);
  context.arcTo(width, height, width - r, height, r);
  context.lineTo(r, height);
  context.arcTo(0, height, 0, height - r, r);
  context.lineTo(0, r);
  context.arcTo(0, 0, r, 0, r);
  context.closePath();
}
