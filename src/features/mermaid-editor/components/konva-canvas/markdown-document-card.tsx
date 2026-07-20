import { useEffect } from "react";
import { Group, Rect, Text } from "react-konva";

import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { markdownDocumentAction, type MarkdownDocumentPreview } from "@/features/mermaid-editor/lib/markdown-document";

export function MarkdownDocumentCard({
  node,
  width,
  height,
  stroke,
  strokeWidth,
  textFill,
  visualTokens,
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
        fontSize={12}
        fontStyle="700"
        fontFamily="system-ui, sans-serif"
        fill={error ? visualTokens.colors.previewInvalid : visualTokens.colors.accent}
      />
      <Text
        x={60}
        y={12}
        width={width - 72}
        height={22}
        text={node.label || "Markdown 文档"}
        fontSize={16}
        fontStyle="700"
        fontFamily="system-ui, sans-serif"
        fill={textFill}
        ellipsis
      />
      <Text
        x={60}
        y={35}
        width={width - 72}
        height={18}
        text={path}
        fontSize={10}
        fontFamily="system-ui, sans-serif"
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
        fontSize={12}
        lineHeight={1.45}
        fontFamily="system-ui, sans-serif"
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
