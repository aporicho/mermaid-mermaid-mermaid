import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import type { RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { flowchartPortPoints, isEllipseLikeFlowchartShape, opticalWeightScaleForShape, type ShapeGeometryPortKind } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, isEqualAspectFlowchartShape, normalizeFlowchartShape, type FlowchartNodeShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { LINK_CARD_NODE_WIDTH, linkCardNodeHeight, normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";
import {
  isMarkdownDocumentNode,
  MARKDOWN_DOCUMENT_NODE_HEIGHT,
  MARKDOWN_DOCUMENT_NODE_WIDTH
} from "@/features/mermaid-editor/lib/markdown-document";

export type NodeAnchorKey = string;

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
  kind: ShapeGeometryPortKind;
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

export type NodeGeometryTokens = {
  minChars: number;
  maxChars: number;
  paddingX: number;
  paddingY: number;
  fontSize: number;
  lineHeight: number;
  maxLines: number;
  fontFamily: string;
  fontWeight: number;
};

export type NodeGeometry = {
  id: string;
  frame: Rect;
  textBox: Rect;
  imageBox?: Rect;
  anchorsLocal: NodeAnchorPoint[];
  anchorsWorld: NodeAnchorPoint[];
  alignmentRect: AlignmentRect;
  routedRect: RoutedNodeRect;
};

export const DEFAULT_NODE_GEOMETRY_TOKENS: NodeGeometryTokens = {
  minChars: 6,
  maxChars: 24,
  paddingX: 14,
  paddingY: 14,
  fontSize: 14,
  lineHeight: 18,
  maxLines: 12,
  fontFamily: "'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei UI', system-ui, sans-serif",
  fontWeight: 700
};

let defaultTextMeasureCanvas: HTMLCanvasElement | null = null;

export function measureDefaultNodeTextWidth(value: string, tokens: NodeGeometryTokens = DEFAULT_NODE_GEOMETRY_TOKENS) {
  if (typeof document === "undefined") return value.length * tokens.fontSize * 0.58;

  defaultTextMeasureCanvas ??= document.createElement("canvas");
  const context = defaultTextMeasureCanvas.getContext("2d");
  if (!context) return value.length * tokens.fontSize * 0.58;

  context.font = `${tokens.fontWeight} ${tokens.fontSize}px ${tokens.fontFamily}`;
  return context.measureText(value).width;
}

export function defaultNodeGeometrySpec(measureText: (value: string) => number = measureDefaultNodeTextWidth, tokens: NodeGeometryTokens = DEFAULT_NODE_GEOMETRY_TOKENS): NodeGeometrySpec {
  return {
    minChars: tokens.minChars,
    maxChars: tokens.maxChars,
    paddingX: tokens.paddingX,
    paddingY: tokens.paddingY,
    lineHeight: tokens.lineHeight,
    maxLines: tokens.maxLines,
    measureText
  };
}

export function buildNodeGeometry(node: CanvasNode, spec: NodeGeometrySpec): NodeGeometry {
  if (isMarkdownDocumentNode(node)) return buildMarkdownDocumentNodeGeometry(node);

  const preview = normalizeCanvasNodePreview(node.preview);
  if (preview) return buildLinkCardNodeGeometry(node);

  const asset = normalizeImageAsset(node.asset);
  if (asset) return buildImageNodeGeometry(node, asset);

  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  const textWidth = nodeTextWidth(node, spec);
  const textHeight = Math.min(spec.maxLines, countWrappedLines(node.label, textWidth, spec.measureText)) * spec.lineHeight;
  const size = nodeFrameSize(shape, textWidth, textHeight, spec);
  const frame = {
    x: node.x,
    y: node.y,
    width: size.width,
    height: size.height
  };
  const textBox = {
    x: (frame.width - textWidth) / 2,
    y: (frame.height - textHeight) / 2,
    width: textWidth,
    height: textHeight
  };
  const anchorsLocal = localAnchorPoints(shape, frame.width, frame.height);
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
    routedRect: { id: node.id, ...frame, shape }
  };
}

function buildMarkdownDocumentNodeGeometry(node: CanvasNode): NodeGeometry {
  const frame = {
    x: node.x,
    y: node.y,
    width: MARKDOWN_DOCUMENT_NODE_WIDTH,
    height: MARKDOWN_DOCUMENT_NODE_HEIGHT
  };
  const textBox = {
    x: 60,
    y: 12,
    width: frame.width - 72,
    height: 22
  };
  const anchorsLocal = localAnchorPoints(DEFAULT_FLOWCHART_NODE_SHAPE, frame.width, frame.height);
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
    routedRect: { id: node.id, ...frame, shape: DEFAULT_FLOWCHART_NODE_SHAPE }
  };
}

