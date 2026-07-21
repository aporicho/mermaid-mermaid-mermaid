import { useEffect } from "react";
import { Group, Rect, Text } from "react-konva";

import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { markdownDocumentAction, type MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { EditorTypographyTokens, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";

export function MarkdownDocumentCard({
  node,
  width,
  height,
  stroke,
  strokeWidth,
  typography,
  specialNode,
  visualState,
  preview,
  onRequestPreview
}: {
  node: CanvasNode;
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  typography: EditorTypographyTokens["markdownCard"];
  specialNode: SpecialNodeThemeTokens;
  visualState?: SpecialNodeVisualState;
  preview?: MarkdownDocumentPreview;
  onRequestPreview?: (node: CanvasNode) => void;
}) {
  const action = markdownDocumentAction(node.action);

  useEffect(() => {
    if (action) onRequestPreview?.(node);
  }, [action, node, onRequestPreview]);

  const path = preview?.path || action?.path || "";
  const excerpt = previewText(preview);
  const error = preview?.status === "missing" || preview?.status === "error" || preview?.status === "unsupported";
  const tokens = specialNode.markdownDocument;
  const shared = specialNode.shared;
  const surface = tokens.surface;
  const resolvedVisualState = error ? "error" : visualState;
  const surfaceBorder = resolvedVisualState
    ? resolveSpecialNodeBorder(surface, tokens.state, resolvedVisualState)
    : { ...surface.border, color: stroke ?? surface.border.color, width: strokeWidth ?? surface.border.width };
  const padding = tokens.contentPadding;
  const titleX = padding + tokens.badgeSize + tokens.titleGap;
  const headerTextWidth = Math.max(0, width - titleX - padding);
  const pathY = padding + typography.title.lineHeight + tokens.pathGap;
  const headerBottom = Math.max(padding + tokens.badgeSize, pathY + typography.path.lineHeight);
  const separatorY = headerBottom + tokens.excerptGap;
  const excerptY = separatorY + tokens.separatorWidth + tokens.excerptGap;

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
        x={padding}
        y={padding}
        width={tokens.badgeSize}
        height={tokens.badgeSize}
        fill={error ? tokens.badgeErrorBackground : tokens.badgeBackground}
        opacity={error ? tokens.badgeErrorOpacity : tokens.badgeOpacity}
        cornerRadius={tokens.badgeRadius}
      />
      <Text
        x={padding}
        y={padding}
        width={tokens.badgeSize}
        height={tokens.badgeSize}
        text="MD"
        align="center"
        verticalAlign="middle"
        fontSize={typography.badge.fontSize}
        fontStyle={String(typography.badge.fontWeight)}
        fontFamily={typography.badge.family}
        lineHeight={typography.badge.lineHeight / typography.badge.fontSize}
        letterSpacing={typography.badge.letterSpacing}
        fill={error ? tokens.badgeErrorColor : tokens.badgeColor}
      />
      <Text
        x={titleX}
        y={padding}
        width={headerTextWidth}
        height={22}
        text={node.label || "Markdown 文档"}
        fontSize={typography.title.fontSize}
        fontStyle={String(typography.title.fontWeight)}
        fontFamily={typography.title.family}
        lineHeight={typography.title.lineHeight / typography.title.fontSize}
        letterSpacing={typography.title.letterSpacing}
        fill={shared.textColor}
        ellipsis
      />
      <Text
        x={titleX}
        y={pathY}
        width={headerTextWidth}
        height={18}
        text={path}
        fontSize={typography.path.fontSize}
        fontStyle={String(typography.path.fontWeight)}
        fontFamily={typography.path.family}
        lineHeight={typography.path.lineHeight / typography.path.fontSize}
        letterSpacing={typography.path.letterSpacing}
        fill={error ? tokens.badgeErrorColor : shared.mutedTextColor}
        opacity={tokens.pathOpacity}
        ellipsis
      />
      <Rect x={padding} y={separatorY} width={width - padding * 2} height={tokens.separatorWidth} fill={tokens.separatorColor} opacity={tokens.separatorOpacity} />
      <Text
        x={padding}
        y={excerptY}
        width={width - padding * 2}
        height={Math.max(0, height - excerptY - padding)}
        text={excerpt}
        fontSize={typography.excerpt.fontSize}
        fontStyle={String(typography.excerpt.fontWeight)}
        lineHeight={typography.excerpt.lineHeight / typography.excerpt.fontSize}
        fontFamily={typography.excerpt.family}
        letterSpacing={typography.excerpt.letterSpacing}
        fill={error ? tokens.badgeErrorColor : shared.textColor}
        opacity={preview?.status === "ready" ? tokens.excerptOpacity : tokens.placeholderOpacity}
        wrap="word"
        ellipsis
      />
    </Group>
  );
}

function previewText(preview: MarkdownDocumentPreview | undefined) {
  if (!preview || preview.status === "loading") return "正在读取文档摘要…";
  if (preview.status === "empty") return "空白 Markdown 文档";
  if (preview.status === "missing") return "文档不存在；引用和连线仍会保留。";
  if (preview.status === "unsupported") return "当前运行环境无法读取本地文档。";
  if (preview.status === "error") return preview.message || "文档摘要读取失败。";
  return preview.excerpt;
}
