import { applyLayout, CANVAS_LAYOUT_PREFIX, layoutFromGraph, parseCanvasLayout, stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { parseMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

export type MermaidDocument = {
  source: string;
  graph: MermaidGraph;
  viewport?: ViewportState;
};

export function buildMermaidDocument(source: string, graph: MermaidGraph, viewport: ViewportState) {
  const layout = layoutFromGraph(graph, viewport);
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
    viewport: layout?.viewport
  };
}
