import { describe, expect, it } from "vitest";

import { buildNodeGeometry, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { buildSubgraphGeometries, subgraphAtPoint } from "@/features/mermaid-editor/lib/subgraph-geometry";
import type { CanvasNode, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

const spec: NodeGeometrySpec = {
  minChars: 4,
  maxChars: 12,
  paddingX: 10,
  paddingY: 8,
  lineHeight: 20,
  maxLines: 3,
  measureText: (value) => value.length * 10
};

function node(id: string, x: number, y: number): CanvasNode {
  return { id, label: id, x, y, fill: "#fff", shape: "rect" };
}

describe("subgraph geometry", () => {
  it("wraps direct nodes and nested subgraphs", () => {
    const graph: MermaidGraph = {
      direction: "LR",
      nodes: [node("A", 100, 100), node("B", 320, 180)],
      edges: [],
      subgraphs: [
        { id: "Outer", title: "Outer", nodeIds: ["B"] },
        { id: "Inner", title: "Inner", nodeIds: ["A"], parentId: "Outer" }
      ]
    };
    const nodeGeometries = graph.nodes.map((item) => buildNodeGeometry(item, spec));
    const geometries = buildSubgraphGeometries(graph, nodeGeometries);
    const outer = geometries.find((item) => item.id === "Outer")!;
    const inner = geometries.find((item) => item.id === "Inner")!;

    expect(outer.frame.x).toBeLessThan(inner.frame.x);
    expect(outer.frame.y).toBeLessThan(inner.frame.y);
    expect(outer.frame.x + outer.frame.width).toBeGreaterThan(360);
    expect(outer.depth).toBe(0);
    expect(inner.depth).toBe(1);
  });

  it("picks the deepest subgraph at a point", () => {
    const graph: MermaidGraph = {
      direction: "LR",
      nodes: [node("A", 100, 100)],
      edges: [],
      subgraphs: [
        { id: "Outer", title: "Outer", nodeIds: [] },
        { id: "Inner", title: "Inner", nodeIds: ["A"], parentId: "Outer" }
      ]
    };
    const nodeGeometries = graph.nodes.map((item) => buildNodeGeometry(item, spec));
    const geometries = buildSubgraphGeometries(graph, nodeGeometries);
    const picked = subgraphAtPoint(geometries, { x: 120, y: 120 });

    expect(picked?.id).toBe("Inner");
  });
});
