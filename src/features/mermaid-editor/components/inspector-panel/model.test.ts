import { describe, expect, it } from "vitest";

import {
  createInspectorSelectionModel,
  normalizeEdgePatch,
  parseEdgeClasses,
  updateBatchEdgeNumber,
  updateBatchNodeAssetNumber
} from "@/features/mermaid-editor/components/inspector-panel/model";
import type { CanvasEdgeBatchPatch, CanvasNodeBatchPatch, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

const graph: MermaidGraph = {
  diagramType: "flowchart",
  editableKind: "flowchart",
  parseStatus: "parsed",
  direction: "LR",
  nodes: [
    { id: "A", label: "Alpha", x: 0, y: 0, fill: "#fff", shape: "rect" },
    { id: "B", label: "Beta", x: 100, y: 0, fill: "#000", shape: "circle" }
  ],
  edges: [
    { id: "A_B", from: "A", to: "B", label: "", style: "solid", markerStart: "none", markerEnd: "arrow" }
  ],
  subgraphs: [
    { id: "G1", title: "Group 1", nodeIds: ["A"] },
    { id: "G2", title: "Group 2", nodeIds: ["B"], parentId: "G1" },
    { id: "G3", title: "Group 3", nodeIds: [] }
  ]
};

describe("inspector model", () => {
  it("derives mixed multi-node values and endpoint options", () => {
    const model = createInspectorSelectionModel(graph, { nodeIds: ["A", "B"], edgeIds: [] });

    expect(model.multiNode).toBe(true);
    expect(model.batchNodeFill).toEqual({ value: "#fff", mixed: true });
    expect(model.batchNodeShape).toEqual({ value: "rect", mixed: true });
    expect(model.endpointOptions.map((option) => option.id)).toEqual(["A", "B", "G1", "G2", "G3"]);
  });

  it("filters invalid parent subgraphs for single and batch group edits", () => {
    const single = createInspectorSelectionModel(graph, { nodeIds: [], edgeIds: [], subgraphIds: ["G1"] });
    const batch = createInspectorSelectionModel(graph, { nodeIds: [], edgeIds: [], subgraphIds: ["G1", "G3"] });

    expect(single.selectedSubgraphParentOptions.map((option) => option.id)).toEqual(["G3"]);
    expect(batch.batchSubgraphParentOptions.map((option) => option.id)).toEqual([]);
  });

  it("normalizes edge classes and explicit patch clears", () => {
    expect(parseEdgeClasses("animate, primary  dashed")).toEqual(["animate", "primary", "dashed"]);
    expect(normalizeEdgePatch({ mermaidId: undefined, curve: undefined, label: "name" })).toEqual({
      label: "name",
      mermaidId: undefined,
      curve: undefined
    });
  });

  it("guards numeric batch updates", () => {
    const nodePatches: CanvasNodeBatchPatch[] = [];
    const edgePatches: CanvasEdgeBatchPatch[] = [];

    updateBatchNodeAssetNumber((patch) => nodePatches.push(patch), "width", "128");
    updateBatchNodeAssetNumber((patch) => nodePatches.push(patch), "height", "");
    updateBatchEdgeNumber((patch) => edgePatches.push(patch), "minLength", "2.8");
    updateBatchEdgeNumber((patch) => edgePatches.push(patch), "minLength", "nope");

    expect(nodePatches).toEqual([{ asset: { width: 128 } }]);
    expect(edgePatches).toEqual([{ minLength: 3 }]);
  });
});
