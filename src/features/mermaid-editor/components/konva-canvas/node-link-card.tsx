import { useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";

import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage, type CanvasNodeImageLoadStatus } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import { LINK_CARD_INSET, linkCardCoverHeight, normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";

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
  const [coverLoadStatus, setCoverLoadStatus] = useState<CanvasNodeImageLoadStatus>(coverSrc ? "loading" : "idle");

  useEffect(() => {
    setCoverLoadStatus(coverSrc ? "loading" : "idle");
  }, [coverSrc]);

  if (!normalized) return null;

  const inset = LINK_CARD_INSET;
  const coverWidth = width - inset * 2;
  const coverHeight = linkCardCoverHeight(normalized);
  const providerY = inset + coverHeight + 10;
  const titleY = providerY + 20;
  const placeholderY = inset + Math.max(0, (coverHeight - 48) / 2);
  const coverImage = coverImageRect(normalized.cover, coverWidth, coverHeight);
  const title = normalized.title || node.label;
  const showCoverPlaceholder = !coverSrc || coverLoadStatus !== "loaded";
  const showCoverImage = Boolean(coverSrc && coverLoadStatus !== "error");

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
      {showCoverPlaceholder ? (
        <Text
          x={inset}
          y={placeholderY}
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
      ) : null}
      {showCoverImage && coverSrc ? (
        <Group x={inset} y={inset} clipX={0} clipY={0} clipWidth={coverWidth} clipHeight={coverHeight}>
          <CanvasNodeImage src={coverSrc} x={coverImage.x} y={coverImage.y} width={coverImage.width} height={coverImage.height} onLoadStatusChange={setCoverLoadStatus} />
        </Group>
      ) : null}
      <Rect x={inset} y={inset} width={coverWidth} height={coverHeight} fillEnabled={false} stroke="rgba(15,23,42,0.08)" strokeWidth={1} cornerRadius={6} listening={false} />
      <Text
        x={12}
        y={providerY}
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
        y={titleY}
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

function coverImageRect(cover: CanvasNodePreview["cover"], boxWidth: number, boxHeight: number) {
  const imageWidth = cover?.width;
  const imageHeight = cover?.height;
  if (!isPositiveFiniteNumber(imageWidth) || !isPositiveFiniteNumber(imageHeight)) {
    return { x: 0, y: 0, width: boxWidth, height: boxHeight };
  }

  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height
  };
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
