import { describe, expect, it } from "vitest";

import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";
import { applyEditorCommandTransaction } from "@/features/mermaid-editor/lib/interaction/transaction";

const graph: MermaidGraph = {
  direction: "LR",
  nodes: [
    { id: "A", label: "A", x: 100, y: 100, fill: "#fff" },
    { id: "B", label: "B", x: 300, y: 100, fill: "#fff" }
  ],
  edges: [{ id: "A_B", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" }],
  subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A"] }]
};

const state = {
  graph,
  selection: { nodeIds: ["A"], edgeIds: ["A_B"], subgraphIds: ["Group"], primaryId: "A" },
  viewport: { x: 0, y: 0, scale: 1 },
  viewFilters: DEFAULT_VIEW_FILTERS
};

describe("editor command transaction", () => {
  it("updates viewport without history or source sync", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "viewport.set",
      viewport: { x: 10, y: 20, scale: 1.2 },
      source: "wheel"
    });

    expect(result.state.viewport).toEqual({ x: 10, y: 20, scale: 1.2 });
    expect(result.effect).toMatchObject({ history: "none", sourceSync: "none", highFrequency: true });
  });

  it("treats pointer viewport updates as high-frequency visual navigation", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "viewport.set",
      viewport: { x: -20, y: 40, scale: 1 },
      source: "pointer"
    });

    expect(result.state.viewport).toEqual({ x: -20, y: 40, scale: 1 });
    expect(result.effect).toMatchObject({ history: "none", sourceSync: "none", highFrequency: true });
  });

  it("normalizes filters and removes hidden entities from selection", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "viewFilters.set",
      filters: { ...DEFAULT_VIEW_FILTERS, nodes: false },
      message: "隐藏节点。",
      source: "menu"
    });

    expect(result.state.viewFilters.nodes).toBe(false);
    expect(result.state.selection).toEqual({
      nodeIds: [],
      edgeIds: [],
      subgraphIds: ["Group"],
      primaryId: "Group"
    });
    expect(result.effect).toMatchObject({ history: "none", sourceSync: "none", status: "隐藏节点。" });
  });

  it("adds a node and assigns it to a parent subgraph", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.addNodeAt",
      point: { x: 500, y: 300, parentId: "Group" },
      source: "pointer"
    });
    const nodeId = result.state.selection.nodeIds[0];

    expect(result.state.graph.nodes).toHaveLength(3);
    expect(result.state.graph.subgraphs?.find((subgraph) => subgraph.id === "Group")?.nodeIds).toContain(nodeId);
    expect(result.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已在画布中新增节点。" });
  });

  it("adds a node at the viewport center", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.addNodeAtViewportCenter",
      source: "menu"
    });

    expect(result.state.graph.nodes).toHaveLength(3);
    expect(result.state.selection.nodeIds).toHaveLength(1);
    expect(result.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已新增节点。" });
  });

  it("creates subgraphs and deletes the current selection", () => {
    const grouped = applyEditorCommandTransaction(
      { ...state, selection: { nodeIds: ["A", "B"], edgeIds: [], subgraphIds: [] } },
      { type: "graph.createSubgraphFromSelection", source: "menu" }
    );

    expect(grouped.state.graph.subgraphs).toHaveLength(2);
    expect(grouped.state.selection.subgraphIds).toHaveLength(1);
    expect(grouped.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已将选中内容成组。" });

    const deleted = applyEditorCommandTransaction(
      { ...state, selection: { nodeIds: ["A"], edgeIds: [], subgraphIds: [] } },
      { type: "graph.deleteSelection", source: "keyboard" }
    );

    expect(deleted.state.graph.nodes.map((node) => node.id)).toEqual(["B"]);
    expect(deleted.state.graph.edges).toEqual([]);
    expect(deleted.state.selection).toEqual({ nodeIds: [], edgeIds: [], subgraphIds: [] });
  });

  it("pastes clipboard payloads and updates selection", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.pasteClipboard",
      payload: {
        nodes: [{ id: "A", label: "A", x: 100, y: 100, fill: "#fff" }],
        edges: []
      },
      source: "keyboard"
    });

    expect(result.state.graph.nodes).toHaveLength(3);
    expect(result.state.selection.nodeIds).toHaveLength(1);
    expect(result.effect.status).toBe("已粘贴节点。");
  });

  it("updates graph direction", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.setDirection",
      direction: "TD",
      source: "menu"
    });

    expect(result.state.graph.direction).toBe("TD");
    expect(result.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "方向已切换为 TD。" });
  });

  it("creates and retargets edges as graph commits", () => {
    const created = applyEditorCommandTransaction(state, {
      type: "graph.createEdge",
      fromId: "A",
      toId: "Group",
      fromAnchor: "right",
      toAnchor: "left",
      source: "pointer"
    });
    const edge = created.state.graph.edges.at(-1);

    expect(edge).toMatchObject({ from: "A", to: "Group", style: "solid", arrowType: "arrow", fromAnchor: "right", toAnchor: "left" });
    expect(created.state.selection.edgeIds).toEqual([edge?.id]);
    expect(created.effect.sourceSync).toBe("commit");

    const retargeted = applyEditorCommandTransaction(created.state, {
      type: "graph.retargetEdge",
      edgeId: edge!.id,
      side: "to",
      targetId: "B",
      anchor: "top",
      source: "pointer"
    });

    expect(retargeted.state.graph.edges.find((item) => item.id === edge!.id)?.to).toBe("B");
    expect(retargeted.state.graph.edges.find((item) => item.id === edge!.id)?.toAnchor).toBe("top");
    expect(retargeted.state.selection.edgeIds).toEqual([edge!.id]);

    const automatic = applyEditorCommandTransaction(retargeted.state, {
      type: "graph.retargetEdge",
      edgeId: edge!.id,
      side: "to",
      targetId: "B",
      anchor: null,
      source: "pointer"
    });

    expect(automatic.state.graph.edges.find((item) => item.id === edge!.id)?.toAnchor).toBeUndefined();
  });

  it("updates node and edge labels as graph commits", () => {
    const nodeResult = applyEditorCommandTransaction(state, {
      type: "graph.updateNodeLabel",
      nodeId: "A",
      label: "Alpha",
      source: "pointer"
    });
    const edgeResult = applyEditorCommandTransaction(state, {
      type: "graph.updateEdgeLabel",
      edgeId: "A_B",
      label: "go",
      source: "pointer"
    });

    expect(nodeResult.state.graph.nodes.find((node) => node.id === "A")?.label).toBe("Alpha");
    expect(nodeResult.state.selection.nodeIds).toEqual(["A"]);
    expect(edgeResult.state.graph.edges.find((edge) => edge.id === "A_B")?.label).toBe("go");
    expect(edgeResult.state.selection.edgeIds).toEqual(["A_B"]);
  });

  it("renames and updates inspector-editable entities", () => {
    const renamedNode = applyEditorCommandTransaction(state, {
      type: "graph.renameNode",
      nodeId: "A",
      value: "Alpha",
      source: "menu"
    });
    const updatedNode = applyEditorCommandTransaction(state, {
      type: "graph.updateNode",
      nodeId: "A",
      patch: { fill: "#f00", shape: "circle" },
      source: "menu"
    });
    const filledNodes = applyEditorCommandTransaction(state, {
      type: "graph.updateNodeFill",
      nodeIds: ["A", "B"],
      fill: "#0f0",
      source: "menu"
    });
    const updatedEdge = applyEditorCommandTransaction(state, {
      type: "graph.updateEdge",
      edgeId: "A_B",
      patch: { style: "dotted", arrowType: "circle", label: "go" },
      source: "menu"
    });
    const renamedSubgraph = applyEditorCommandTransaction(state, {
      type: "graph.renameSubgraph",
      subgraphId: "Group",
      value: "Renamed",
      source: "menu"
    });
    const updatedSubgraph = applyEditorCommandTransaction(state, {
      type: "graph.updateSubgraph",
      subgraphId: "Group",
      patch: { title: "Title", direction: "BT" },
      source: "menu"
    });

    expect(renamedNode.state.graph.nodes.find((node) => node.id === "Alpha")).toBeTruthy();
    expect(updatedNode.state.graph.nodes.find((node) => node.id === "A")).toMatchObject({ fill: "#f00", shape: "circle" });
    expect(filledNodes.state.graph.nodes.every((node) => node.fill === "#0f0")).toBe(true);
    expect(updatedEdge.state.graph.edges[0]).toMatchObject({ style: "dotted", arrowType: "circle", label: "go" });
    expect(renamedSubgraph.state.graph.subgraphs?.[0].id).toBe("Renamed");
    expect(updatedSubgraph.state.graph.subgraphs?.[0]).toMatchObject({ title: "Title", direction: "BT" });
  });

  it("drafts node positions without history or source sync", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.draftNodePositions",
      positions: { A: { x: 160, y: 180 } },
      source: "pointer"
    });

    expect(result.state.graph.nodes.find((node) => node.id === "A")).toMatchObject({ x: 160, y: 180 });
    expect(result.effect).toMatchObject({ history: "none", sourceSync: "draft", syncSource: false, highFrequency: true });
  });

  it("commits drag membership as a source-syncing draft without pushing another history entry", () => {
    const nextGraph: MermaidGraph = {
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === "A" ? { ...node, x: 500, y: 500 } : node))
    };
    const result = applyEditorCommandTransaction(state, {
      type: "graph.commitDragMembership",
      graph: nextGraph,
      source: "pointer"
    });

    expect(result.state.graph.nodes.find((node) => node.id === "A")).toMatchObject({ x: 500, y: 500 });
    expect(result.effect).toMatchObject({ history: "none", sourceSync: "draft", syncSource: true, status: "已移动并更新组成员。" });
  });
});
