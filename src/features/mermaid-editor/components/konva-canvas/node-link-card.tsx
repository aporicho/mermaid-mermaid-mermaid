import { memo, useCallback, useMemo, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type Konva from "konva";

import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { CanvasNodeImage, type CanvasNodeImageLoadStatus } from "@/features/mermaid-editor/components/konva-canvas/node-image";
import { useLinkCardCoverRaster } from "@/features/mermaid-editor/components/konva-canvas/use-link-card-cover-raster";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode, CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import { normalizeCanvasNodePreview, themedLinkCardLayout } from "@/features/mermaid-editor/lib/node-preview";
import type { EditorTypographyTokens, SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";

export const CanvasNodeLinkCard = memo(function CanvasNodeLinkCard({
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
  visualState,
  onOpenNodeAction
}: {
  node: CanvasNode;
  preview: CanvasNodePreview;
  width: number;
  height: number;
  coverSrc?: string;
  stroke?: string;
  strokeWidth?: number;
  visualTokens: CanvasVisualTokens;
  typography: EditorTypographyTokens["linkCard"];
  actionTypography: TypographyRoleTokens;
  specialNode: SpecialNodeThemeTokens;
  visualState?: SpecialNodeVisualState;
  onOpenNodeAction?: (node: CanvasNode) => void;
}) {
  const normalized = useMemo(() => normalizeCanvasNodePreview(preview), [preview]);
  const [fallbackCoverLoad, setFallbackCoverLoad] = useState<{ src: string; status: CanvasNodeImageLoadStatus }>({ src: "", status: "idle" });
  const layout = normalized ? themedLinkCardLayout(normalized, specialNode.linkCard) : null;
  const coverRaster = useLinkCardCoverRaster(coverSrc && layout ? {
    src: coverSrc,
    width: layout.coverWidth,
    height: layout.coverHeight,
    radius: specialNode.linkCard.coverRadius
  } : null);
  const fallbackCoverStatus = fallbackCoverLoad.src === coverSrc ? fallbackCoverLoad.status : "idle";
  const updateFallbackCoverStatus = useCallback((status: CanvasNodeImageLoadStatus) => {
    setFallbackCoverLoad({ src: coverSrc || "", status });
  }, [coverSrc]);
  const openNodeAction = useCallback(() => onOpenNodeAction?.(node), [node, onOpenNodeAction]);

  if (!normalized || !layout) return null;

  const inset = specialNode.linkCard.inset;
  const coverWidth = layout.coverWidth;
  const coverHeight = layout.coverHeight;
  const providerY = layout.providerY;
  const titleY = layout.titleY;
  const placeholderY = inset + Math.max(0, (coverHeight - 48) / 2);
  const coverImage = coverImageRect(normalized.cover, coverWidth, coverHeight);
  const title = normalized.title || node.label;
  const contentWidth = Math.max(0, width - specialNode.linkCard.contentPaddingX * 2);
  const showOptimizedCover = Boolean(coverRaster.image);
  const showFallbackCover = Boolean(coverSrc && coverRaster.status === "error" && fallbackCoverStatus !== "error");
  const showCoverPlaceholder = !coverSrc || (!showOptimizedCover && fallbackCoverStatus !== "loaded");
  const surface = specialNode.linkCard.surface;
  const surfaceBorder = visualState
    ? resolveSpecialNodeBorder(surface, specialNode.linkCard.state, visualState)
    : { ...surface.border, color: stroke ?? surface.border.color, width: strokeWidth ?? surface.border.width };
  const coverBorder = specialNode.linkCard.coverBorder;

  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill={surface.background}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={surface.radius}
        shadowColor={surface.shadow.color}
        shadowBlur={surface.shadow.blur}
        shadowOpacity={surface.shadow.opacity}
        shadowOffsetX={surface.shadow.offsetX}
        shadowOffsetY={surface.shadow.offsetY}
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
      {coverRaster.image ? (
        <KonvaImage
          image={coverRaster.image}
          x={inset}
          y={inset}
          width={coverWidth}
          height={coverHeight}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {showFallbackCover && coverSrc ? (
        <Group x={inset} y={inset} clipFunc={(context) => roundedRectClip(context, coverWidth, coverHeight, specialNode.linkCard.coverRadius)}>
          <CanvasNodeImage src={coverSrc} x={coverImage.x} y={coverImage.y} width={coverImage.width} height={coverImage.height} onLoadStatusChange={updateFallbackCoverStatus} />
        </Group>
      ) : null}
      <Rect
        x={inset}
        y={inset}
        width={coverWidth}
        height={coverHeight}
        fillEnabled={false}
        stroke={coverBorder.color}
        strokeWidth={coverBorder.width}
        strokeEnabled={coverBorder.style !== "none" && coverBorder.width > 0}
        dash={specialNodeBorderDash(coverBorder)}
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
        fill={specialNode.shared.textColor}
        listening={false}
      />
      <CanvasNodeActionBadge actionKind="url" x={width - 30} y={10} visualTokens={visualTokens} typography={actionTypography} onOpen={openNodeAction} />
    </Group>
  );
});

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
