import { describe, expect, it } from "vitest";

import { applyDagreAutoLayout, deriveDagreAutoLayoutResult } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

const spec: NodeGeometrySpec = {
  minChars: 4,
  maxChars: 12,
  paddingX: 10,
  paddingY: 8,
  lineHeight: 20,
  maxLines: 3,
  measureText: (value) => value.length * 10
};

function graph(direction: MermaidGraph["direction"]): MermaidGraph {
  return {
    direction,
    nodes: [
      { id: "A", label: "Alpha", x: 400, y: 300, fill: "#fff" },
      { id: "B", label: "Beta", x: 30, y: 40, fill: "#eee" },
      { id: "C", label: "Gamma", x: 50, y: 60, fill: "#ddd" }
    ],
    edges: [
      { id: "A_B", from: "A", to: "B", label: "", style: "solid" },
      { id: "B_C", from: "B", to: "C", label: "", style: "solid" }
    ]
  };
}

describe("applyDagreAutoLayout", () => {
  it("lays out LR graphs from left to right", () => {
    const result = applyDagreAutoLayout(graph("LR"), { spec });
    const byId = new Map(result.nodes.map((node) => [node.id, node]));

    expect(byId.get("A")!.x).toBeLessThan(byId.get("B")!.x);
    expect(byId.get("B")!.x).toBeLessThan(byId.get("C")!.x);
    expect(Math.min(...result.nodes.map((node) => node.x))).toBe(120);
  });

  it("lays out TD graphs from top to bottom", () => {
    const result = applyDagreAutoLayout(graph("TD"), { spec });
    const byId = new Map(result.nodes.map((node) => [node.id, node]));

    expect(byId.get("A")!.y).toBeLessThan(byId.get("B")!.y);
    expect(byId.get("B")!.y).toBeLessThan(byId.get("C")!.y);
    expect(Math.min(...result.nodes.map((node) => node.y))).toBe(120);
  });

  it("keeps grouped nodes layoutable", () => {
    const input = {
      ...graph("LR"),
      subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A", "B"] }]
    };
    const result = applyDagreAutoLayout(input, { spec });

    expect(result.nodes).toHaveLength(3);
    expect(result.subgraphs).toEqual(input.subgraphs);
    expect(result.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });

  it("derives dagre edge routes for mermaid-style automatic curves", () => {
    const result = deriveDagreAutoLayoutResult(graph("LR"), { spec });

    expect(result.edgeRoutes).toHaveLength(2);
    for (const route of result.edgeRoutes) {
      expect(route.pathData).toMatch(/^M/);
      expect(route.points.length).toBeGreaterThanOrEqual(4);
      expect(route.points.every((point) => Number.isFinite(point))).toBe(true);
      expect(Number.isFinite(route.labelPoint.x)).toBe(true);
      expect(Number.isFinite(route.labelPoint.y)).toBe(true);
    }
  });
});
