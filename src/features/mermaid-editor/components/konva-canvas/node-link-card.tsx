import { memo, useCallback, useLayoutEffect, useMemo } from "react";
import type Konva from "konva";
import { Group, Image as KonvaImage, Rect, Text } from "react-konva";

import { CanvasNodeActionBadge } from "@/features/mermaid-editor/components/konva-canvas/node-action-ui";
import { useDecodedCanvasImage } from "@/features/mermaid-editor/components/konva-canvas/use-decoded-canvas-image";
import { coverCanvasImageSourceCrop } from "@/features/mermaid-editor/lib/canvas-image-crop";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTypographyTokens, SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import { normalizeCanvasNodePreview, themedLinkCardLayout } from "@/features/mermaid-editor/lib/node-preview";
import { CanvasStaticCacheGroup, canvasStaticCacheKey, useCanvasSceneInvalidation } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";

export const CanvasNodeLinkCard = memo(function CanvasNodeLinkCard({
  nodeId,
  label,
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
  fontRevision,
  cacheEnabled = true,
  onOpenNodeAction
}: {
  nodeId: string;
  label: string;
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
  fontRevision: number;
  cacheEnabled?: boolean;
  onOpenNodeAction?: (nodeId: string) => void;
}) {
  const normalized = useMemo(() => normalizeCanvasNodePreview(preview), [preview]);
  const layout = normalized ? themedLinkCardLayout(normalized, specialNode.linkCard) : null;
  const openNodeAction = useCallback(() => onOpenNodeAction?.(nodeId), [nodeId, onOpenNodeAction]);

  if (!normalized || !layout) return null;

  const inset = specialNode.linkCard.inset;
  const coverWidth = layout.coverWidth;
  const coverHeight = layout.coverHeight;
  const providerY = layout.providerY;
  const titleY = layout.titleY;
  const title = normalized.title || label;
  const contentWidth = Math.max(0, width - specialNode.linkCard.contentPaddingX * 2);
  const surface = specialNode.linkCard.surface;
  const surfaceBorder = visualState
    ? resolveSpecialNodeBorder(surface, specialNode.linkCard.state, visualState)
    : { ...surface.border, color: stroke ?? surface.border.color, width: strokeWidth ?? surface.border.width };
  const coverBorder = specialNode.linkCard.coverBorder;

  return (
    <Group>
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:link-card-surface`}
        cacheKey={canvasStaticCacheKey(width, height, inset, coverWidth, coverHeight, surface, specialNode.linkCard.coverBackground, specialNode.linkCard.coverRadius)}
        cacheKind="link-card"
        cacheEnabled={cacheEnabled}
        cachePriority={5}
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
        <Rect
          x={inset}
          y={inset}
          width={coverWidth}
          height={coverHeight}
          fill={specialNode.linkCard.coverBackground}
          cornerRadius={specialNode.linkCard.coverRadius}
          listening={false}
        />
      </CanvasStaticCacheGroup>
      <CanvasNodeLinkCover
        src={coverSrc || ""}
        inset={inset}
        width={coverWidth}
        height={coverHeight}
        radius={specialNode.linkCard.coverRadius}
        brandColor={specialNode.linkCard.brandColor}
        typography={typography.brand}
      />
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:link-card-content`}
        cacheKey={canvasStaticCacheKey(
          width,
          height,
          inset,
          coverWidth,
          coverHeight,
          providerY,
          titleY,
          contentWidth,
          normalized.provider,
          title,
          coverBorder,
          specialNode.linkCard,
          specialNode.shared,
          typography,
          fontRevision
        )}
        cacheKind="link-card"
        cacheEnabled={cacheEnabled}
        cachePriority={6}
      >
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
      </CanvasStaticCacheGroup>
      <Rect
        width={width}
        height={height}
        fillEnabled={false}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={surface.radius}
        listening={false}
      />
      <CanvasNodeActionBadge actionKind="url" x={width - 30} y={10} visualTokens={visualTokens} typography={actionTypography} onOpen={openNodeAction} />
    </Group>
  );
});

const CanvasNodeLinkCover = memo(function CanvasNodeLinkCover({
  src,
  inset,
  width,
  height,
  radius,
  brandColor,
  typography
}: {
  src: string;
  inset: number;
  width: number;
  height: number;
  radius: number;
  brandColor: string;
  typography: TypographyRoleTokens;
}) {
  const { image } = useDecodedCanvasImage(src);
  const invalidateScene = useCanvasSceneInvalidation();
  useLayoutEffect(() => {
    if (image) invalidateScene?.("link-cover-decoded");
  }, [image, invalidateScene]);
  if (!image) {
    return (
      <Text
        x={inset}
        y={inset + Math.max(0, (height - 48) / 2)}
        width={width}
        height={48}
        text="小红书"
        align="center"
        verticalAlign="middle"
        fontSize={typography.fontSize}
        fontStyle={String(typography.fontWeight)}
        fontFamily={typography.family}
        lineHeight={typography.lineHeight / typography.fontSize}
        letterSpacing={typography.letterSpacing}
        fill={brandColor}
        listening={false}
      />
    );
  }

  const sourceCrop = coverCanvasImageSourceCrop(image.naturalWidth, image.naturalHeight, width, height);
  return (
    <Group x={inset} y={inset} clipFunc={(context) => roundedRectClip(context, width, height, radius)} listening={false}>
      <KonvaImage
        image={image}
        width={width}
        height={height}
        cropX={sourceCrop.x}
        cropY={sourceCrop.y}
        cropWidth={sourceCrop.width}
        cropHeight={sourceCrop.height}
        listening={false}
        perfectDrawEnabled={false}
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
