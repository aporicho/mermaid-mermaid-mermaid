import { useMemo } from "react";
import { Group, Line, Rect, Text } from "react-konva";

import type {
  SpecialNodeMarkdownPreviewTextTokens,
  SpecialNodeMarkdownDocumentTokens
} from "@/features/mermaid-editor/lib/editor-theme";
import {
  parseMarkdownPreview,
  type MarkdownPreviewBlock,
  type MarkdownPreviewRun
} from "@/features/mermaid-editor/lib/markdown-preview-parser";

type PreviewTextStyle = SpecialNodeMarkdownPreviewTextTokens;
type PreviewText = PreviewTextStyle & {
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

type PreviewLine = {
  kind: "line";
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
};

type PreviewItem = PreviewText | PreviewRect | PreviewLine;
type PreviewContent = SpecialNodeMarkdownDocumentTokens["previewContent"];

export function MarkdownDocumentContent({
  source,
  fallbackTitle,
  width,
  height,
  content
}: {
  source: string;
  fallbackTitle: string;
  width: number;
  height: number;
  content: PreviewContent;
}) {
  const items = useMemo(
    () => layoutMarkdownDocumentContent({ source, fallbackTitle, width, height, content }),
    [content, fallbackTitle, height, source, width]
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
      ) : item.kind === "line" ? (
        <Line
          key={`${index}:line:${item.points.join(":")}`}
          points={item.points}
          stroke={item.stroke}
          strokeWidth={item.strokeWidth}
          dash={item.dash}
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
          fontStyle={item.fontStyle === "italic" ? `italic ${item.fontWeight}` : String(item.fontWeight)}
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
  content,
  measure = measurePreviewText
}: {
  source: string;
  fallbackTitle: string;
  width: number;
  height: number;
  content: PreviewContent;
  measure?: (text: string, style: PreviewTextStyle) => number;
}) {
  const blocks = parseMarkdownPreview(source, fallbackTitle);
  const items: PreviewItem[] = [];
  let y = 0;
  let previous: MarkdownPreviewBlock | undefined;
  let documentTitleRendered = false;

  for (const block of blocks) {
    y += spacingBefore(previous, block, content.layout);
    if (y >= height) break;
    if (block.kind === "heading") {
      const isDocumentTitle = block.level === 1 && !documentTitleRendered;
      const style = isDocumentTitle ? content.title : content.heading.h1;
      const resolvedStyle = isDocumentTitle ? style : content.heading[`h${block.level}`];
      const result = layoutRuns(block.runs, 0, y, width, height, resolvedStyle, content, items, measure);
      y += result.height;
      if (result.truncated) break;
      if (isDocumentTitle) documentTitleRendered = true;
      previous = block;
      continue;
    }

    if (block.kind === "paragraph") {
      const result = layoutRuns(block.runs, 0, y, width, height, content.paragraph, content, items, measure);
      y += result.height;
      if (result.truncated) break;
      previous = block;
      continue;
    }

    if (block.kind === "list") {
      const listResult = layoutList(block, y, width, height, content, items, measure);
      y = listResult.y;
      if (listResult.truncated) break;
      previous = block;
      continue;
    }

    if (block.kind === "divider") {
      if (!content.divider.enabled) {
        previous = block;
        continue;
      }
      y += content.divider.marginTop;
      const thickness = Math.max(0, content.divider.thickness);
      if (y + thickness + content.divider.marginBottom > height) break;
      items.push({
        kind: "rect",
        x: 0,
        y,
        width,
        height: thickness,
        fill: content.divider.color,
        cornerRadius: 0
      });
      y += thickness + content.divider.marginBottom;
      previous = block;
      continue;
    }

    const quoteResult = layoutBlockquote(block, y, width, height, content, items, measure);
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
  content: PreviewContent,
  items: PreviewItem[],
  measure: (text: string, style: PreviewTextStyle) => number
) {
  let y = initialY;
  let truncated = false;

  for (const item of block.items) {
    const style = item.ordered ? content.list.ordered : content.list.unordered;
    const topLevelOrdered = item.ordered && item.depth === 0;
    const itemStyle = topLevelOrdered ? { ...style, fontWeight: content.strong.fontWeight } : style;
    const marker = item.ordered ? `${item.ordinal}.` : "•";
    const indent = content.layout.indentationEnabled ? item.depth * style.indent : 0;
    const markerWidth = content.layout.indentationEnabled ? content.layout.listMarkerWidth : measure(marker, itemStyle);
    const textX = indent + markerWidth + content.layout.listMarkerGap;
    if (y + style.lineHeight > height || textX >= width) {
      truncated = true;
      break;
    }
    items.push({
      kind: "text",
      ...itemStyle,
      x: indent,
      y,
      width: markerWidth,
      align: content.layout.indentationEnabled ? "right" : "left",
      color: itemStyle.markerColor,
      text: marker
    });
    const result = layoutRuns(
      item.runs,
      textX,
      y,
      width - textX,
      height,
      itemStyle,
      content,
      items,
      measure,
      content.layout.indentationEnabled ? undefined : { x: 0, width }
    );
    y += Math.max(style.lineHeight, result.height) + content.layout.listItemGap;
    if (result.truncated) {
      truncated = true;
      break;
    }
  }

  if (block.items.length) y -= content.layout.listItemGap;
  return { y, truncated };
}

function layoutBlockquote(
  block: Extract<MarkdownPreviewBlock, { kind: "blockquote" }>,
  initialY: number,
  width: number,
  height: number,
  content: PreviewContent,
  items: PreviewItem[],
  measure: (text: string, style: PreviewTextStyle) => number
) {
  const quote = content.blockquote;
  const style = quote.enabled ? quote : content.paragraph;
  const horizontalPadding = quote.enabled && content.layout.indentationEnabled ? quote.paddingX : 0;
  const verticalPadding = quote.enabled ? quote.paddingY : 0;
  const marginTop = quote.enabled ? quote.marginTop : 0;
  const marginBottom = quote.enabled ? quote.marginBottom : 0;
  const contentX = horizontalPadding;
  const contentWidth = Math.max(0, width - horizontalPadding * 2);
  const quoteY = initialY + marginTop;
  const decorationIndex = items.length;
  let y = quoteY + verticalPadding;
  let truncated = false;

  for (const [index, paragraph] of block.paragraphs.entries()) {
    if (index > 0) y += content.layout.paragraphGap;
    const result = layoutRuns(
      paragraph,
      contentX,
      y,
      contentWidth,
      Math.max(0, height - verticalPadding - marginBottom),
      style,
      content,
      items,
      measure
    );
    y += result.height;
    if (result.truncated) {
      truncated = true;
      break;
    }
  }

  const quoteHeight = Math.max(0, Math.min(height - quoteY - marginBottom, y - quoteY + verticalPadding));
  const decorations: PreviewItem[] = [];
  if (quote.enabled && quote.backgroundEnabled) {
    decorations.push({
      kind: "rect",
      x: 0,
      y: quoteY,
      width,
      height: quoteHeight,
      fill: quote.background,
      cornerRadius: quote.radius
    });
  }
  if (quote.enabled && quote.borderEnabled && quote.borderStyle !== "none" && quote.borderWidth > 0) {
    decorations.push({
      kind: "line",
      points: [quote.borderWidth / 2, quoteY, quote.borderWidth / 2, quoteY + quoteHeight],
      stroke: quote.borderColor,
      strokeWidth: quote.borderWidth,
      dash: previewStrokeDash(quote.borderStyle, quote.customDash)
    });
  }
  items.splice(decorationIndex, 0, ...decorations);
  return { y: quoteY + quoteHeight + marginBottom, truncated };
}

function layoutRuns(
  runs: MarkdownPreviewRun[],
  x: number,
  y: number,
  width: number,
  height: number,
  regular: PreviewTextStyle,
  content: PreviewContent,
  items: PreviewItem[],
  measure: (text: string, style: PreviewTextStyle) => number,
  continuation?: { x: number; width: number }
) {
  let lineX = x;
  let lineWidth = width;
  let cursorX = x;
  let lineY = y;
  let lineHeight = regular.lineHeight;
  let truncated = false;
  const continuationX = continuation?.x ?? x;
  const continuationWidth = continuation?.width ?? width;
  const widestLine = Math.max(width, continuationWidth);

  outer: for (const run of runs) {
    const style = inlineRunStyle(regular, run, content);
    for (const token of inlineTokens(run.text)) {
      const parts = measure(token, style) <= widestLine ? [token] : Array.from(token);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part) && cursorX === lineX) continue;
        const partWidth = measure(part, style);
        const exceedsLine = cursorX + partWidth > lineX + lineWidth;
        const canUseContinuationLine = lineX !== continuationX || lineWidth !== continuationWidth;
        if (exceedsLine && (cursorX > lineX || canUseContinuationLine)) {
          lineY += lineHeight;
          lineX = continuationX;
          lineWidth = continuationWidth;
          cursorX = lineX;
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

function appendText(items: PreviewItem[], item: Omit<PreviewText, "kind">, measure: (text: string, style: PreviewTextStyle) => number) {
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

function sameTextStyle(left: PreviewTextStyle, right: PreviewTextStyle) {
  return left.fontFamily === right.fontFamily && left.fontSize === right.fontSize && left.fontWeight === right.fontWeight &&
    left.fontStyle === right.fontStyle && left.lineHeight === right.lineHeight && left.letterSpacing === right.letterSpacing && left.color === right.color;
}

function inlineTokens(text: string) {
  return text.match(/\s+|[\u2e80-\u9fff\uf900-\ufaff]|[^\s\u2e80-\u9fff\uf900-\ufaff]+/g) || [];
}

function inlineRunStyle(regular: PreviewTextStyle, run: MarkdownPreviewRun, content: PreviewContent): PreviewTextStyle {
  const emphasis = run.italic ? content.emphasis : undefined;
  const strong = run.bold ? content.strong : undefined;
  return {
    ...regular,
    ...(emphasis || {}),
    ...(strong || {}),
    fontStyle: emphasis?.fontStyle ?? strong?.fontStyle ?? regular.fontStyle
  };
}

function spacingBefore(previous: MarkdownPreviewBlock | undefined, current: MarkdownPreviewBlock, spacing: PreviewContent["layout"]) {
  if (!previous) return 0;
  if (previous.kind === "heading") {
    return previous.level === 1 ? spacing.titleBottomGap : spacing.headingBottomGap;
  }
  if (current.kind === "heading") return spacing.sectionTopGap;
  if (previous.kind === "paragraph" && current.kind === "paragraph") return spacing.paragraphGap;
  return spacing.blockGap;
}

function previewStrokeDash(style: PreviewContent["blockquote"]["borderStyle"], customDash: readonly number[]) {
  if (style === "dashed") return [8, 6];
  if (style === "dotted") return [2, 4];
  if (style === "dash-dot") return [8, 4, 2, 4];
  if (style === "custom") return [...customDash];
  return undefined;
}

let measureCanvas: HTMLCanvasElement | null = null;

function measurePreviewText(text: string, style: PreviewTextStyle) {
  if (typeof document === "undefined") return Array.from(text).length * style.fontSize * 0.58;
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");
  if (!context) return Array.from(text).length * style.fontSize * 0.58;
  context.font = `${style.fontStyle === "italic" ? "italic " : ""}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  return context.measureText(text).width + Math.max(0, Array.from(text).length - 1) * style.letterSpacing;
}
