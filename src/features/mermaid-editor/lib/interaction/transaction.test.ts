import { describe, expect, it } from "vitest";

import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";
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

  it("adds multiple link nodes as a single graph commit", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.addNodesAt",
      nodes: [
        {
          point: { x: 500, y: 300 },
          label: "example.com",
          action: { kind: "url", url: "https://example.com", openMode: "app-browser" }
        },
        {
          point: { x: 500, y: 404 },
          label: "spec.md",
          action: { kind: "file", path: "./docs/spec.md", openMode: "app-window" }
        }
      ],
      source: "keyboard"
    });

    expect(result.state.graph.nodes).toHaveLength(4);
    expect(result.state.selection.nodeIds).toEqual(["N1", "N2"]);
    expect(result.state.graph.nodes.at(-1)).toMatchObject({ label: "spec.md", action: { kind: "file", path: "./docs/spec.md" } });
    expect(result.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已添加链接节点。" });
  });

  it("adds and selects multiple image nodes as a single graph commit", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.addNodesAt",
      nodes: [
        { point: { x: 420, y: 260 }, label: "first", asset: { kind: "image", src: "./assets/first.png", width: 160, height: 120, preserveAspectRatio: true, labelPosition: "bottom" } },
        { point: { x: 620, y: 260 }, label: "second", asset: { kind: "image", src: "./assets/second.png", width: 180, height: 100, preserveAspectRatio: true, labelPosition: "bottom" } }
      ],
      message: "已添加 2 张图片节点。",
      source: "api"
    });

    expect(result.state.graph.nodes).toHaveLength(4);
    expect(result.state.selection).toMatchObject({ nodeIds: ["N1", "N2"], primaryId: "N1" });
    expect(result.state.graph.nodes.slice(-2).map((node) => node.asset?.src)).toEqual(["./assets/first.png", "./assets/second.png"]);
    expect(result.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已添加 2 张图片节点。" });
  });

  it("infers node actions from committed node text without replacing existing actions", () => {
    const linked = applyEditorCommandTransaction(state, {
      type: "graph.updateNodeLabel",
      nodeId: "A",
      label: "https://example.com/docs",
      source: "pointer"
    });
    const existingAction = {
      ...state,
      graph: {
        ...state.graph,
        nodes: [
          { ...state.graph.nodes[0], action: { kind: "url" as const, url: "https://old.example.com", openMode: "app-browser" as const } },
          state.graph.nodes[1]
        ]
      }
    };
    const preserved = applyEditorCommandTransaction(existingAction, {
      type: "graph.updateNode",
      nodeId: "A",
      patch: { label: "https://new.example.com" },
      source: "menu"
    });

    expect(linked.state.graph.nodes.find((node) => node.id === "A")?.action).toMatchObject({ kind: "url", url: "https://example.com/docs" });
    expect(preserved.state.graph.nodes.find((node) => node.id === "A")?.action).toMatchObject({ kind: "url", url: "https://old.example.com" });
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

  it("arranges nodes as one graph commit while preserving selection", () => {
    const result = applyEditorCommandTransaction(
      { ...state, selection: { nodeIds: ["A", "B"], edgeIds: [], subgraphIds: [] } },
      {
        type: "graph.arrangeNodes",
        operation: "align-left",
        positions: { A: { x: 100, y: 100 }, B: { x: 100, y: 100 } },
        source: "menu"
      }
    );

    expect(result.state.graph.nodes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: "A", x: 100, y: 100 },
      { id: "B", x: 100, y: 100 }
    ]);
    expect(result.state.selection).toEqual({ nodeIds: ["A", "B"], edgeIds: [], subgraphIds: [] });
    expect(result.effect).toMatchObject({
      history: "push",
      sourceSync: "commit",
      status: "已将所选节点左对齐。"
    });
  });

  it("does not create a graph commit when arrangement positions are unchanged", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.arrangeNodes",
      operation: "align-left",
      positions: { A: { x: 100, y: 100 } },
      source: "menu"
    });

    expect(result.state).toBe(state);
    expect(result.effect).toEqual({
      history: "none",
      sourceSync: "none",
      status: "所选节点已经左对齐。"
    });
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
    const batchUpdatedNodes = applyEditorCommandTransaction(state, {
      type: "graph.updateNodes",
      nodeIds: ["A", "B"],
      patch: { fill: "#00f", shape: "circle" },
      source: "menu"
    });
    const updatedEdge = applyEditorCommandTransaction(state, {
      type: "graph.updateEdge",
      edgeId: "A_B",
      patch: { style: "dotted", arrowType: "circle", label: "go" },
      source: "menu"
    });
    const batchUpdatedEdges = applyEditorCommandTransaction(state, {
      type: "graph.updateEdges",
      edgeIds: ["A_B"],
      patch: { style: "thick", arrowType: "none" },
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
    const batchUpdatedSubgraphs = applyEditorCommandTransaction(state, {
      type: "graph.updateSubgraphs",
      subgraphIds: ["Group"],
      patch: { direction: "RL", parentId: undefined },
      source: "menu"
    });

    expect(renamedNode.state.graph.nodes.find((node) => node.id === "Alpha")).toBeTruthy();
    expect(updatedNode.state.graph.nodes.find((node) => node.id === "A")).toMatchObject({ fill: "#f00", shape: "circle" });
    expect(filledNodes.state.graph.nodes.every((node) => node.fill === "#0f0")).toBe(true);
    expect(batchUpdatedNodes.state.graph.nodes.every((node) => node.fill === "#00f" && node.shape === "circle")).toBe(true);
    expect(batchUpdatedNodes.effect).toMatchObject({ history: "push", sourceSync: "commit", status: "已批量更新节点。" });
    expect(updatedEdge.state.graph.edges[0]).toMatchObject({ style: "dotted", arrowType: "circle", label: "go" });
    expect(batchUpdatedEdges.state.graph.edges[0]).toMatchObject({ style: "thick", arrowType: "none" });
    expect(renamedSubgraph.state.graph.subgraphs?.[0].id).toBe("Renamed");
    expect(updatedSubgraph.state.graph.subgraphs?.[0]).toMatchObject({ title: "Title", direction: "BT" });
    expect(batchUpdatedSubgraphs.state.graph.subgraphs?.[0]).toMatchObject({ direction: "RL", parentId: undefined });
  });

  it("does not commit a graph command whose normalized content is semantically unchanged", () => {
    const table = createDefaultCanvasTableContent(1, 1);
    const tableState = {
      ...state,
      graph: {
        ...state.graph,
        nodes: state.graph.nodes.map((node) => node.id === "A" ? { ...node, content: table } : node)
      }
    };
    const result = applyEditorCommandTransaction(tableState, {
      type: "graph.updateNode",
      nodeId: "A",
      patch: { content: structuredClone(table) },
      source: "api"
    });

    expect(result.effect).toEqual({ history: "none", sourceSync: "none" });
    expect(result.state.graph).toEqual(tableState.graph);
  });

  it("updates several file actions in one committed source sync", () => {
    const result = applyEditorCommandTransaction(state, {
      type: "graph.updateNodeActions",
      updates: [
        { nodeId: "A", action: { kind: "file", path: "archive/spec.md", openMode: "app-window" } },
        { nodeId: "B", action: { kind: "file", path: "archive/spec.md", openMode: "app-window" } }
      ],
      message: "已更新移动文件的节点链接。",
      source: "api"
    });

    expect(result.state.graph.nodes.map((node) => node.action?.kind === "file" ? node.action.path : null)).toEqual([
      "archive/spec.md",
      "archive/spec.md"
    ]);
    expect(result.effect).toMatchObject({
      history: "push",
      sourceSync: "commit",
      status: "已更新移动文件的节点链接。"
    });
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
