import { useMemo } from "react";
import { Group, Rect, Text } from "react-konva";

import type {
  MarkdownTextTokens,
  MarkdownThemeTokens,
  SpecialNodeMarkdownDocumentTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import {
  parseMarkdownPreview,
  type MarkdownPreviewBlock,
  type MarkdownPreviewRun
} from "@/features/mermaid-editor/lib/markdown-preview-parser";

type PreviewText = MarkdownTextTokens & {
  kind: "text";
  x: number;
  y: number;
  text: string;
  width?: number;
  align?: "left" | "center" | "right";
};

type PreviewRect = {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  cornerRadius: number;
};

type PreviewItem = PreviewText | PreviewRect;
type PreviewTypography = SpecialNodeMarkdownDocumentTokens["previewTypography"];
type PreviewSpacing = SpecialNodeMarkdownDocumentTokens["previewSpacing"];

export function MarkdownDocumentContent({
  source,
  fallbackTitle,
  width,
  height,
  theme,
  typography,
  spacing
}: {
  source: string;
  fallbackTitle: string;
  width: number;
  height: number;
  theme: MarkdownThemeTokens;
  typography: PreviewTypography;
  spacing: PreviewSpacing;
}) {
  const items = useMemo(
    () => layoutMarkdownDocumentContent({ source, fallbackTitle, width, height, theme, typography, spacing }),
    [fallbackTitle, height, source, spacing, theme, typography, width]
  );

  return (
    <Group clipX={0} clipY={0} clipWidth={width} clipHeight={height} listening={false}>
      {items.map((item, index) => item.kind === "rect" ? (
        <Rect
          key={`${index}:rect:${item.x}:${item.y}`}
          x={item.x}
          y={item.y}
          width={item.width}
          height={item.height}
          fill={item.fill}
          cornerRadius={item.cornerRadius}
          listening={false}
        />
      ) : (
        <Text
          key={`${index}:text:${item.x}:${item.y}`}
          x={item.x}
          y={item.y}
          width={item.width}
          align={item.align}
          text={item.text}
          fill={item.color}
          fontFamily={item.fontFamily}
          fontSize={item.fontSize}
          fontStyle={String(item.fontWeight)}
          lineHeight={item.lineHeight / item.fontSize}
          letterSpacing={item.letterSpacing}
          wrap="none"
          listening={false}
        />
      ))}
    </Group>
  );
}

export function layoutMarkdownDocumentContent({
  source,
  fallbackTitle,
  width,
  height,
  theme,
  typography,
  spacing,
  measure = measurePreviewText
}: {
  source: string;
  fallbackTitle: string;
  width: number;
  height: number;
  theme: MarkdownThemeTokens;
  typography: PreviewTypography;
  spacing: PreviewSpacing;
  measure?: (text: string, style: MarkdownTextTokens) => number;
}) {
  const blocks = parseMarkdownPreview(source, fallbackTitle);
  const items: PreviewItem[] = [];
  let y = 0;
  let previous: MarkdownPreviewBlock | undefined;

  for (const block of blocks) {
    y += spacingBefore(previous, block, spacing);
    if (y >= height) break;
    if (block.kind === "heading") {
      const style = headingStyle(theme, block.level, typography);
      const result = layoutRuns(block.runs, 0, y, width, height, style, headingBoldStyle(style, theme.strong), items, measure);
      y += result.height;
      if (result.truncated) break;
      previous = block;
      continue;
    }

    if (block.kind === "paragraph") {
      const body = resizeTextStyle(theme.body, typography.contentFontSize);
      const strong = resizeTextStyle(theme.strong, typography.contentFontSize);
      const result = layoutRuns(block.runs, 0, y, width, height, body, strong, items, measure);
      y += result.height;
      if (result.truncated) break;
      previous = block;
      continue;
    }

    if (block.kind === "list") {
      const listResult = layoutList(block, y, width, height, theme, typography, spacing, items, measure);
      y = listResult.y;
      if (listResult.truncated) break;
      previous = block;
      continue;
    }

    const quoteResult = layoutBlockquote(block, y, width, height, theme, typography, spacing, items, measure);
    y = quoteResult.y;
    if (quoteResult.truncated) break;
    previous = block;
  }
  return items;
}

function layoutList(
  block: Extract<MarkdownPreviewBlock, { kind: "list" }>,
  initialY: number,
  width: number,
  height: number,
  theme: MarkdownThemeTokens,
  typography: PreviewTypography,
  spacing: PreviewSpacing,
  items: PreviewItem[],
  measure: (text: string, style: MarkdownTextTokens) => number
) {
  let y = initialY;
  let truncated = false;

  for (const item of block.items) {
    const style = resizeTextStyle(item.ordered ? theme.list.ordered : theme.list.unordered, typography.contentFontSize);
    const indent = item.depth * style.indent;
    const markerWidth = theme.layout.listMarkerWidth;
    const textX = indent + markerWidth + theme.layout.listMarkerGap;
    if (y + style.lineHeight > height || textX >= width) {
      truncated = true;
      break;
    }
    items.push({
      kind: "text",
      ...style,
      x: indent,
      y,
      width: markerWidth,
      align: "right",
      color: style.markerColor,
      text: item.ordered ? `${item.ordinal}.` : "•"
    });
    const strong = resizeTextStyle(theme.strong, typography.contentFontSize);
    const result = layoutRuns(item.runs, textX, y, width - textX, height, style, strong, items, measure);
    y += Math.max(style.lineHeight, result.height) + spacing.listItemGap;
    if (result.truncated) {
      truncated = true;
      break;
    }
  }

  if (block.items.length) y -= spacing.listItemGap;
  return { y, truncated };
}

function layoutBlockquote(
  block: Extract<MarkdownPreviewBlock, { kind: "blockquote" }>,
  initialY: number,
  width: number,
  height: number,
  theme: MarkdownThemeTokens,
  typography: PreviewTypography,
  spacing: PreviewSpacing,
  items: PreviewItem[],
  measure: (text: string, style: MarkdownTextTokens) => number
) {
  const style = resizeTextStyle(theme.blockquote, typography.contentFontSize);
  const contentX = style.paddingX;
  const contentWidth = Math.max(0, width - style.paddingX * 2);
  const backgroundIndex = items.length;
  let y = initialY + style.paddingY;
  let truncated = false;

  for (const [index, paragraph] of block.paragraphs.entries()) {
    if (index > 0) y += Math.min(spacing.blockGap, style.lineHeight * 0.6);
    const strong = { ...style, fontWeight: theme.strong.fontWeight };
    const result = layoutRuns(paragraph, contentX, y, contentWidth, Math.max(0, height - style.paddingY), style, strong, items, measure);
    y += result.height;
    if (result.truncated) {
      truncated = true;
      break;
    }
  }

  const quoteHeight = Math.max(0, Math.min(height - initialY, y - initialY + style.paddingY));
  items.splice(backgroundIndex, 0, {
    kind: "rect",
    x: 0,
    y: initialY,
    width,
    height: quoteHeight,
    fill: style.background,
    cornerRadius: style.radius
  });
  return { y: initialY + quoteHeight, truncated };
}

function layoutRuns(
  runs: MarkdownPreviewRun[],
  x: number,
  y: number,
  width: number,
  height: number,
  regular: MarkdownTextTokens,
  strong: MarkdownTextTokens,
  items: PreviewItem[],
  measure: (text: string, style: MarkdownTextTokens) => number
) {
  let cursorX = x;
  let lineY = y;
  let lineHeight = regular.lineHeight;
  let truncated = false;

  outer: for (const run of runs) {
    const style = run.bold ? strong : regular;
    for (const token of inlineTokens(run.text)) {
      const parts = measure(token, style) <= width ? [token] : Array.from(token);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part) && cursorX === x) continue;
        const partWidth = measure(part, style);
        if (cursorX > x && cursorX + partWidth > x + width) {
          lineY += lineHeight;
          cursorX = x;
          lineHeight = regular.lineHeight;
          if (/^\s+$/.test(part)) continue;
        }
        if (lineY + Math.max(lineHeight, style.lineHeight) > height) {
          truncated = true;
          break outer;
        }
        appendText(items, { ...style, x: cursorX, y: lineY, text: part }, measure);
        cursorX += partWidth;
        lineHeight = Math.max(lineHeight, style.lineHeight);
      }
    }
  }

  return { height: Math.max(0, lineY - y + lineHeight), truncated };
}

