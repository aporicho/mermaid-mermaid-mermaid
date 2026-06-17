import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import { flowchartPortPoints, type ShapeGeometryPortKind } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import type { NodeAnchorPoint, NodeGeometry, Rect } from "@/features/mermaid-editor/lib/node-geometry";
import type { RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasSubgraph, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

export type SubgraphGeometry = {
  id: string;
  frame: Rect;
  titleBox: Rect;
  contentBox: Rect;
  anchorsLocal: NodeAnchorPoint[];
  anchorsWorld: NodeAnchorPoint[];
  alignmentRect: AlignmentRect;
  routedRect: RoutedNodeRect;
  depth: number;
};

export type SubgraphGeometryTokens = {
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
  titleHeight: number;
  titleInsetX: number;
  titleInsetTop: number;
  titlePaddingX: number;
  minWidth: number;
  minHeight: number;
  fallbackGap: number;
};

export const SUBGRAPH_GEOMETRY_TOKENS: SubgraphGeometryTokens = {
  paddingX: 36,
  paddingTop: 54,
  paddingBottom: 32,
  titleHeight: 28,
  titleInsetX: 14,
  titleInsetTop: 10,
  titlePaddingX: 10,
  minWidth: 220,
  minHeight: 128,
  fallbackGap: 48
};

export function buildSubgraphGeometries(graph: MermaidGraph, nodeGeometries: NodeGeometry[], tokens: SubgraphGeometryTokens = SUBGRAPH_GEOMETRY_TOKENS): SubgraphGeometry[] {
  const nodeById = new Map(nodeGeometries.map((geometry) => [geometry.id, geometry]));
  const subgraphById = new Map((graph.subgraphs || []).map((subgraph) => [subgraph.id, subgraph]));
  const geometryById = new Map<string, SubgraphGeometry>();
  const visiting = new Set<string>();

  function build(subgraph: CanvasSubgraph, index: number, depth = 0): SubgraphGeometry {
    const cached = geometryById.get(subgraph.id);
    if (cached) return cached;
    if (visiting.has(subgraph.id)) return fallbackGeometry(subgraph, index, depth, tokens);
    visiting.add(subgraph.id);

    const childSubgraphs = (graph.subgraphs || []).filter((item) => item.parentId === subgraph.id);
    const childFrames = childSubgraphs.map((child, childIndex) => build(child, childIndex, depth + 1).frame);
    const nodeFrames = subgraph.nodeIds.map((nodeId) => nodeById.get(nodeId)?.frame).filter(Boolean) as Rect[];
    const contentBounds = unionRects([...nodeFrames, ...childFrames]);
    const geometry = contentBounds ? geometryFromContentBounds(subgraph.id, contentBounds, depth, tokens) : fallbackGeometry(subgraph, index, depth, tokens);

    geometryById.set(subgraph.id, geometry);
    visiting.delete(subgraph.id);
    return geometry;
  }

  return (graph.subgraphs || []).map((subgraph, index) => build(subgraph, index, subgraphDepth(subgraph, subgraphById)));
}

export function subgraphAtPoint(geometries: SubgraphGeometry[], point: { x: number; y: number }, ignoredIds: string[] = []) {
  const ignored = new Set(ignoredIds);
  return geometries
    .filter((geometry) => !ignored.has(geometry.id) && pointInsideRect(point, geometry.contentBox))
    .sort((a, b) => b.depth - a.depth || area(a.frame) - area(b.frame))[0] ?? null;
}

export function subgraphIntersectsRect(geometry: SubgraphGeometry, rect: Rect) {
  const frame = geometry.frame;
  return frame.x < rect.x + rect.width && frame.x + frame.width > rect.x && frame.y < rect.y + rect.height && frame.y + frame.height > rect.y;
}

function geometryFromContentBounds(id: string, contentBounds: Rect, depth: number, tokens: SubgraphGeometryTokens): SubgraphGeometry {
  const width = Math.max(tokens.minWidth, contentBounds.width + tokens.paddingX * 2);
  const height = Math.max(tokens.minHeight, contentBounds.height + tokens.paddingTop + tokens.paddingBottom);
  const frame = {
    x: contentBounds.x - (width - contentBounds.width) / 2,
    y: contentBounds.y - tokens.paddingTop,
    width,
    height
  };

  return buildGeometry(id, frame, depth, tokens);
}

function fallbackGeometry(subgraph: CanvasSubgraph, index: number, depth: number, tokens: SubgraphGeometryTokens): SubgraphGeometry {
  return buildGeometry(
    subgraph.id,
    {
      x: 80 + index * tokens.fallbackGap,
      y: 80 + index * tokens.fallbackGap,
      width: tokens.minWidth,
      height: tokens.minHeight
    },
    depth,
    tokens
  );
}

function buildGeometry(id: string, frame: Rect, depth: number, tokens: SubgraphGeometryTokens): SubgraphGeometry {
  const titleBox = {
    x: frame.x + tokens.titleInsetX,
    y: frame.y + tokens.titleInsetTop,
    width: Math.max(1, frame.width - tokens.titleInsetX * 2),
    height: tokens.titleHeight
  };
  const contentBox = {
    x: frame.x + tokens.paddingX,
    y: frame.y + tokens.paddingTop,
    width: Math.max(1, frame.width - tokens.paddingX * 2),
    height: Math.max(1, frame.height - tokens.paddingTop - tokens.paddingBottom)
  };
  const anchorsLocal = localAnchorPoints(frame.width, frame.height);
  const anchorsWorld = anchorsLocal.map((anchor) => ({
    ...anchor,
    x: frame.x + anchor.x,
    y: frame.y + anchor.y
  }));

  return {
    id,
    frame,
    titleBox,
    contentBox,
    anchorsLocal,
    anchorsWorld,
    alignmentRect: { id, ...frame },
    routedRect: { id, ...frame, shape: "rounded" },
    depth
  };
}

function localAnchorPoints(width: number, height: number): NodeAnchorPoint[] {
  return flowchartPortPoints("rect", { x: 0, y: 0, width, height }).map((port) => ({
    key: port.key,
    kind: port.kind as ShapeGeometryPortKind,
    x: port.point.x,
    y: port.point.y
  }));
}

function unionRects(rects: Rect[]) {
  if (!rects.length) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function pointInsideRect(point: { x: number; y: number }, rect: Rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function area(rect: Rect) {
  return rect.width * rect.height;
}

function subgraphDepth(subgraph: CanvasSubgraph, subgraphById: Map<string, CanvasSubgraph>) {
  let depth = 0;
  let current = subgraph.parentId ? subgraphById.get(subgraph.parentId) : undefined;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = current.parentId ? subgraphById.get(current.parentId) : undefined;
  }

  return depth;
}
