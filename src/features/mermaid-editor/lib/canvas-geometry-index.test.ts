import { describe, expect, it } from "vitest";

import { createCanvasGeometryIndex } from "@/features/mermaid-editor/lib/canvas-geometry-index";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { SubgraphGeometry } from "@/features/mermaid-editor/lib/subgraph-geometry";

describe("canvas geometry index", () => {
  it("returns intersecting geometries in source order across positive and negative cells", () => {
    const nodes = [node("A", -600, -30), node("B", 20, 20), node("C", 900, 900)];
    const index = createCanvasGeometryIndex(nodes, [], 256);

    expect(index.queryNodes({ x: -700, y: -100, width: 900, height: 300 }).map((item) => item.id)).toEqual(["A", "B"]);
    expect(index.nodesAtPoint({ x: 40, y: 40 }).map((item) => item.id)).toEqual(["B"]);
  });

  it("keeps nested subgraphs deterministic for point queries", () => {
    const subgraphs = [subgraph("outer", 0, 0, 400, 400, 0), subgraph("inner", 100, 100, 120, 120, 1)];
    const index = createCanvasGeometryIndex([], subgraphs, 128);

    expect(index.subgraphsAtPoint({ x: 140, y: 140 }).map((item) => item.id)).toEqual(["outer", "inner"]);
  });
});

function node(id: string, x: number, y: number): NodeGeometry {
  const frame = { x, y, width: 120, height: 70 };
  return {
    id,
    frame,
    alignmentRect: { id, ...frame },
    routedRect: { id, ...frame },
    textBox: { x: 10, y: 10, width: 100, height: 50 },
    anchorsLocal: [],
    anchorsWorld: []
  } as NodeGeometry;
}

function subgraph(id: string, x: number, y: number, width: number, height: number, depth: number): SubgraphGeometry {
  const frame = { x, y, width, height };
  return {
    id,
    frame,
    titleBox: frame,
    contentBox: frame,
    alignmentRect: { id, ...frame },
    routedRect: { id, ...frame },
    anchorsLocal: [],
    anchorsWorld: [],
    depth
  };
}
