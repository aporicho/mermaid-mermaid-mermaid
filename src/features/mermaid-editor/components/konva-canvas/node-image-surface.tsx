import type Konva from "konva";
import { Group, Rect } from "react-konva";

import { CanvasNodeImage } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import type { SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";

export function CanvasNodeImageSurface({
  src,
  width,
  height,
  specialNode,
  interacting
}: {
  src: string;
  width: number;
  height: number;
  specialNode: SpecialNodeThemeTokens;
  interacting: boolean;
}) {
  const image = specialNode.image;
  const common = specialNode.common;
  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill={image.background}
        cornerRadius={image.radius}
        shadowColor={common.shadowColor}
        shadowBlur={common.shadowBlur}
        shadowOpacity={common.shadowOpacity}
        shadowOffsetY={common.shadowOffsetY}
      />
      <Group clipFunc={(context) => roundedRectClip(context, width, height, image.radius)}>
        <CanvasNodeImage src={src} x={0} y={0} width={width} height={height} />
      </Group>
      <Rect
        width={width}
        height={height}
        fillEnabled={false}
        stroke={interacting ? image.interactionBorderColor : image.borderColor}
        strokeWidth={interacting ? image.interactionBorderWidth : image.borderWidth}
        cornerRadius={image.radius}
        listening={false}
      />
    </Group>
  );
}

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
