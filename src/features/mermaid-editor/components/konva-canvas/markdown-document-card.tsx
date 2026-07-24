import { useEffect } from "react";
import { Group, Rect, Text } from "react-konva";

import { MarkdownDocumentContent } from "@/features/mermaid-editor/components/konva-canvas/markdown-document-content";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { markdownDocumentAction, type MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { EditorTypographyTokens, MarkdownThemeTokens, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
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
  markdownTokens: MarkdownThemeTokens;
  specialNode: SpecialNodeThemeTokens;
  visualState?: SpecialNodeVisualState;
  preview?: MarkdownDocumentPreview;
  onRequestPreview?: (node: CanvasNode) => void;
}) {
  const action = markdownDocumentAction(node.action);

  useEffect(() => {
    if (action) onRequestPreview?.(node);
  }, [action, node, onRequestPreview]);

  const excerpt = previewText(preview);
  const richPreview = preview?.status === "ready" && typeof preview.source === "string";
  const error = preview?.status === "missing" || preview?.status === "error" || preview?.status === "unsupported";
  const tokens = specialNode.markdownDocument;
  const shared = specialNode.shared;
  const surface = tokens.surface;
  const resolvedVisualState = error ? "error" : visualState;
  const surfaceBorder = resolvedVisualState
    ? resolveSpecialNodeBorder(surface, tokens.state, resolvedVisualState)
    : { ...surface.border, color: stroke ?? surface.border.color, width: strokeWidth ?? surface.border.width };
  const contentWidth = Math.max(0, width - tokens.contentPaddingLeft - tokens.contentPaddingRight);
  const contentHeight = Math.max(0, height - tokens.contentPaddingTop - tokens.contentPaddingBottom);
  const excerptY = tokens.contentPaddingTop + typography.title.lineHeight + tokens.titleGap;

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
      {richPreview ? (
        <Group x={tokens.contentPaddingLeft} y={tokens.contentPaddingTop}>
          <MarkdownDocumentContent
            source={preview.source || ""}
            fallbackTitle={preview.title || node.label || "Markdown 文档"}
            width={contentWidth}
            height={contentHeight}
            content={tokens.previewContent}
          />
        </Group>
      ) : (
        <>
          <Text
            x={tokens.contentPaddingLeft}
            y={tokens.contentPaddingTop}
            width={contentWidth}
            height={typography.title.lineHeight}
            text={preview?.title || node.label || "Markdown 文档"}
            fontSize={typography.title.fontSize}
            fontStyle={String(typography.title.fontWeight)}
            fontFamily={typography.title.family}
            lineHeight={typography.title.lineHeight / typography.title.fontSize}
            letterSpacing={typography.title.letterSpacing}
            fill={shared.textColor}
            ellipsis
          />
          <Text
            x={tokens.contentPaddingLeft}
            y={excerptY}
            width={contentWidth}
            height={Math.max(0, height - excerptY - tokens.contentPaddingBottom)}
            text={excerpt}
            fontSize={typography.excerpt.fontSize}
            fontStyle={String(typography.excerpt.fontWeight)}
            lineHeight={typography.excerpt.lineHeight / typography.excerpt.fontSize}
            fontFamily={typography.excerpt.family}
            letterSpacing={typography.excerpt.letterSpacing}
            fill={error ? shared.errorColor : shared.textColor}
            opacity={preview?.status === "ready" ? tokens.excerptOpacity : tokens.placeholderOpacity}
            wrap="word"
            ellipsis
          />
        </>
      )}
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
