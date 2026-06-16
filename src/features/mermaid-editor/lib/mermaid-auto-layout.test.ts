import { describe, expect, it } from "vitest";

import { canvasLayoutFromRenderedNodeCenters } from "@/features/mermaid-editor/lib/mermaid-auto-layout";
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

const graph: MermaidGraph = {
  direction: "LR",
  nodes: [
    { id: "A", label: "Alpha", x: 10, y: 20, fill: "#fff" },
    { id: "B", label: "Beta", x: 30, y: 40, fill: "#eee" },
    { id: "C", label: "Gamma", x: 50, y: 60, fill: "#ddd" }
  ],
  edges: []
};

describe("mermaid auto layout", () => {
  it("normalizes rendered centers into canvas node top-left positions", () => {
    const layout = canvasLayoutFromRenderedNodeCenters(
      graph,
      [
        { id: "A", x: 200, y: 100 },
        { id: "B", x: 420, y: 260 }
      ],
      {
        edgeRouting: "bezier",
        spec
      }
    );

    expect(layout.viewport).toEqual({ x: 160, y: 90, scale: 1 });
    expect(layout.edgeRouting).toBe("bezier");
    expect(layout.nodes.A).toEqual({ x: 120, y: 120, fill: "#fff" });
    expect(layout.nodes.B).toEqual({ x: 345, y: 280, fill: "#eee" });
    expect(layout.nodes.C).toEqual({ x: 50, y: 60, fill: "#ddd" });
  });

  it("requires at least one rendered node center", () => {
    expect(() => canvasLayoutFromRenderedNodeCenters(graph, [], { edgeRouting: "straight", spec })).toThrow(
      "无法从 Mermaid 渲染结果中提取节点布局。"
    );
  });
});
