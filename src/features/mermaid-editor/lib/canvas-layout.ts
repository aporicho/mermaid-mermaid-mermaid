import {
  DEFAULT_EDGE_ROUTING,
  DEFAULT_LAYOUT_MODE,
  type CanvasLayout,
  type CanvasLayoutEdge,
  type CanvasEdge,
  type EdgeRouting,
  type LayoutMode,
  type LegacyEdgePath,
  type MermaidGraph,
  type ViewportState
} from "@/features/mermaid-editor/lib/editor-types";

export const CANVAS_LAYOUT_PREFIX = "%% canvas-layout:";

const defaultViewport: ViewportState = { x: 160, y: 90, scale: 1 };

function normalizeEdgeRouting(value: unknown): EdgeRouting | undefined {
  if (value === "straight") return "straight";
  if (value === "orthogonal") return "orthogonal";
  if (value === "mermaid") return "mermaid";
  if (value === "bezier" || value === "curved" || value === "smooth-step") return "bezier";
  return undefined;
}

function normalizeLayoutMode(value: unknown): LayoutMode | undefined {
  return value === "manual" || value === "auto" ? value : undefined;
}

function normalizeLegacyEdgePath(value: unknown): LegacyEdgePath | undefined {
  return value === "straight" || value === "curved" || value === "orthogonal" ? value : undefined;
}

function normalizeEdgeAnchor(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function layoutEdgesFromGraph(graph: MermaidGraph) {
  const entries = graph.edges.flatMap((edge, index) => {
    const fromAnchor = normalizeEdgeAnchor(edge.fromAnchor);
    const toAnchor = normalizeEdgeAnchor(edge.toAnchor);
    if (!fromAnchor && !toAnchor) return [];
    return [
      [
        edge.id,
        {
          from: edge.from,
          to: edge.to,
          label: edge.label,
          style: edge.style,
          arrowType: edge.arrowType || "arrow",
          markerStart: edge.markerStart || "none",
          markerEnd: edge.markerEnd || edge.arrowType || "arrow",
          minLength: edge.minLength || 1,
          ...(edge.mermaidId ? { mermaidId: edge.mermaidId } : {}),
          index,
          ...(fromAnchor ? { fromAnchor } : {}),
          ...(toAnchor ? { toAnchor } : {})
        }
      ] as const
    ];
  });

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function routingFromLegacyPath(value: LegacyEdgePath): EdgeRouting {
  if (value === "straight") return "straight";
  if (value === "orthogonal") return "orthogonal";
  return "bezier";
}

function layoutEdgeFor(edge: CanvasEdge, index: number, layoutEdges: Record<string, CanvasLayoutEdge> | undefined) {
  if (!layoutEdges) return undefined;
  const byId = layoutEdges[edge.id];
  if (byId) return byId;

  return Object.values(layoutEdges).find((saved) => layoutEdgeMatches(edge, index, saved));
}

function layoutEdgeMatches(edge: CanvasEdge, index: number, saved: CanvasLayoutEdge) {
  if (typeof saved.from !== "string" || typeof saved.to !== "string") return false;
  if (saved.from !== edge.from || saved.to !== edge.to) return false;
  if (typeof saved.index === "number" && saved.index !== index) return false;
  if (typeof saved.label === "string" && saved.label !== edge.label) return false;
  if (typeof saved.style === "string" && saved.style !== edge.style) return false;
  if (typeof saved.markerStart === "string" && saved.markerStart !== (edge.markerStart || "none")) return false;
  if (typeof saved.markerEnd === "string" && saved.markerEnd !== (edge.markerEnd || edge.arrowType || "arrow")) return false;
  if (typeof saved.arrowType === "string" && saved.arrowType !== (edge.markerEnd || edge.arrowType || "arrow")) return false;
  if (typeof saved.minLength === "number" && saved.minLength !== (edge.minLength || 1)) return false;
  if (typeof saved.mermaidId === "string" && saved.mermaidId !== edge.mermaidId) return false;
  return true;
}

export function edgeRoutingFromLayout(layout: CanvasLayout | null | undefined): EdgeRouting {
  const normalized = normalizeEdgeRouting(layout?.edgeRouting);
  if (normalized) return normalized;

  const counts = new Map<EdgeRouting, number>();
  for (const edge of Object.values(layout?.edges || {})) {
    const legacyPath = normalizeLegacyEdgePath(edge?.path);
    if (!legacyPath) continue;
    const routing = routingFromLegacyPath(legacyPath);
    counts.set(routing, (counts.get(routing) || 0) + 1);
  }

  let bestRouting: EdgeRouting | undefined;
  let bestCount = 0;
  for (const [routing, count] of counts) {
    if (count <= bestCount) continue;
    bestRouting = routing;
    bestCount = count;
  }

  return bestRouting || DEFAULT_EDGE_ROUTING;
}

export function layoutModeFromLayout(layout: CanvasLayout | null | undefined): LayoutMode {
  return normalizeLayoutMode(layout?.layoutMode) || DEFAULT_LAYOUT_MODE;
}

export function stripCanvasLayout(source: string) {
  return source
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith(CANVAS_LAYOUT_PREFIX))
    .join("\n")
    .trimStart();
}

export function parseCanvasLayout(source: string): CanvasLayout | null {
  const line = source.split(/\r?\n/).find((item) => item.trimStart().startsWith(CANVAS_LAYOUT_PREFIX));
  if (!line) return null;

  try {
    const parsed = JSON.parse(line.trimStart().slice(CANVAS_LAYOUT_PREFIX.length).trim()) as CanvasLayout;
    if (parsed.version !== 1 || !parsed.nodes || !parsed.viewport) return null;
    return {
      version: 1,
      edgeRouting: edgeRoutingFromLayout(parsed),
      layoutMode: layoutModeFromLayout(parsed),
      ...(parsed.edges ? { edges: parsed.edges } : {}),
      viewport: parsed.viewport,
      nodes: parsed.nodes
    };
  } catch {
    return null;
  }
}

export function layoutFromGraph(
  graph: MermaidGraph,
  viewport: ViewportState = defaultViewport,
  edgeRouting: EdgeRouting = DEFAULT_EDGE_ROUTING,
  layoutMode: LayoutMode = DEFAULT_LAYOUT_MODE
): CanvasLayout {
  const edges = layoutEdgesFromGraph(graph);
  return {
    version: 1,
    edgeRouting,
    layoutMode,
    ...(edges ? { edges } : {}),
    viewport,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => [
        node.id,
        {
          x: node.x,
          y: node.y,
          fill: node.fill,
          ...(node.tablePresentation ? { table: node.tablePresentation } : {})
        }
      ])
    )
  };
}

