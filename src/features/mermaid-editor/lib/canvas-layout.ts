import {
  DEFAULT_EDGE_ROUTING,
  DEFAULT_LAYOUT_MODE,
  type CanvasLayout,
  type CanvasLayoutTheme,
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

function normalizeLayoutTheme(value: unknown): CanvasLayoutTheme | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const theme: CanvasLayoutTheme = {};

  if (typeof raw.themeId === "string" && raw.themeId.trim()) theme.themeId = raw.themeId;
  if ("customTheme" in raw) theme.customTheme = raw.customTheme ?? null;

  return theme.themeId || "customTheme" in theme ? theme : undefined;
}

function routingFromLegacyPath(value: LegacyEdgePath): EdgeRouting {
  if (value === "straight") return "straight";
  if (value === "orthogonal") return "orthogonal";
  return "bezier";
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
    return { ...parsed, edgeRouting: edgeRoutingFromLayout(parsed), layoutMode: layoutModeFromLayout(parsed), theme: normalizeLayoutTheme(parsed.theme) };
  } catch {
    return null;
  }
}

export function layoutFromGraph(
  graph: MermaidGraph,
  viewport: ViewportState = defaultViewport,
  edgeRouting: EdgeRouting = DEFAULT_EDGE_ROUTING,
  layoutMode: LayoutMode = DEFAULT_LAYOUT_MODE,
  theme?: CanvasLayoutTheme | null
): CanvasLayout {
  const normalizedTheme = normalizeLayoutTheme(theme);
  return {
    version: 1,
    edgeRouting,
    layoutMode,
    ...(normalizedTheme ? { theme: normalizedTheme } : {}),
    viewport,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => [
        node.id,
        {
          x: node.x,
          y: node.y,
          fill: node.fill
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
      return saved ? { ...node, x: saved.x, y: saved.y, fill: saved.fill || node.fill } : node;
    })
  };
}

export function syncLayout(
  graph: MermaidGraph,
  previous: CanvasLayout | null,
  viewport: ViewportState,
  edgeRouting: EdgeRouting = edgeRoutingFromLayout(previous),
  layoutMode: LayoutMode = layoutModeFromLayout(previous),
  theme: CanvasLayoutTheme | null | undefined = previous?.theme
): CanvasLayout {
  const previousNodes = previous?.nodes || {};
  const normalizedTheme = normalizeLayoutTheme(theme);

  return {
    version: 1,
    edgeRouting,
    layoutMode,
    ...(normalizedTheme ? { theme: normalizedTheme } : {}),
    viewport,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => {
        const saved = previousNodes[node.id];
        return [
          node.id,
          {
            x: node.x ?? saved?.x ?? 120,
            y: node.y ?? saved?.y ?? 120,
            fill: node.fill || saved?.fill || "#fbf6ef"
          }
        ];
      })
    )
  };
}
