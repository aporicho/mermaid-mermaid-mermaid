import { Graph, layout as dagreLayout, type EdgeLabel, type GraphLabel, type NodeLabel } from "@dagrejs/dagre";
import { curveBasis, line } from "d3-shape";

import type { CanvasNode, CanvasSubgraph, GraphDirection, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { EdgePathGeometry } from "@/features/mermaid-editor/lib/edge-geometry";
import { buildNodeGeometry, defaultNodeGeometrySpec, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

type DagreGraph = Graph<GraphLabel, NodeLabel, EdgeLabel>;

type AutoLayoutOptions = {
  spec?: NodeGeometrySpec;
  origin?: { x: number; y: number };
};

type LayoutNormalization = {
  offsetX: number;
  offsetY: number;
};

export type DagreEdgeRoute = EdgePathGeometry & {
  edgeId: string;
  pathData: string;
};

export type DagreAutoLayoutResult = {
  graph: MermaidGraph;
  edgeRoutes: DagreEdgeRoute[];
};

const DEFAULT_LAYOUT_ORIGIN = { x: 120, y: 120 };
const DEFAULT_NODE_SEPARATION = 72;
const DEFAULT_RANK_SEPARATION = 120;
const CLUSTER_FALLBACK_SIZE = 1;
const EPSILON = 0.001;

const curveLine = line<{ x: number; y: number }>()
  .x((point) => point.x)
  .y((point) => point.y)
  .curve(curveBasis);

export function applyDagreAutoLayout(graph: MermaidGraph, options: AutoLayoutOptions = {}): MermaidGraph {
  return deriveDagreAutoLayoutResult(graph, options).graph;
}

export function deriveDagreAutoLayoutResult(graph: MermaidGraph, options: AutoLayoutOptions = {}): DagreAutoLayoutResult {
  if (!graph.nodes.length) return { graph, edgeRoutes: [] };

  const spec = options.spec || defaultNodeGeometrySpec();
  const nodeFrames = new Map(graph.nodes.map((node) => [node.id, buildNodeGeometry(node, spec).frame]));
  const layoutGraph = layoutWithFallback(graph, nodeFrames);
  const normalization = layoutNormalization(graph.nodes, nodeFrames, layoutGraph, options.origin || DEFAULT_LAYOUT_ORIGIN);
  const positions = positionedCanvasNodes(graph.nodes, nodeFrames, layoutGraph, normalization);

  return {
    graph: {
      ...graph,
      nodes: graph.nodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, ...position } : node;
      })
    },
    edgeRoutes: positionedEdgeRoutes(graph, layoutGraph, normalization)
  };
}

function layoutWithFallback(graph: MermaidGraph, nodeFrames: Map<string, { width: number; height: number }>) {
  try {
    return runDagre(graph, nodeFrames, true);
  } catch {
    return runDagre(graph, nodeFrames, false);
  }
}

function runDagre(graph: MermaidGraph, nodeFrames: Map<string, { width: number; height: number }>, compound: boolean): DagreGraph {
  const dagreGraph = new Graph<GraphLabel, NodeLabel, EdgeLabel>({ compound, multigraph: true })
    .setGraph({
      rankdir: dagreRankDirection(graph.direction),
      nodesep: DEFAULT_NODE_SEPARATION,
      ranksep: DEFAULT_RANK_SEPARATION,
      marginx: 8,
      marginy: 8
    })
    .setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    const frame = nodeFrames.get(node.id);
    dagreGraph.setNode(node.id, {
      width: frame?.width || 1,
      height: frame?.height || 1
    });
  }

  if (compound) addCompoundParents(dagreGraph, graph);

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const endpointRepresentatives = subgraphEndpointRepresentatives(graph);
  for (const edge of graph.edges) {
    const from = nodeIds.has(edge.from) ? edge.from : endpointRepresentatives.get(edge.from);
    const to = nodeIds.has(edge.to) ? edge.to : endpointRepresentatives.get(edge.to);
    if (!from || !to || from === to) continue;
    dagreGraph.setEdge(from, to, {}, edge.id);
  }

  dagreLayout(dagreGraph);
  return dagreGraph;
}

function addCompoundParents(dagreGraph: DagreGraph, graph: MermaidGraph) {
  for (const subgraph of graph.subgraphs || []) {
    dagreGraph.setNode(subgraph.id, {
      width: CLUSTER_FALLBACK_SIZE,
      height: CLUSTER_FALLBACK_SIZE
    });
  }

  for (const subgraph of graph.subgraphs || []) {
    if (subgraph.parentId && dagreGraph.hasNode(subgraph.parentId)) dagreGraph.setParent(subgraph.id, subgraph.parentId);
    for (const nodeId of subgraph.nodeIds) {
      if (dagreGraph.hasNode(nodeId)) dagreGraph.setParent(nodeId, subgraph.id);
    }
  }
}

function layoutNormalization(
  nodes: CanvasNode[],
  nodeFrames: Map<string, { width: number; height: number }>,
  layoutGraph: DagreGraph,
  origin: { x: number; y: number }
): LayoutNormalization {
  const rawPositions = rawNodePositions(nodes, nodeFrames, layoutGraph);
  if (!rawPositions.length) return { offsetX: 0, offsetY: 0 };

  const minX = Math.min(...rawPositions.map((position) => position.x));
  const minY = Math.min(...rawPositions.map((position) => position.y));

  return {
    offsetX: origin.x - minX,
    offsetY: origin.y - minY
  };
}

