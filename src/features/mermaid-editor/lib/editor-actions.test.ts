import { describe, expect, it } from "vitest";

import type { CanvasEdge, CanvasNode, CanvasSubgraph, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import {
  addNodeAt,
  createSubgraphFromSelection,
  deleteSelection,
  pasteClipboard,
  setNodeParent,
  updateEdges,
  updateNodes,
  updateSubgraphs
} from "@/features/mermaid-editor/lib/editor-actions";

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

  it("updates selected nodes in batches without overwriting unrelated nodes", () => {
    const source = graph([
      { ...node("A"), asset: { kind: "image", src: "a.png", width: 80, height: 60, preserveAspectRatio: true, labelPosition: "bottom" } },
      { ...node("B"), asset: { kind: "image", src: "b.png", width: 90, height: 70, preserveAspectRatio: true, labelPosition: "top" } },
      node("C")
    ]);
    const next = updateNodes(source, ["A", "B"], {
      fill: "#ff0000",
      shape: "circle",
      asset: { width: 160, preserveAspectRatio: false }
    });

    expect(next.nodes.find((item) => item.id === "A")).toMatchObject({ fill: "#ff0000", shape: "circle", asset: { src: "a.png", width: 160, preserveAspectRatio: false } });
    expect(next.nodes.find((item) => item.id === "B")).toMatchObject({ fill: "#ff0000", shape: "circle", asset: { src: "b.png", width: 160, preserveAspectRatio: false } });
    expect(next.nodes.find((item) => item.id === "C")).toMatchObject({ fill: "#ffffff", shape: "rect" });
    expect(next.nodes.find((item) => item.id === "C")?.asset).toBeUndefined();
  });

  it("updates selected edges in batches", () => {
    const edges: CanvasEdge[] = [
      { id: "A_B", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" },
      { id: "B_C", from: "B", to: "C", label: "", style: "thick", arrowType: "none" }
    ];
    const source = { ...graph([node("A"), node("B"), node("C")]), edges };
    const next = updateEdges(source, ["A_B"], { style: "dotted", arrowType: "circle" });

    expect(next.edges.find((item) => item.id === "A_B")).toMatchObject({ style: "dotted", arrowType: "circle" });
    expect(next.edges.find((item) => item.id === "B_C")).toMatchObject({ style: "thick", arrowType: "none" });
  });

  it("updates selected subgraphs in batches while preventing parent cycles", () => {
    const subgraphs: CanvasSubgraph[] = [
      { id: "G1", title: "G1", nodeIds: ["A"] },
      { id: "G2", title: "G2", nodeIds: ["B"], parentId: "G1" },
      { id: "G3", title: "G3", nodeIds: ["C"] }
    ];
    const source = { ...graph([node("A"), node("B"), node("C")]), subgraphs };
    const updated = updateSubgraphs(source, ["G2", "G3"], { direction: "BT", parentId: "G1" });
    const blocked = updateSubgraphs(source, ["G1"], { direction: "RL", parentId: "G2" });

    expect(updated.subgraphs?.find((item) => item.id === "G2")).toMatchObject({ direction: "BT", parentId: "G1" });
    expect(updated.subgraphs?.find((item) => item.id === "G3")).toMatchObject({ direction: "BT", parentId: "G1" });
    expect(blocked.subgraphs?.find((item) => item.id === "G1")).toMatchObject({ direction: "RL" });
    expect(blocked.subgraphs?.find((item) => item.id === "G1")?.parentId).toBeUndefined();
  });
});
