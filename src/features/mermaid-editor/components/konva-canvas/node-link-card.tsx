import { useEffect, useState } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";

import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage, type CanvasNodeImageLoadStatus } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeCanvasNodePreview, themedLinkCardLayout } from "@/features/mermaid-editor/lib/node-preview";
import type { EditorTypographyTokens, SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";

export function CanvasNodeLinkCard({
  node,
  preview,
  width,
  height,
  coverSrc,
  stroke,
  strokeWidth,
  visualTokens,
  typography,
  actionTypography,
  specialNode,
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
  typography: EditorTypographyTokens["linkCard"];
  actionTypography: TypographyRoleTokens;
  specialNode: SpecialNodeThemeTokens;
  onOpen?: () => void;
}) {
  const normalized = normalizeCanvasNodePreview(preview);
  const [coverLoadStatus, setCoverLoadStatus] = useState<CanvasNodeImageLoadStatus>(coverSrc ? "loading" : "idle");

  useEffect(() => {
    setCoverLoadStatus(coverSrc ? "loading" : "idle");
  }, [coverSrc]);

  if (!normalized) return null;

  const layout = themedLinkCardLayout(normalized, specialNode.linkCard);
  const inset = specialNode.linkCard.inset;
  const coverWidth = layout.coverWidth;
  const coverHeight = layout.coverHeight;
  const providerY = layout.providerY;
  const titleY = layout.titleY;
  const placeholderY = inset + Math.max(0, (coverHeight - 48) / 2);
  const coverImage = coverImageRect(normalized.cover, coverWidth, coverHeight);
  const title = normalized.title || node.label;
  const contentWidth = Math.max(0, width - specialNode.linkCard.contentPaddingX * 2);
  const showCoverPlaceholder = !coverSrc || coverLoadStatus !== "loaded";
  const showCoverImage = Boolean(coverSrc && coverLoadStatus !== "error");

  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill={specialNode.common.background}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={specialNode.common.radius}
        shadowColor={specialNode.common.shadowColor}
        shadowBlur={specialNode.common.shadowBlur}
        shadowOpacity={specialNode.common.shadowOpacity}
        shadowOffsetY={specialNode.common.shadowOffsetY}
      />
      <Rect
        x={inset}
        y={inset}
        width={coverWidth}
        height={coverHeight}
        fill={specialNode.linkCard.coverBackground}
        cornerRadius={specialNode.linkCard.coverRadius}
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
          fontSize={typography.brand.fontSize}
          fontStyle={String(typography.brand.fontWeight)}
          fontFamily={typography.brand.family}
          lineHeight={typography.brand.lineHeight / typography.brand.fontSize}
          letterSpacing={typography.brand.letterSpacing}
          fill={specialNode.linkCard.brandColor}
          listening={false}
        />
      ) : null}
      {showCoverImage && coverSrc ? (
        <Group x={inset} y={inset} clipFunc={(context) => roundedRectClip(context, coverWidth, coverHeight, specialNode.linkCard.coverRadius)}>
          <CanvasNodeImage src={coverSrc} x={coverImage.x} y={coverImage.y} width={coverImage.width} height={coverImage.height} onLoadStatusChange={setCoverLoadStatus} />
        </Group>
      ) : null}
      <Rect
        x={inset}
        y={inset}
        width={coverWidth}
        height={coverHeight}
        fillEnabled={false}
        stroke={specialNode.linkCard.coverBorderColor}
        strokeWidth={specialNode.linkCard.coverBorderWidth}
        cornerRadius={specialNode.linkCard.coverRadius}
        listening={false}
      />
      <Text
        x={specialNode.linkCard.contentPaddingX}
        y={providerY}
        width={contentWidth}
        height={16}
        text={normalized.provider}
        fontSize={typography.provider.fontSize}
        fontStyle={String(typography.provider.fontWeight)}
        fontFamily={typography.provider.family}
        lineHeight={typography.provider.lineHeight / typography.provider.fontSize}
        letterSpacing={typography.provider.letterSpacing}
        fill={specialNode.linkCard.providerColor}
        listening={false}
      />
      <Text
        x={specialNode.linkCard.contentPaddingX}
        y={titleY}
        width={contentWidth}
        height={specialNode.linkCard.titleHeight}
        text={title}
        fontSize={typography.title.fontSize}
        fontStyle={String(typography.title.fontWeight)}
        fontFamily={typography.title.family}
        lineHeight={typography.title.lineHeight / typography.title.fontSize}
        letterSpacing={typography.title.letterSpacing}
        wrap="word"
        ellipsis
        fill={specialNode.common.textColor}
        listening={false}
      />
      <CanvasNodeActionBadge actionKind="url" x={width - 30} y={10} visualTokens={visualTokens} typography={actionTypography} onOpen={onOpen} />
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
