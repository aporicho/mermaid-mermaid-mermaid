import type { CanvasLayout, MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export const CANVAS_LAYOUT_PREFIX = "%% canvas-layout:";

const defaultViewport: ViewportState = { x: 160, y: 90, scale: 1 };

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
    return parsed;
  } catch {
    return null;
  }
}

export function layoutFromGraph(graph: MermaidGraph, viewport: ViewportState = defaultViewport): CanvasLayout {
  return {
    version: 1,
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

export function syncLayout(graph: MermaidGraph, previous: CanvasLayout | null, viewport: ViewportState): CanvasLayout {
  const previousNodes = previous?.nodes || {};

  return {
    version: 1,
    viewport,
    nodes: Object.fromEntries(
      graph.nodes.map((node) => {
        const saved = previousNodes[node.id];
        return [
          node.id,
          {
            x: node.x ?? saved?.x ?? 120,
            y: node.y ?? saved?.y ?? 120,
            fill: node.fill || saved?.fill || "#ffffff"
          }
        ];
      })
    )
  };
}