function appendText(items: PreviewItem[], item: Omit<PreviewText, "kind">, measure: (text: string, style: MarkdownTextTokens) => number) {
  const previous = items.at(-1);
  if (
    previous?.kind === "text" && previous.width == null && item.width == null && previous.y === item.y &&
    previous.x + measure(previous.text, previous) === item.x && sameTextStyle(previous, item)
  ) {
    previous.text += item.text;
    return;
  }
  items.push({ kind: "text", ...item });
}

function sameTextStyle(left: MarkdownTextTokens, right: MarkdownTextTokens) {
  return left.fontFamily === right.fontFamily && left.fontSize === right.fontSize && left.fontWeight === right.fontWeight &&
    left.lineHeight === right.lineHeight && left.letterSpacing === right.letterSpacing && left.color === right.color;
}

function inlineTokens(text: string) {
  return text.match(/\s+|[\u2e80-\u9fff\uf900-\ufaff]|[^\s\u2e80-\u9fff\uf900-\ufaff]+/g) || [];
}

function headingStyle(theme: MarkdownThemeTokens, level: 1 | 2 | 3 | 4 | 5 | 6, typography: PreviewTypography) {
  const progress = [1, 0.72, 0.56, 0.42, 0.28, 0.14][level - 1];
  const fontSize = typography.contentFontSize + (typography.titleFontSize - typography.contentFontSize) * progress;
  return resizeTextStyle(theme.heading[`h${level}`], Math.round(fontSize * 4) / 4);
}

function headingBoldStyle(style: MarkdownTextTokens, strong: MarkdownTextTokens): MarkdownTextTokens {
  return { ...style, fontWeight: strong.fontWeight };
}

function resizeTextStyle<T extends MarkdownTextTokens>(style: T, fontSize: number): T {
  const ratio = style.fontSize > 0 ? fontSize / style.fontSize : 1;
  return { ...style, fontSize, lineHeight: style.lineHeight * ratio };
}

function spacingBefore(previous: MarkdownPreviewBlock | undefined, current: MarkdownPreviewBlock, spacing: PreviewSpacing) {
  if (!previous) return 0;
  if (previous.kind === "heading") {
    return previous.level === 1 ? spacing.titleBottomGap : spacing.headingBottomGap;
  }
  if (current.kind === "heading") return spacing.sectionTopGap;
  return spacing.blockGap;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measurePreviewText(text: string, style: MarkdownTextTokens) {
  if (typeof document === "undefined") return Array.from(text).length * style.fontSize * 0.58;
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return Array.from(text).length * style.fontSize * 0.58;
  context.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  return context.measureText(text).width + Math.max(0, Array.from(text).length - 1) * style.letterSpacing;
}