export function applyLayout(graph: MermaidGraph, layout: CanvasLayout | null): MermaidGraph {
  if (!layout) return graph;

  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const saved = layout.nodes[node.id];
      return saved ? { ...node, x: saved.x, y: saved.y, fill: saved.fill || node.fill, ...(saved.table ? { tablePresentation: saved.table } : {}) } : node;
    }),
    edges: graph.edges.map((edge, index) => {
      const saved = layoutEdgeFor(edge, index, layout.edges);
      if (!saved) return edge;
      return {
        ...edge,
        ...("fromAnchor" in saved ? { fromAnchor: normalizeEdgeAnchor(saved.fromAnchor) } : {}),
        ...("toAnchor" in saved ? { toAnchor: normalizeEdgeAnchor(saved.toAnchor) } : {})
      };
    })
  };
}

export function syncLayout(
  graph: MermaidGraph,
  previous: CanvasLayout | null,
  viewport: ViewportState,
  edgeRouting: EdgeRouting = edgeRoutingFromLayout(previous),
  layoutMode: LayoutMode = layoutModeFromLayout(previous)
): CanvasLayout {
  const previousNodes = previous?.nodes || {};
  const edges = layoutEdgesFromGraph(graph);

  return {
    version: 1,
    edgeRouting,
    layoutMode,
    ...(edges ? { edges } : {}),
    viewport,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => {
        const saved = previousNodes[node.id];
        return [
          node.id,
          {
            x: node.x ?? saved?.x ?? 120,
            y: node.y ?? saved?.y ?? 120,
            fill: node.fill || saved?.fill || "#fbf6ef",
            ...(node.tablePresentation || saved?.table ? { table: node.tablePresentation || saved?.table } : {})
          }
        ];
      })
    )
  };
}
