import { describe, expect, it } from "vitest";

import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

const graph: MermaidGraph = {
  direction: "LR",
  diagramType: "flowchart",
  editableKind: "flowchart",
  parseStatus: "parsed",
  nodes: [
    { id: "A", label: "A", x: 100, y: 100, fill: "#fff" },
    { id: "B", label: "B", x: 300, y: 100, fill: "#fff" },
    { id: "C", label: "C", x: 3000, y: 3000, fill: "#fff" }
  ],
  edges: [
    { id: "A_B", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" },
    { id: "B_C", from: "B", to: "C", label: "", style: "dotted", arrowType: "circle" }
  ],
  subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A", "B"] }]
};

function context(overrides: Partial<Parameters<typeof buildInteractionContext>[0]> = {}) {
  return buildInteractionContext({
    graph,
    selection: { nodeIds: ["A"], edgeIds: [], subgraphIds: [], primaryId: "A" },
    viewport: { x: 0, y: 0, scale: 1 },
    viewFilters: DEFAULT_VIEW_FILTERS,
    mode: "select",
    workspaceView: "canvas",
    canvasSize: { width: 800, height: 480 },
    ...overrides
  });
}

describe("interaction context", () => {
  it("derives visible scope from viewport and view filters", () => {
    const result = context();

    expect(result.visibleScope.nodeIds).toEqual(["A", "B"]);
    expect(result.visibleScope.edgeIds).toEqual(["A_B", "B_C"]);
    expect(result.visibleScope.subgraphIds).toEqual(["Group"]);
    expect(result.visibleScope.grid).toBe(true);
  });

  it("keeps hidden layers out of visible scope", () => {
    const result = context({
      viewFilters: {
        ...DEFAULT_VIEW_FILTERS,
        nodes: false,
        edgeStyles: { ...DEFAULT_VIEW_FILTERS.edgeStyles, dotted: false },
        grid: false
      }
    });

    expect(result.visibleScope.nodeIds).toEqual([]);
    expect(result.visibleScope.edgeIds).toEqual([]);
    expect(result.visibleScope.grid).toBe(false);
  });

  it("derives capabilities from workspace and editable kind", () => {
    expect(context().capabilities.canEditGraph).toBe(true);
    expect(context({ workspaceView: "render" }).capabilities.canEditGraph).toBe(false);
    expect(context({ editableKind: "render-only" }).capabilities.canEditText).toBe(false);
    expect(context({ workspaceView: "source", editableKind: "render-only" }).capabilities).toMatchObject({
      canEditGraph: false,
      canEditText: true,
      canUseSelection: false
    });
  });
});
