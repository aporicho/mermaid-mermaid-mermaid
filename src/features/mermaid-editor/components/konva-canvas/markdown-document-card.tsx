import { useEffect } from "react";
import { Group, Rect, Text } from "react-konva";

import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { markdownDocumentAction, type MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";
import type { EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";

export function MarkdownDocumentCard({
  node,
  width,
  height,
  stroke,
  strokeWidth,
  textFill,
  visualTokens,
  typography,
  preview,
  onRequestPreview
}: {
  node: CanvasNode;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  textFill: string;
  visualTokens: CanvasVisualTokens;
  typography: EditorTypographyTokens["markdownCard"];
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

  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill={visualTokens.colors.surface}
        stroke={stroke}
        strokeWidth={strokeWidth}
        cornerRadius={visualTokens.node.cornerRadius}
      />
      <Rect
        x={12}
        y={12}
        width={38}
        height={38}
        fill={error ? visualTokens.colors.previewInvalid : visualTokens.colors.accent}
        opacity={error ? 0.2 : 0.12}
        cornerRadius={visualTokens.shape.fallbackCornerRadius}
      />
      <Text
        x={12}
        y={12}
        width={38}
        height={38}
        text="MD"
        align="center"
        verticalAlign="middle"
        fontSize={typography.badge.fontSize}
        fontStyle={String(typography.badge.fontWeight)}
        fontFamily={typography.badge.family}
        lineHeight={typography.badge.lineHeight / typography.badge.fontSize}
        letterSpacing={typography.badge.letterSpacing}
        fill={error ? visualTokens.colors.previewInvalid : visualTokens.colors.accent}
      />
      <Text
        x={60}
        y={12}
        width={width - 72}
        height={22}
        text={node.label || "Markdown 文档"}
        fontSize={typography.title.fontSize}
        fontStyle={String(typography.title.fontWeight)}
        fontFamily={typography.title.family}
        lineHeight={typography.title.lineHeight / typography.title.fontSize}
        letterSpacing={typography.title.letterSpacing}
        fill={textFill}
        ellipsis
      />
      <Text
        x={60}
        y={35}
        width={width - 72}
        height={18}
        text={path}
        fontSize={typography.path.fontSize}
        fontStyle={String(typography.path.fontWeight)}
        fontFamily={typography.path.family}
        lineHeight={typography.path.lineHeight / typography.path.fontSize}
        letterSpacing={typography.path.letterSpacing}
        fill={error ? visualTokens.colors.previewInvalid : textFill}
        opacity={0.62}
        ellipsis
      />
      <Rect x={12} y={62} width={width - 24} height={1} fill={stroke} opacity={0.18} />
      <Text
        x={12}
        y={73}
        width={width - 24}
        height={height - 84}
        text={excerpt}
        fontSize={typography.excerpt.fontSize}
        fontStyle={String(typography.excerpt.fontWeight)}
        lineHeight={typography.excerpt.lineHeight / typography.excerpt.fontSize}
        fontFamily={typography.excerpt.family}
        letterSpacing={typography.excerpt.letterSpacing}
        fill={error ? visualTokens.colors.previewInvalid : textFill}
        opacity={preview?.status === "ready" ? 0.74 : 0.56}
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
