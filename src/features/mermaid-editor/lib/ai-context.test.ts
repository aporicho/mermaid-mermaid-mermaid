import { describe, expect, it } from "vitest";

import { buildAiEditorContext, markAiEditorContextStale } from "@/features/mermaid-editor/lib/ai-context";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";

const graph: MermaidGraph = {
  diagramType: "flowchart",
  editableKind: "flowchart",
  parseStatus: "parsed",
  direction: "LR",
  nodes: [
    { id: "A", label: "Alpha", x: 100, y: 100, fill: "#fff", shape: "rect" },
    { id: "B", label: "Beta", x: 360, y: 100, fill: "#fff", shape: "circle" },
    { id: "C", label: "Gamma", x: 2000, y: 2000, fill: "#fff", shape: "diam" }
  ],
  edges: [
    { id: "A_B", from: "A", to: "B", label: "go", style: "solid", arrowType: "arrow" },
    { id: "B_C", from: "B", to: "C", label: "", style: "dotted", arrowType: "none" }
  ],
  subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A", "B"] }]
};

function context(overrides: Partial<Parameters<typeof buildAiEditorContext>[0]> = {}) {
  return buildAiEditorContext({
    source: "flowchart LR\n  A --> B\n",
    graph,
    selection: { nodeIds: ["B"], edgeIds: [], subgraphIds: [], primaryId: "B" },
    viewport: { x: 0, y: 0, scale: 1 },
    canvasSize: { width: 800, height: 480 },
    fileName: "demo.mmd",
    dirty: true,
    diagramType: "flowchart",
    editableKind: "flowchart",
    mode: "select",
    workspaceView: "canvas",
    edgeRouting: "mermaid",
    layoutMode: "manual",
    diagnostics: [],
    now: new Date("2026-06-17T00:00:00.000Z"),
    ...overrides
  });
}

describe("AI editor context", () => {
  it("summarizes selected entities and document state", () => {
    const result = context();

    expect(result.document).toMatchObject({
      fileName: "demo.mmd",
      dirty: true,
      nodeCount: 3,
      edgeCount: 2,
      subgraphCount: 1
    });
    expect(result.selection.nodes).toEqual([
      expect.objectContaining({ id: "B", label: "Beta", incoming: 1, outgoing: 1, parentId: "Group" })
    ]);
  });

  it("reports the source workspace view", () => {
    const result = context({ workspaceView: "source" });

    expect(result.document.workspaceView).toBe("source");
  });

  it("includes complete Mermaid edge semantics in selected edge context", () => {
    const result = context({
      graph: {
        ...graph,
        edges: [
          {
            ...graph.edges[0],
            markerStart: "circle",
            markerEnd: "cross",
            minLength: 3,
            mermaidId: "e1",
            animation: "slow",
            curve: "stepBefore",
            classes: ["animate", "primary"],
            styleText: "stroke:#f66"
          },
          graph.edges[1]
        ]
      },
      selection: { nodeIds: [], edgeIds: ["A_B"], subgraphIds: [], primaryId: "A_B" }
    });

    expect(result.selection.edges[0]).toMatchObject({
      id: "A_B",
      markerStart: "circle",
      markerEnd: "cross",
      arrowType: "cross",
      minLength: 3,
      mermaidId: "e1",
      animation: "slow",
      curve: "stepBefore",
      classes: ["animate", "primary"],
      styleText: "stroke:#f66"
    });
  });

  it("ranks active editing and selected nodes before merely visible nodes", () => {
    const result = context({
      editing: { kind: "node", id: "A", draftText: "Draft Alpha" },
      recentActions: [{ id: "1", at: "2026-06-17T00:00:00.000Z", type: "node.edit", target: { kind: "node", id: "A" } }]
    });

    expect(result.focusRank[0]).toMatchObject({ kind: "node", id: "A" });
    expect(result.focusRank.map((item) => item.id)).toContain("B");
  });

  it("keeps visible context bounded to the viewport", () => {
    const result = context();

    expect(result.visible.nodes.map((node) => node.id)).toContain("A");
    expect(result.visible.nodes.map((node) => node.id)).not.toContain("C");
  });

  it("uses interaction visible scope when provided", () => {
    const interactionContext = buildInteractionContext({
      graph,
      selection: { nodeIds: ["B"], edgeIds: [], subgraphIds: [], primaryId: "B" },
      viewport: { x: 0, y: 0, scale: 1 },
      canvasSize: { width: 800, height: 480 },
      viewFilters: { ...DEFAULT_VIEW_FILTERS, nodes: false }
    });
    const result = context({ interactionContext });

    expect(result.visible.nodes).toEqual([]);
    expect(result.visible.edges).toEqual([]);
  });

  it("marks stale contexts based on their own ttl", () => {
    const fresh = context({ ttlMs: 1000 });
    const stale = markAiEditorContextStale(fresh, new Date("2026-06-17T00:00:02.000Z"));

    expect(stale.stale).toBe(true);
  });
});
