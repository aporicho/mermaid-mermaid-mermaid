import { Group, Rect, Text } from "react-konva";

import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import { LINK_CARD_COVER_HEIGHT, normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";

export function CanvasNodeLinkCard({
  node,
  preview,
  width,
  height,
  coverSrc,
  stroke,
  strokeWidth,
  visualTokens,
  onOpen
}: {
  node: CanvasNode;
  preview: CanvasNodePreview;
  width: number;
  height: number;
  coverSrc?: string;
  stroke: string;
  strokeWidth: number;
  visualTokens: CanvasVisualTokens;
  onOpen?: () => void;
}) {
  const normalized = normalizeCanvasNodePreview(preview);
  if (!normalized) return null;

  const inset = 8;
  const coverWidth = width - inset * 2;
  const coverHeight = LINK_CARD_COVER_HEIGHT;
  const title = normalized.title || node.label;

  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill={visualTokens.colors.surface}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={8}
        shadowColor="rgba(15,23,42,0.16)"
        shadowBlur={10}
        shadowOpacity={0.22}
        shadowOffsetY={4}
      />
      <Rect
        x={inset}
        y={inset}
        width={coverWidth}
        height={coverHeight}
        fill={normalized.status === "ready" ? "#f8fafc" : "#fff1f2"}
        cornerRadius={6}
        listening={false}
      />
      {coverSrc ? (
        <Group x={inset} y={inset} clipX={0} clipY={0} clipWidth={coverWidth} clipHeight={coverHeight}>
          <CanvasNodeImage src={coverSrc} x={0} y={0} width={coverWidth} height={coverHeight} />
        </Group>
      ) : (
        <Text
          x={inset}
          y={inset + 68}
          width={coverWidth}
          height={48}
          text="小红书"
          align="center"
          verticalAlign="middle"
          fontSize={22}
          fontStyle="800"
          fontFamily="system-ui, sans-serif"
          fill="#e11d48"
          listening={false}
        />
      )}
      <Rect x={inset} y={inset} width={coverWidth} height={coverHeight} fillEnabled={false} stroke="rgba(15,23,42,0.08)" strokeWidth={1} cornerRadius={6} listening={false} />
      <Text
        x={12}
        y={206}
        width={width - 24}
        height={16}
        text={normalized.provider}
        fontSize={11}
        fontStyle="700"
        fontFamily="system-ui, sans-serif"
        fill="#e11d48"
        listening={false}
      />
      <Text
        x={12}
        y={226}
        width={width - 24}
        height={44}
        text={title}
        fontSize={13}
        fontStyle="700"
        fontFamily="'Noto Sans SC Variable', 'Noto Sans SC', system-ui, sans-serif"
        lineHeight={1.25}
        wrap="word"
        ellipsis
        fill={visualTokens.colors.nodeText}
        listening={false}
      />
      <CanvasNodeActionBadge actionKind="url" x={width - 30} y={10} visualTokens={visualTokens} onOpen={onOpen} />
    </Group>
  );
}