function rawNodePositions(nodes: CanvasNode[], nodeFrames: Map<string, { width: number; height: number }>, layoutGraph: DagreGraph) {
  return nodes
    .map((node) => {
      const layoutNode = layoutGraph.node(node.id);
      const frame = nodeFrames.get(node.id);
      if (!layoutNode || typeof layoutNode.x !== "number" || typeof layoutNode.y !== "number" || !frame) return null;

      return {
        id: node.id,
        x: layoutNode.x - frame.width / 2,
        y: layoutNode.y - frame.height / 2
      };
    })
    .filter(Boolean) as { id: string; x: number; y: number }[];
}

function positionedCanvasNodes(
  nodes: CanvasNode[],
  nodeFrames: Map<string, { width: number; height: number }>,
  layoutGraph: DagreGraph,
  normalization: LayoutNormalization
) {
  return new Map(
    rawNodePositions(nodes, nodeFrames, layoutGraph).map((position) => [
      position.id,
      {
        x: roundLayoutPosition(position.x + normalization.offsetX),
        y: roundLayoutPosition(position.y + normalization.offsetY)
      }
    ])
  );
}

function positionedEdgeRoutes(graph: MermaidGraph, layoutGraph: DagreGraph, normalization: LayoutNormalization): DagreEdgeRoute[] {
  const routeByEdgeId = new Map<string, DagreEdgeRoute>();

  for (const edgeRef of layoutGraph.edges()) {
    if (!edgeRef.name) continue;
    const edge = graph.edges.find((item) => item.id === edgeRef.name);
    if (!edge) continue;

    const layoutEdge = layoutGraph.edge(edgeRef);
    const points = normalizeDagrePoints(layoutEdge?.points || [], normalization);
    const route = edgeRouteFromPoints(edge.id, points);
    if (route) routeByEdgeId.set(edge.id, route);
  }

  return graph.edges.map((edge) => routeByEdgeId.get(edge.id)).filter(Boolean) as DagreEdgeRoute[];
}

function normalizeDagrePoints(points: { x: number; y: number }[], normalization: LayoutNormalization) {
  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      x: roundLayoutPosition(point.x + normalization.offsetX),
      y: roundLayoutPosition(point.y + normalization.offsetY)
    }));
}

function edgeRouteFromPoints(edgeId: string, points: { x: number; y: number }[]): DagreEdgeRoute | null {
  const safePoints = dedupePoints(points);
  if (safePoints.length < 2) return null;

  const pathData = curveLine(safePoints) || "";
  if (!pathData) return null;

  const start = safePoints[0];
  const end = safePoints[safePoints.length - 1];
  const previous = safePoints[safePoints.length - 2];
  const endTangent = normalize({ x: end.x - previous.x, y: end.y - previous.y }, { x: 1, y: 0 });

  return {
    edgeId,
    points: flattenPoints(safePoints),
    pathData,
    labelPoint: pointAtHalfLength(safePoints),
    start,
    end,
    endTangent
  };
}

function subgraphEndpointRepresentatives(graph: MermaidGraph) {
  const subgraphs = graph.subgraphs || [];
  const nodeOrder = new Map(graph.nodes.map((node, index) => [node.id, index]));
  const cache = new Map<string, string | undefined>();

  function descendants(subgraph: CanvasSubgraph, seen = new Set<string>()): string[] {
    if (seen.has(subgraph.id)) return [];
    seen.add(subgraph.id);

    const childNodeIds = subgraphs.filter((item) => item.parentId === subgraph.id).flatMap((child) => descendants(child, seen));
    return [...subgraph.nodeIds, ...childNodeIds].filter((nodeId) => nodeOrder.has(nodeId));
  }

  for (const subgraph of subgraphs) {
    const candidates = descendants(subgraph).sort((a, b) => (nodeOrder.get(a) || 0) - (nodeOrder.get(b) || 0));
    cache.set(subgraph.id, candidates[0]);
  }

  return cache;
}

function dagreRankDirection(direction: GraphDirection) {
  if (direction === "TD") return "TB";
  return direction;
}

function pointAtHalfLength(points: { x: number; y: number }[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }

  if (total < EPSILON) return points[0];

  let traveled = 0;
  const target = total / 2;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (traveled + segmentLength >= target) {
      const ratio = (target - traveled) / Math.max(segmentLength, EPSILON);
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio
      };
    }
    traveled += segmentLength;
  }

  return points[points.length - 1];
}

function normalize(point: { x: number; y: number }, fallback: { x: number; y: number }) {
  const length = Math.hypot(point.x, point.y);
  if (length < EPSILON) return fallback;

  return {
    x: point.x / length,
    y: point.y / length
  };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function flattenPoints(points: { x: number; y: number }[]) {
  return points.flatMap((point) => [point.x, point.y]);
}

function dedupePoints(points: { x: number; y: number }[]) {
  return points.filter((point, index) => index === 0 || distance(points[index - 1], point) > EPSILON);
}

function roundLayoutPosition(value: number) {
  return Math.round(value * 10) / 10;
}
