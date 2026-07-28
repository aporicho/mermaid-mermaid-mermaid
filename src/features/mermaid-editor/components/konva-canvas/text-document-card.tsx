import { useEffect } from "react";
import { Group, Rect, Text } from "react-konva";

import { CanvasStaticCacheGroup, canvasStaticCacheKey } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import { textDocumentNodeAction, type TextDocumentPreview } from "@/features/mermaid-editor/lib/text-document";

export function TextDocumentCard({ node, width, height, specialNode, visualState, preview, fontRevision, cacheEnabled = true, onRequestPreview }: {
  node: CanvasNode;
  width: number;
  height: number;
  specialNode: SpecialNodeThemeTokens;
  visualState?: SpecialNodeVisualState;
  preview?: TextDocumentPreview;
  fontRevision: number;
  cacheEnabled?: boolean;
  onRequestPreview?: (node: CanvasNode) => void;
}) {
  const action = textDocumentNodeAction(node.action);
  useEffect(() => { if (action) onRequestPreview?.(node); }, [action, node, onRequestPreview]);
  const tokens = specialNode.textDocument;
  const error = preview?.status === "error" || preview?.status === "missing" || preview?.status === "unsupported";
  const border = resolveSpecialNodeBorder(tokens.surface, tokens.state, error ? "error" : visualState);
  const contentWidth = Math.max(0, width - tokens.paddingLeft - tokens.paddingRight);
  const bodyY = tokens.paddingTop + tokens.titleFontSize * 1.3 + tokens.titleGap;
  const text = preview?.status === "loading" ? "正在读取文本…" : preview?.status === "missing" ? "文件不存在" : preview?.status === "error" ? preview.message || "读取失败" : preview?.excerpt || "空白文档";
  return (
    <Group>
      <CanvasStaticCacheGroup cacheId={`${node.id}:text-document-static`} cacheKey={canvasStaticCacheKey(node.label, action?.path, preview, width, height, tokens, fontRevision)} cacheKind="text-document" cacheEnabled={cacheEnabled} cachePriority={6}>
        <Rect width={width} height={height} fill={tokens.surface.background} cornerRadius={tokens.surface.radius} shadowColor={tokens.surface.shadow.color} shadowBlur={tokens.surface.shadow.blur} shadowOpacity={tokens.surface.shadow.opacity} shadowOffsetX={tokens.surface.shadow.offsetX} shadowOffsetY={tokens.surface.shadow.offsetY} />
        <Text x={tokens.paddingLeft} y={tokens.paddingTop} width={contentWidth} height={tokens.titleFontSize * 1.4} text={node.label || "文本文档"} fontFamily={tokens.titleFontFamily} fontSize={tokens.titleFontSize} fontStyle={String(tokens.titleFontWeight)} fill={tokens.titleColor} ellipsis listening={false} />
        <Text x={tokens.paddingLeft} y={bodyY} width={contentWidth} height={Math.max(0, height - bodyY - tokens.paddingBottom)} text={text} fontFamily={tokens.bodyFontFamily} fontSize={tokens.bodyFontSize} fontStyle={String(tokens.bodyFontWeight)} lineHeight={tokens.bodyLineHeight / tokens.bodyFontSize} fill={error ? specialNode.shared.errorColor : tokens.bodyColor} opacity={tokens.excerptOpacity} wrap="word" ellipsis listening={false} />
      </CanvasStaticCacheGroup>
      <Rect width={width} height={height} fillEnabled={false} stroke={border.color} strokeWidth={border.width} strokeEnabled={border.style !== "none" && border.width > 0} dash={specialNodeBorderDash(border)} cornerRadius={tokens.surface.radius} listening={false} />
    </Group>
  );
}
