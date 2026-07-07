import { applyLayout, CANVAS_LAYOUT_PREFIX, edgeRoutingFromLayout, layoutFromGraph, layoutModeFromLayout, parseCanvasLayout, stripCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { DiagramType, EditableKind, EdgeRouting, LayoutMode, MermaidGraph, ParseStatus, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { inspectMermaidSource, parseMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

export type MermaidDocument = {
  source: string;
  graph: MermaidGraph;
  diagramType: DiagramType;
  editableKind: EditableKind;
  parseStatus: ParseStatus;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  viewport?: ViewportState;
};

export function buildMermaidDocument(
  source: string,
  graph: MermaidGraph,
  viewport: ViewportState,
  edgeRouting: EdgeRouting,
  layoutMode: LayoutMode
) {
  const layout = layoutFromGraph(graph, viewport, edgeRouting, layoutMode);
  const pureSource = stripCanvasLayout(source).trim();
  return `${CANVAS_LAYOUT_PREFIX} ${JSON.stringify(layout)}\n${pureSource}\n`;
}

export function loadMermaidDocument(text: string, previous?: MermaidGraph): MermaidDocument {
  const layout = parseCanvasLayout(text);
  const source = stripCanvasLayout(text).trim();
  const meta = inspectMermaidSource(source);
  const graph = meta.editableKind === "flowchart" ? applyLayout(parseMermaid(source, previous), layout) : parseMermaid(source, previous);

  return {
    source,
    graph,
    diagramType: meta.diagramType,
    editableKind: meta.editableKind,
    parseStatus: meta.editableKind === "flowchart" ? "parsed" : "render-only",
    edgeRouting: edgeRoutingFromLayout(layout),
    layoutMode: layoutModeFromLayout(layout),
    viewport: layout?.viewport
  };
}
