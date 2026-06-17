import { describe, expect, it } from "vitest";

import { resolveCanvasRenderScope, type CanvasRenderEntityBounds } from "@/features/mermaid-editor/lib/canvas-render-scope";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

const graph: MermaidGraph = {
  direction: "LR",
  nodes: [
    { id: "A", label: "A", x: 10, y: 10, fill: "#fff" },
    { id: "B", label: "B", x: 1000, y: 1000, fill: "#fff" },
    { id: "C", label: "C", x: 1260, y: 1000, fill: "#fff" }
  ],
  edges: [
    { id: "A_B", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" },
    { id: "B_C", from: "B", to: "C", label: "", style: "solid", arrowType: "arrow" }
  ],
  subgraphs: [
    { id: "Near", title: "Near", nodeIds: ["A"] },
    { id: "Far", title: "Far", nodeIds: ["B", "C"] }
  ]
};

const nodeBounds: CanvasRenderEntityBounds[] = [
  { id: "A", frame: { x: 10, y: 10, width: 120, height: 70 } },
  { id: "B", frame: { x: 1000, y: 1000, width: 120, height: 70 } },
  { id: "C", frame: { x: 1260, y: 1000, width: 120, height: 70 } }
];

const subgraphBounds: CanvasRenderEntityBounds[] = [
  { id: "Near", frame: { x: 0, y: 0, width: 180, height: 120 } },
  { id: "Far", frame: { x: 960, y: 940, width: 480, height: 220 } }
];

function scope(overrides: Partial<Parameters<typeof resolveCanvasRenderScope>[0]> = {}) {
  return resolveCanvasRenderScope({
    graph,
    viewport: { x: 0, y: 0, scale: 1 },
    canvasSize: { width: 400, height: 300 },
    viewFilters: DEFAULT_VIEW_FILTERS,
    nodeBounds,
    subgraphBounds,
    selection: { nodeIds: [], edgeIds: [], subgraphIds: [] },
    overscanPx: 0,
    ...overrides
  });
}

describe("canvas render scope", () => {
  it("keeps only entities inside the expanded viewport by default", () => {
    const result = scope();

    expect([...result.nodeIds]).toEqual(["A"]);
    expect([...result.subgraphIds]).toEqual(["Near"]);
    expect([...result.edgeIds]).toEqual(["A_B"]);
  });

  it("preserves selected, hovered, and inline edited entities outside the viewport", () => {
    const result = scope({
      selection: { nodeIds: ["B"], edgeIds: ["B_C"], subgraphIds: [], primaryId: "B" },
      hoveredSubgraphId: "Far",
      inlineEdit: { type: "edge", id: "B_C" }
    });

    expect(result.nodeIds.has("B")).toBe(true);
    expect(result.subgraphIds.has("Far")).toBe(true);
    expect(result.edgeIds.has("B_C")).toBe(true);
  });

  it("preserves active connection targets outside the viewport", () => {
    const result = scope({
      interactionState: {
        kind: "connectingEdge",
        pointerId: 0,
        fromId: "A",
        startWorld: { x: 0, y: 0 },
        currentWorld: { x: 1200, y: 1020 }
      },
      connectionTargetNodeId: "C",
      connectionInvalidSubgraphId: "Far"
    });

    expect(result.nodeIds.has("A")).toBe(true);
    expect(result.nodeIds.has("C")).toBe(true);
    expect(result.subgraphIds.has("Far")).toBe(true);
  });

  it("does not render hidden entities even when they are selected", () => {
    const result = scope({
      viewFilters: { ...DEFAULT_VIEW_FILTERS, nodes: false, subgraphs: false, edges: false },
      selection: { nodeIds: ["A", "B"], edgeIds: ["A_B"], subgraphIds: ["Near", "Far"], primaryId: "B" }
    });

    expect([...result.nodeIds]).toEqual([]);
    expect([...result.subgraphIds]).toEqual([]);
    expect([...result.edgeIds]).toEqual([]);
  });

  it("disables culling until the canvas has a stable size", () => {
    const result = scope({ canvasSize: { width: 0, height: 0 } });

    expect([...result.nodeIds]).toEqual(["A", "B", "C"]);
    expect([...result.subgraphIds]).toEqual(["Near", "Far"]);
    expect([...result.edgeIds]).toEqual(["A_B", "B_C"]);
  });
});
