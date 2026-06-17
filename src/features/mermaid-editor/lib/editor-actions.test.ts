import { describe, expect, it } from "vitest";

import type { CanvasNode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { addNodeAt, createSubgraphFromSelection, deleteSelection, pasteClipboard, setNodeParent } from "@/features/mermaid-editor/lib/editor-actions";

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
    expect(result.selection).toEqual({ nodeIds: ["N4"], edgeIds: [], subgraphIds: [], primaryId: "N4" });
  });

  it("keeps paste IDs based on the original node instead of generated N IDs", () => {
    const source = node("WebUI");
    const result = pasteClipboard(graph([source]), { nodes: [source], edges: [] });

    expect(result.graph.nodes.at(-1)).toMatchObject({ id: "WebUI_copy", x: 32, y: 32 });
    expect(result.selection).toEqual({ nodeIds: ["WebUI_copy"], edgeIds: [], primaryId: "WebUI_copy" });
  });

  it("creates a subgraph from selected nodes", () => {
    const result = createSubgraphFromSelection(graph([node("A"), node("B")]), { nodeIds: ["A", "B"], edgeIds: [], subgraphIds: [] });

    expect(result.graph.subgraphs?.[0]).toMatchObject({ id: "Group", title: "新分组", nodeIds: ["A", "B"] });
    expect(result.selection).toEqual({ nodeIds: [], edgeIds: [], subgraphIds: ["Group"], primaryId: "Group" });
  });

  it("dissolves selected subgraphs without deleting their nodes", () => {
    const source = {
      ...graph([node("A"), node("B")]),
      subgraphs: [{ id: "Group", title: "新分组", nodeIds: ["A", "B"] }],
      edges: [{ id: "edge", from: "A", to: "B", label: "", style: "solid" as const }]
    };
    const next = deleteSelection(source, { nodeIds: [], edgeIds: [], subgraphIds: ["Group"] });

    expect(next.nodes.map((item) => item.id)).toEqual(["A", "B"]);
    expect(next.edges).toHaveLength(1);
    expect(next.subgraphs).toEqual([]);
  });

  it("moves node membership between subgraphs", () => {
    const source = {
      ...graph([node("A")]),
      subgraphs: [
        { id: "G1", title: "G1", nodeIds: ["A"] },
        { id: "G2", title: "G2", nodeIds: [] }
      ]
    };
    const next = setNodeParent(source, "A", "G2");

    expect(next.subgraphs?.find((item) => item.id === "G1")?.nodeIds).toEqual([]);
    expect(next.subgraphs?.find((item) => item.id === "G2")?.nodeIds).toEqual(["A"]);
  });
});
