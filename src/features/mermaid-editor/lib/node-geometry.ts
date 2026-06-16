import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import type { RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

export type NodeAnchorKey = "top" | "right" | "bottom" | "left";

export type Point = {
  x: number;
  y: number;
};

export type Rect = Point & {
  width: number;
  height: number;
};

export type NodeAnchorPoint = Point & {
  key: NodeAnchorKey;
};

export type NodeGeometrySpec = {
  minChars: number;
  maxChars: number;
  paddingX: number;
  paddingY: number;
  lineHeight: number;
  maxLines: number;
  measureText: (value: string) => number;
};

export type NodeGeometry = {
  id: string;
  frame: Rect;
  textBox: Rect;
  anchorsLocal: NodeAnchorPoint[];
  anchorsWorld: NodeAnchorPoint[];
  alignmentRect: AlignmentRect;
  routedRect: RoutedNodeRect;
};

export function buildNodeGeometry(node: CanvasNode, spec: NodeGeometrySpec): NodeGeometry {
  const textWidth = nodeTextWidth(node, spec);
  const textHeight = Math.min(spec.maxLines, countWrappedLines(node.label, textWidth, spec.measureText)) * spec.lineHeight;
  const frame = {
    x: node.x,
    y: node.y,
    width: textWidth + spec.paddingX * 2,
    height: textHeight + spec.paddingY * 2
  };
  const textBox = {
    x: spec.paddingX,
    y: spec.paddingY,
    width: textWidth,
    height: textHeight
  };
  const anchorsLocal = localAnchorPoints(frame.width, frame.height);
  const anchorsWorld = anchorsLocal.map((anchor) => ({
    ...anchor,
    x: frame.x + anchor.x,
    y: frame.y + anchor.y
  }));

  return {
    id: node.id,
    frame,
    textBox,
    anchorsLocal,
    anchorsWorld,
    alignmentRect: { id: node.id, ...frame },
    routedRect: { id: node.id, ...frame }
  };
}

export function nodeTextWidth(node: CanvasNode, spec: NodeGeometrySpec) {
  const characterWidth = spec.measureText("中");
  const minWidth = spec.minChars * characterWidth;
  const maxWidth = spec.maxChars * characterWidth;
  const lineWidths = (node.label || " ").split(/\r?\n/).map((line) => spec.measureText(line || " "));
  const preferredWidth = Math.ceil(Math.max(...lineWidths));

  return clamp(preferredWidth, minWidth, maxWidth);
}

export function pointInsideNodeFrame(point: Point, geometry: NodeGeometry) {
  const { frame } = geometry;
  return point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height;
}

export function nodeIntersectsRect(geometry: NodeGeometry, rect: Rect) {
  const { frame } = geometry;
  return frame.x < rect.x + rect.width && frame.x + frame.width > rect.x && frame.y < rect.y + rect.height && frame.y + frame.height > rect.y;
}

function localAnchorPoints(width: number, height: number): NodeAnchorPoint[] {
  return [
    { key: "top", x: width / 2, y: 0 },
    { key: "right", x: width, y: height / 2 },
    { key: "bottom", x: width / 2, y: height },
    { key: "left", x: 0, y: height / 2 }
  ];
}

function countWrappedLines(value: string, maxWidth: number, measureText: (value: string) => number) {
  const paragraphs = (value || " ").split(/\r?\n/);

  return paragraphs.reduce((total, paragraph) => {
    if (!paragraph) return total + 1;

    let lines = 1;
    let currentWidth = 0;
    const tokens = paragraph.match(/\s+|[^\s]+/g) || [paragraph];

    for (const token of tokens) {
      if (/^\s+$/.test(token) && currentWidth === 0) continue;
      const tokenWidth = measureText(token);

      if (tokenWidth > maxWidth) {
        for (const character of token) {
          const characterWidth = measureText(character);
          if (currentWidth > 0 && currentWidth + characterWidth > maxWidth) {
            lines += 1;
            currentWidth = characterWidth;
          } else {
            currentWidth += characterWidth;
          }
        }
        continue;
      }

      if (currentWidth > 0 && currentWidth + tokenWidth > maxWidth) {
        lines += 1;
        currentWidth = /^\s+$/.test(token) ? 0 : tokenWidth;
      } else {
        currentWidth += tokenWidth;
      }
    }

    return total + lines;
  }, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
