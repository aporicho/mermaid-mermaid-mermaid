import { describe, expect, it } from "vitest";

import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import {
  DEFAULT_VIEW_FILTERS,
  hiddenFilterCount,
  isEdgeVisible,
  normalizeViewFilters,
  selectionWithoutHidden
} from "@/features/mermaid-editor/lib/view-filters";

const graph: MermaidGraph = {
  direction: "TD",
  nodes: [
    { id: "A", label: "A", x: 0, y: 0, fill: "#fff" },
    { id: "B", label: "B", x: 120, y: 0, fill: "#fff" }
  ],
  edges: [
    { id: "edge-solid", from: "A", to: "B", label: "", style: "solid", arrowType: "arrow" },
    { id: "edge-dotted", from: "B", to: "A", label: "", style: "dotted", arrowType: "circle" },
    { id: "edge-group", from: "A", to: "Group", label: "", style: "thick", arrowType: "cross" }
  ],
  subgraphs: [{ id: "Group", title: "Group", nodeIds: ["A"] }]
};

describe("view filters", () => {
  it("defaults to showing every filterable layer", () => {
    expect(normalizeViewFilters(undefined)).toEqual(DEFAULT_VIEW_FILTERS);
    expect(hiddenFilterCount(DEFAULT_VIEW_FILTERS)).toBe(0);
  });

  it("migrates legacy grid and edge visibility", () => {
    expect(normalizeViewFilters(undefined, { showGrid: false, showEdges: false })).toMatchObject({
      grid: false,
      edges: false,
      nodes: true
    });
  });

  it("hides edges when connected nodes or subgraphs are hidden", () => {
    expect(isEdgeVisible(graph.edges[0], graph, { ...DEFAULT_VIEW_FILTERS, nodes: false })).toBe(false);
    expect(isEdgeVisible(graph.edges[2], graph, { ...DEFAULT_VIEW_FILTERS, subgraphs: false })).toBe(false);
  });

  it("filters edges by style and arrow type", () => {
    const filters = {
      ...DEFAULT_VIEW_FILTERS,
      edgeStyles: { ...DEFAULT_VIEW_FILTERS.edgeStyles, dotted: false },
      arrowTypes: { ...DEFAULT_VIEW_FILTERS.arrowTypes, cross: false }
    };

    expect(isEdgeVisible(graph.edges[0], graph, filters)).toBe(true);
    expect(isEdgeVisible(graph.edges[1], graph, filters)).toBe(false);
    expect(isEdgeVisible(graph.edges[2], graph, filters)).toBe(false);
  });

  it("does not hide edge bodies when only labels are hidden", () => {
    expect(isEdgeVisible(graph.edges[0], graph, { ...DEFAULT_VIEW_FILTERS, edgeLabels: false, nodeLabels: false })).toBe(true);
  });

  it("removes hidden entities from selection", () => {
    const selection: Selection = {
      nodeIds: ["A"],
      edgeIds: ["edge-solid", "edge-dotted"],
      subgraphIds: ["Group"],
      primaryId: "edge-dotted"
    };
    const filters = {
      ...DEFAULT_VIEW_FILTERS,
      nodes: false,
      edgeStyles: { ...DEFAULT_VIEW_FILTERS.edgeStyles, dotted: false }
    };

    expect(selectionWithoutHidden(selection, graph, filters)).toEqual({
      nodeIds: [],
      edgeIds: [],
      subgraphIds: ["Group"],
      primaryId: "Group"
    });
  });
});
