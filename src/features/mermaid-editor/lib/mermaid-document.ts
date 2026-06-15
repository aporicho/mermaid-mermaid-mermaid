import { applyLayout, CANVAS_LAYOUT_PREFIX, edgeRoutingFromLayout, layoutFromGraph, parseCanvasLayout, stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { EdgeRouting, MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { parseMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

export type MermaidDocument = {
  source: string;
  graph: MermaidGraph;
  edgeRouting: EdgeRouting;
  viewport?: ViewportState;
};

export function buildMermaidDocument(source: string, graph: MermaidGraph, viewport: ViewportState, edgeRouting: EdgeRouting) {
  const layout = layoutFromGraph(graph, viewport, edgeRouting);
  const pureSource = stripCanvasLayout(source).trim();
  return `${CANVAS_LAYOUT_PREFIX} ${JSON.stringify(layout)}\n${pureSource}\n`;
}

export function loadMermaidDocument(text: string, previous?: MermaidGraph): MermaidDocument {
  const layout = parseCanvasLayout(text);
  const source = stripCanvasLayout(text).trim();
  const graph = applyLayout(parseMermaid(source, previous), layout);

  return {
    source,
    graph,
    edgeRouting: edgeRoutingFromLayout(layout),
    viewport: layout?.viewport
  };
}
