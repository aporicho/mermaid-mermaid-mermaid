import type { EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import { buildEdgeLabelGeometry, type EdgeLabelGeometrySpec } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { CanvasPoint, HitTarget, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import type { CanvasEdge, CanvasNode, EditorMode, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { flowchartPolygonPoints } from "@/features/mermaid-editor/lib/flowchart-shape-geometry";
import { DEFAULT_FLOWCHART_NODE_SHAPE, normalizeFlowchartShape } from "@/features/mermaid-editor/lib/flowchart-shapes";
import type { NodeGeometry, Rect } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

export type CanvasPointerTarget =
  | HitTarget
  | { kind: "tableColumnResize"; nodeId: string; columnId: string; columnIndex: number; startWidth: number };

export type CanvasGeometryHitTester = {
  resolve: (point: CanvasPoint, context: CanvasHitTestContext) => CanvasPointerTarget;
};

export type CanvasHitTestContext = {
  viewportScale: number;
  mode: EditorMode;
  selection: Selection;
  interactionState: InteractionState;
  inlineEditing: boolean;
  hoveredNodeId: string | null;
  hoveredSubgraphId: string | null;
  connectionTargetNodeId?: string | null;
  connectionInvalidNodeId?: string | null;
  connectionTargetSubgraphId?: string | null;
  connectionInvalidSubgraphId?: string | null;
};

export type CanvasGeometryHitTesterInput = {
  nodes: CanvasNode[];
  nodeGeometryById: Map<string, NodeGeometry>;
  subgraphs: SubgraphGeometry[];
  edges: CanvasEdge[];
  edgeGeometry: (edge: CanvasEdge) => EdgePathGeometry | null;
  edgeLabelSpec: EdgeLabelGeometrySpec;
  visualTokens: CanvasVisualTokens;
  specialNodeTokens: SpecialNodeThemeTokens;
  nodeProximityScale?: Record<string, number>;
  viewNodes: boolean;
  viewEdges: boolean;
  viewEdgeLabels: boolean;
  viewSubgraphs: boolean;
};

type IndexedRect<T> = { frame: Rect; value: T; order: number };
type EdgeSegment = {
  edge: CanvasEdge;
  order: number;
  from: CanvasPoint;
  to: CanvasPoint;
};

const INDEX_CELL_SIZE = 256;
const EDGE_HIT_RADIUS_MIN_PX = 4;
const COMPARISON_EPSILON = 1e-6;

export function createCanvasGeometryHitTester(input: CanvasGeometryHitTesterInput): CanvasGeometryHitTester {
  const nodeEntries = input.nodes.flatMap((node, order) => {
    const geometry = input.nodeGeometryById.get(node.id);
    if (!geometry) return [];
    const scale = input.nodeProximityScale?.[node.id] ?? 1;
    return [{ frame: scaleRectFromCenter(geometry.frame, scale), value: { node, geometry, scale }, order }];
  });
  const nodeIndex = createRectQueryIndex(nodeEntries);
  const subgraphEntries = input.subgraphs.map((geometry, order) => ({ frame: geometry.frame, value: geometry, order }));
  const subgraphIndex = createRectQueryIndex(subgraphEntries);

  const edgeEntries = input.edges.flatMap((edge, order) => {
    const geometry = input.edgeGeometry(edge);
    return geometry ? [{ edge, geometry, order }] : [];
  });
  const edgeSegmentIndex = createRectQueryIndex(edgeEntries.flatMap(({ edge, geometry, order }) => {
    const points = geometry.points;
    const segments: IndexedRect<EdgeSegment>[] = [];
    for (let index = 2; index < points.length; index += 2) {
      const from = { x: points[index - 2], y: points[index - 1] };
      const to = { x: points[index], y: points[index + 1] };
      segments.push({ frame: segmentBounds(from, to), value: { edge, order, from, to }, order });
    }
    return segments;
  }));
  const edgeLabelIndex = createRectQueryIndex(edgeEntries.flatMap(({ edge, geometry, order }) => {
    if (!input.viewEdgeLabels || !edge.label) return [];
    const label = buildEdgeLabelGeometry(edge.label, geometry.labelPoint, input.edgeLabelSpec);
    return [{ frame: label.frame, value: { edge, frame: label.frame }, order }];
  }));

  function resolve(point: CanvasPoint, context: CanvasHitTestContext): CanvasPointerTarget {
    const viewportScale = Math.max(0.01, context.viewportScale);
    const nodeCandidates = input.viewNodes
      ? nodeIndex.query(pointBounds(point, controlQueryRadiusWorld(input, viewportScale))).sort(descendingOrder)
      : [];

    // Handles and explicit controls always win over document content.
    const endpoint = resolveEdgeEndpoint(point, context, edgeEntries, input.visualTokens, viewportScale);
    if (endpoint) return endpoint;

    for (const candidate of nodeCandidates) {
      const control = resolveNodeControl(point, candidate.value.node, candidate.value.geometry, candidate.value.scale, context, input);
      if (control) return control;
    }

    if (input.viewSubgraphs) {
      const anchors = resolveSubgraphAnchor(point, context, input, subgraphEntries);
      if (anchors) return anchors;
    }

    // Table cells and nodes sit above edges in the visual stack.
    for (const candidate of nodeCandidates) {
      const target = resolveNodeTarget(point, candidate.value.node, candidate.value.geometry, candidate.value.scale);
      if (target) return target;
    }

    if (input.viewEdges && input.viewEdgeLabels) {
      const labels = edgeLabelIndex.atPoint(point).sort(descendingOrder);
      if (labels[0]) return { kind: "edgeLabel", id: labels[0].value.edge.id };
    }

    if (input.viewEdges) {
      const radiusWorld = Math.max(EDGE_HIT_RADIUS_MIN_PX, input.visualTokens.edge.hitStrokeWidth / 2) / viewportScale;
      const candidates = edgeSegmentIndex.query(pointBounds(point, radiusWorld)).sort(descendingOrder);
      let best: { edge: CanvasEdge; order: number; distance: number } | null = null;
      for (const candidate of candidates) {
        const distance = pointToSegmentDistance(point, candidate.value.from, candidate.value.to);
        if (distance > radiusWorld) continue;
        if (!best || candidate.order > best.order || (candidate.order === best.order && distance < best.distance)) {
          best = { edge: candidate.value.edge, order: candidate.order, distance };
        }
      }
      if (best) return { kind: "edge", id: best.edge.id };
    }

    if (input.viewSubgraphs) {
      const candidates = subgraphIndex.query(pointBounds(point, groupHitRadiusWorld(input, viewportScale)))
        .sort((left, right) => right.value.depth - left.value.depth || right.order - left.order);
      for (const candidate of candidates) {
        const geometry = candidate.value;
        if (pointInsideRect(point, geometry.titleBox)) return { kind: "subgraphTitle", id: geometry.id };
      }
      const borderRadius = groupHitRadiusWorld(input, viewportScale);
      for (const candidate of candidates) {
        if (pointNearRectBorder(point, candidate.value.frame, borderRadius)) return { kind: "subgraph", id: candidate.value.id };
      }
    }

    return { kind: "blank" };
  }

  return { resolve };
}

export function pointerTargetInteractionHit(target: CanvasPointerTarget): HitTarget {
  if (target.kind === "tableColumnResize") return { kind: "node", id: target.nodeId };
  return target;
}

function resolveNodeControl(
  point: CanvasPoint,
  node: CanvasNode,
  geometry: NodeGeometry,
  scale: number,
  context: CanvasHitTestContext,
  input: CanvasGeometryHitTesterInput
): CanvasPointerTarget | null {
  const local = inverseScaledLocalPoint(point, geometry.frame, scale);
  const viewportScale = Math.max(0.01, context.viewportScale);
  const kind = resolveCanvasNodeKind(node);

  if (kind === "table" && geometry.table && context.mode === "select" && context.interactionState.kind === "idle" && !context.inlineEditing) {
    const tolerance = input.specialNodeTokens.table.resizeHandleWidth / 2 / viewportScale / Math.max(scale, 0.01);
    for (let index = geometry.table.columnBoundaries.length - 2; index >= 0; index -= 1) {
      const boundary = geometry.table.columnBoundaries[index];
      if (Math.abs(local.x - boundary) <= tolerance && local.y >= 0 && local.y <= geometry.table.height) {
        const column = geometry.table.headerCells[index];
        if (column) {
          return {
            kind: "tableColumnResize",
            nodeId: node.id,
            columnId: column.columnId,
            columnIndex: index,
            startWidth: geometry.table.columnWidths[index]
          };
        }
      }
    }
  }

  if (connectionAnchorsInteractive(context)) {
    const radiusWorld = connectionAnchorHitRadiusWorld(input, viewportScale);
    for (const anchor of [...geometry.anchorsLocal].reverse()) {
      const scaled = scaleLocalPoint(anchor, geometry.frame, scale);
      const anchorPoint = { x: geometry.frame.x + scaled.x, y: geometry.frame.y + scaled.y };
      if (pointDistance(point, anchorPoint) <= radiusWorld) return { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key };
    }
  }

  return null;
}

function resolveNodeTarget(point: CanvasPoint, node: CanvasNode, geometry: NodeGeometry, scale: number): HitTarget | null {
  const local = inverseScaledLocalPoint(point, geometry.frame, scale);
  if (!pointInsideRect(local, { x: 0, y: 0, width: geometry.frame.width, height: geometry.frame.height })) return null;

  if (resolveCanvasNodeKind(node) === "table" && geometry.table) {
    for (const cell of geometry.table.headerCells) {
      if (pointInsideRect(local, cell.frame)) return { kind: "tableHeader", nodeId: node.id, columnId: cell.columnId };
    }
    for (const cell of geometry.table.cells) {
      if (pointInsideRect(local, cell.frame)) return { kind: "tableCell", nodeId: node.id, rowId: cell.rowId, columnId: cell.columnId };
    }
    return { kind: "node", id: node.id };
  }

  if (resolveCanvasNodeKind(node) !== "standard") return { kind: "node", id: node.id };
  const shape = normalizeFlowchartShape(node.shape) || DEFAULT_FLOWCHART_NODE_SHAPE;
  if (isEllipseShape(shape)) {
    const rx = geometry.frame.width / 2;
    const ry = geometry.frame.height / 2;
    const dx = (local.x - rx) / Math.max(rx, COMPARISON_EPSILON);
    const dy = (local.y - ry) / Math.max(ry, COMPARISON_EPSILON);
    return dx * dx + dy * dy <= 1 ? { kind: "node", id: node.id } : null;
  }
  const polygon = flowchartPolygonPoints(shape, { x: 0, y: 0, width: geometry.frame.width, height: geometry.frame.height });
  if (polygon.length >= 3 && !pointInsidePolygon(local, polygon)) return null;
  return { kind: "node", id: node.id };
}

function resolveEdgeEndpoint(
  point: CanvasPoint,
  context: CanvasHitTestContext,
  edges: { edge: CanvasEdge; geometry: EdgePathGeometry; order: number }[],
  tokens: CanvasVisualTokens,
  viewportScale: number
): HitTarget | null {
  if (context.mode !== "select" || context.selection.edgeIds.length !== 1) return null;
  const selectedId = context.selection.edgeIds[0];
  const entry = edges.find((candidate) => candidate.edge.id === selectedId);
  if (!entry) return null;
  const radius = (tokens.overlay.anchor.endpointRadius + tokens.overlay.anchor.activeRadiusBoost) / viewportScale;
  if (pointDistance(point, entry.geometry.start) <= radius) return { kind: "edgeEndpoint", edgeId: selectedId, side: "from" };
  if (pointDistance(point, entry.geometry.end) <= radius) return { kind: "edgeEndpoint", edgeId: selectedId, side: "to" };
  return null;
}

function resolveSubgraphAnchor(
  point: CanvasPoint,
  context: CanvasHitTestContext,
  input: CanvasGeometryHitTesterInput,
  entries: IndexedRect<SubgraphGeometry>[]
): HitTarget | null {
  if (!connectionAnchorsInteractive(context)) return null;
  const radius = connectionAnchorHitRadiusWorld(input, context.viewportScale);
  for (const candidate of [...entries].sort((left, right) => right.value.depth - left.value.depth || right.order - left.order)) {
    const geometry = candidate.value;
    for (const anchor of [...geometry.anchorsWorld].reverse()) {
      if (pointDistance(point, anchor) <= radius) return { kind: "subgraphAnchor", subgraphId: geometry.id, anchor: anchor.key };
    }
  }
  return null;
}

function connectionAnchorsInteractive(context: CanvasHitTestContext) {
  return context.mode === "select" && !context.inlineEditing && context.interactionState.kind === "idle";
}

function connectionAnchorHitRadiusWorld(input: CanvasGeometryHitTesterInput, viewportScale: number) {
  const radius = input.visualTokens.overlay.anchor.radius;
  return Math.max(radius, radius / Math.max(0.01, viewportScale));
}

function createRectQueryIndex<T>(entries: IndexedRect<T>[]) {
  const cells = new Map<string, number[]>();
  entries.forEach((entry, index) => forEachCell(entry.frame, (key) => {
    const values = cells.get(key);
    if (values) values.push(index);
    else cells.set(key, [index]);
  }));

  function query(bounds: Rect) {
    const indexes = new Set<number>();
    forEachCell(bounds, (key) => {
      for (const index of cells.get(key) || []) indexes.add(index);
    });
    return [...indexes].map((index) => entries[index]).filter((entry) => rectsIntersect(entry.frame, bounds));
  }

  return {
    query,
    atPoint(point: CanvasPoint) {
      return query(pointBounds(point, 0.0001)).filter((entry) => pointInsideRect(point, entry.frame));
    }
  };
}

function forEachCell(frame: Rect, visit: (key: string) => void) {
  const left = Math.floor(frame.x / INDEX_CELL_SIZE);
  const top = Math.floor(frame.y / INDEX_CELL_SIZE);
  const right = Math.floor((frame.x + Math.max(0, frame.width)) / INDEX_CELL_SIZE);
  const bottom = Math.floor((frame.y + Math.max(0, frame.height)) / INDEX_CELL_SIZE);
  for (let x = left; x <= right; x += 1) {
    for (let y = top; y <= bottom; y += 1) visit(`${x}:${y}`);
  }
}

function descendingOrder<T>(left: IndexedRect<T>, right: IndexedRect<T>) {
  return right.order - left.order;
}

function segmentBounds(from: CanvasPoint, to: CanvasPoint): Rect {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.max(COMPARISON_EPSILON, Math.abs(to.x - from.x)),
    height: Math.max(COMPARISON_EPSILON, Math.abs(to.y - from.y))
  };
}

function pointBounds(point: CanvasPoint, radius: number): Rect {
  return { x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2 };
}

function controlQueryRadiusWorld(input: CanvasGeometryHitTesterInput, viewportScale: number) {
  return Math.max(
    input.visualTokens.overlay.anchor.endpointRadius + input.visualTokens.overlay.anchor.activeRadiusBoost,
    connectionAnchorHitRadiusWorld(input, viewportScale) * viewportScale,
    input.specialNodeTokens.table.resizeHandleWidth / 2
  ) / viewportScale;
}

function groupHitRadiusWorld(input: CanvasGeometryHitTesterInput, viewportScale: number) {
  return Math.max(4, input.visualTokens.group.emphasizedBorderWidth + 2) / viewportScale;
}

function inverseScaledLocalPoint(point: CanvasPoint, frame: Rect, scale: number) {
  const safeScale = Math.max(0.01, scale);
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    x: frame.width / 2 + (point.x - centerX) / safeScale,
    y: frame.height / 2 + (point.y - centerY) / safeScale
  };
}

function scaleLocalPoint(point: CanvasPoint, frame: Rect, scale: number) {
  return {
    x: frame.width / 2 + (point.x - frame.width / 2) * scale,
    y: frame.height / 2 + (point.y - frame.height / 2) * scale
  };
}

function scaleRectFromCenter(frame: Rect, scale: number): Rect {
  if (Math.abs(scale - 1) < COMPARISON_EPSILON) return frame;
  const width = frame.width * scale;
  const height = frame.height * scale;
  return {
    x: frame.x + (frame.width - width) / 2,
    y: frame.y + (frame.height - height) / 2,
    width,
    height
  };
}

function pointInsidePolygon(point: CanvasPoint, polygon: CanvasPoint[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y || COMPARISON_EPSILON) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isEllipseShape(shape: string) {
  return shape === "circle" || shape === "sm-circ" || shape === "f-circ" || shape === "dbl-circ" || shape === "fr-circ" || shape === "cross-circ";
}

function pointNearRectBorder(point: CanvasPoint, frame: Rect, tolerance: number) {
  if (!pointInsideRect(point, {
    x: frame.x - tolerance,
    y: frame.y - tolerance,
    width: frame.width + tolerance * 2,
    height: frame.height + tolerance * 2
  })) return false;
  const inner = {
    x: frame.x + tolerance,
    y: frame.y + tolerance,
    width: Math.max(0, frame.width - tolerance * 2),
    height: Math.max(0, frame.height - tolerance * 2)
  };
  return !pointInsideRect(point, inner);
}

function pointToSegmentDistance(point: CanvasPoint, from: CanvasPoint, to: CanvasPoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= COMPARISON_EPSILON) return pointDistance(point, from);
  const ratio = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return pointDistance(point, { x: from.x + dx * ratio, y: from.y + dy * ratio });
}

function pointDistance(left: CanvasPoint, right: CanvasPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function pointInsideRect(point: CanvasPoint, frame: Rect) {
  return point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height;
}

function rectsIntersect(left: Rect, right: Rect) {
  return left.x <= right.x + right.width && left.x + left.width >= right.x && left.y <= right.y + right.height && left.y + left.height >= right.y;
}
