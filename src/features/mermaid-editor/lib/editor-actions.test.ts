import { describe, expect, it } from "vitest";

import type { CanvasNode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { addNodeAt, pasteClipboard } from "@/features/mermaid-editor/lib/editor-actions";

function node(id: string): CanvasNode {
  return { id, label: id, x: 0, y: 0, fill: "#ffffff", shape: "rect" };
}

function graph(nodes: CanvasNode[]): MermaidGraph {
  return {
    diagramType: "flowchart",
    editableKind: "flowchart",
    parseStatus: "parsed",
    direction: "LR",
    nodes,
    edges: []
  };
}

describe("editor actions", () => {
  it("adds new nodes with compact generated Mermaid IDs", () => {
    const result = addNodeAt(graph([node("A"), node("N1"), node("N3")]), 40, 80);

    expect(result.graph.nodes.at(-1)).toMatchObject({ id: "N4", label: "新节点", x: 40, y: 80 });
    expect(result.selection).toEqual({ nodeIds: ["N4"], edgeIds: [], primaryId: "N4" });
  });

  it("keeps paste IDs based on the original node instead of generated N IDs", () => {
    const source = node("WebUI");
    const result = pasteClipboard(graph([source]), { nodes: [source], edges: [] });

    expect(result.graph.nodes.at(-1)).toMatchObject({ id: "WebUI_copy", x: 32, y: 32 });
    expect(result.selection).toEqual({ nodeIds: ["WebUI_copy"], edgeIds: [], primaryId: "WebUI_copy" });
  });
});
