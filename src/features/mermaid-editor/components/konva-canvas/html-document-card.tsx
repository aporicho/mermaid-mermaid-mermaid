import { Group, Rect, Text } from "react-konva";

import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTypographyTokens, SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import { htmlDocumentAction } from "@/features/mermaid-editor/lib/html-document";

export function HtmlDocumentCard({
  node,
  width,
  height,
  typography,
  specialNode,
  visualState
}: {
  node: CanvasNode;
  width: number;
  height: number;
  typography: EditorTypographyTokens["markdownCard"];
  specialNode: SpecialNodeThemeTokens;
  visualState?: SpecialNodeVisualState;
}) {
  const action = htmlDocumentAction(node.action);
  const tokens = specialNode.htmlDocument;
  const shared = specialNode.shared;
  const surface = tokens.surface;
  const surfaceBorder = resolveSpecialNodeBorder(surface, tokens.state, visualState);
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
        fill={tokens.badgeBackground}
        opacity={tokens.badgeOpacity}
        cornerRadius={tokens.badgeRadius}
      />
      <Text
        x={padding}
        y={padding}
        width={tokens.badgeSize}
        height={tokens.badgeSize}
        text="HTML"
        align="center"
        verticalAlign="middle"
        fontSize={Math.max(8, typography.badge.fontSize - 2)}
        fontStyle={String(typography.badge.fontWeight)}
        fontFamily={typography.badge.family}
        lineHeight={typography.badge.lineHeight / typography.badge.fontSize}
        letterSpacing={typography.badge.letterSpacing}
        fill={tokens.badgeColor}
      />
      <Text
        x={titleX}
        y={padding}
        width={headerTextWidth}
        height={22}
        text={node.label || "HTML 文件"}
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
        text={action?.path || ""}
        fontSize={typography.path.fontSize}
        fontStyle={String(typography.path.fontWeight)}
        fontFamily={typography.path.family}
        lineHeight={typography.path.lineHeight / typography.path.fontSize}
        letterSpacing={typography.path.letterSpacing}
        fill={shared.mutedTextColor}
        opacity={tokens.pathOpacity}
        ellipsis
      />
      <Rect x={padding} y={separatorY} width={width - padding * 2} height={tokens.separatorWidth} fill={tokens.separatorColor} opacity={tokens.separatorOpacity} />
      <Text
        x={padding}
        y={excerptY}
        width={width - padding * 2}
        height={Math.max(0, height - excerptY - padding)}
        text="双击在浮动窗口中预览本地网页"
        fontSize={typography.excerpt.fontSize}
        fontStyle={String(typography.excerpt.fontWeight)}
        lineHeight={typography.excerpt.lineHeight / typography.excerpt.fontSize}
        fontFamily={typography.excerpt.family}
        letterSpacing={typography.excerpt.letterSpacing}
        fill={shared.textColor}
        opacity={tokens.excerptOpacity}
        wrap="word"
        ellipsis
      />
    </Group>
  );
}