function buildLinkCardNodeGeometry(node: CanvasNode): NodeGeometry {
  const preview = normalizeCanvasNodePreview(node.preview);
  const height = linkCardNodeHeight(preview);
  const frame = {
    x: node.x,
    y: node.y,
    width: LINK_CARD_NODE_WIDTH,
    height
  };
  const textBox = {
    x: 12,
    y: height - 76,
    width: LINK_CARD_NODE_WIDTH - 24,
    height: 48
  };
  const anchorsLocal = localAnchorPoints(DEFAULT_FLOWCHART_NODE_SHAPE, frame.width, frame.height);
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
    routedRect: { id: node.id, ...frame, shape: DEFAULT_FLOWCHART_NODE_SHAPE }
  };
}

function buildImageNodeGeometry(node: CanvasNode, asset: NonNullable<ReturnType<typeof normalizeImageAsset>>): NodeGeometry {
  const frame = {
    x: node.x,
    y: node.y,
    width: asset.width,
    height: asset.height
  };
  const imageBox = {
    x: 0,
    y: 0,
    width: asset.width,
    height: asset.height
  };
  const textBox = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
  const anchorsLocal = localAnchorPoints(DEFAULT_FLOWCHART_NODE_SHAPE, frame.width, frame.height);
  const anchorsWorld = anchorsLocal.map((anchor) => ({
    ...anchor,
    x: frame.x + anchor.x,
    y: frame.y + anchor.y
  }));

  return {
    id: node.id,
    frame,
    textBox,
    imageBox,
    anchorsLocal,
    anchorsWorld,
    alignmentRect: { id: node.id, ...frame },
    routedRect: { id: node.id, ...frame, shape: DEFAULT_FLOWCHART_NODE_SHAPE }
  };
}

function nodeFrameSize(shape: FlowchartNodeShape, textWidth: number, textHeight: number, spec: NodeGeometrySpec) {
  const baseWidth = textWidth + spec.paddingX * 2;
  const baseHeight = textHeight + spec.paddingY * 2;

  if (!isEqualAspectFlowchartShape(shape)) {
    return { width: baseWidth, height: baseHeight };
  }

  const baseSide = Math.max(baseWidth, baseHeight);
  const opticalSide = baseSide * opticalWeightScaleForShape(shape);

  if (isEllipseLikeFlowchartShape(shape)) {
    const circleSize = Math.ceil(Math.hypot(textWidth, textHeight) + Math.max(spec.paddingX, spec.paddingY) * 2);
    return squareSize(Math.ceil(Math.max(circleSize, opticalSide)));
  }

  if (shape === "diam") {
    const diamondSize = Math.ceil(textWidth + textHeight + spec.paddingX * 2 + spec.paddingY * 2);
    return squareSize(Math.ceil(Math.max(diamondSize, opticalSide)));
  }

  return squareSize(Math.ceil(opticalSide));
}

function squareSize(size: number) {
  return { width: size, height: size };
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

function localAnchorPoints(shape: FlowchartNodeShape, width: number, height: number): NodeAnchorPoint[] {
  return flowchartPortPoints(shape, { x: 0, y: 0, width, height }).map((port) => ({
    key: port.key,
    kind: port.kind,
    x: port.point.x,
    y: port.point.y
  }));
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
