import { describe, expect, it } from "vitest";

import { createPerformanceFixtureDocument, createPerformanceFixtureGraph, PERFORMANCE_FIXTURE_SIZES } from "@/features/mermaid-editor/lib/performance-fixtures";
import { loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";

describe("performance fixtures", () => {
  it("generates deterministic fixture graphs for every supported size", () => {
    for (const size of PERFORMANCE_FIXTURE_SIZES) {
      expect(createPerformanceFixtureGraph(size)).toEqual(createPerformanceFixtureGraph(size));
    }
  });

  it("generates unique node and edge ids with valid edge endpoints", () => {
    const graph = createPerformanceFixtureGraph(300);
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const edgeIds = new Set(graph.edges.map((edge) => edge.id));

    expect(nodeIds.size).toBe(graph.nodes.length);
    expect(edgeIds.size).toBe(graph.edges.length);
    expect(graph.nodes).toHaveLength(300);
    expect(graph.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))).toBe(true);
  });

  it("generates subgraphs with valid member ids", () => {
    const graph = createPerformanceFixtureGraph(800);
    const nodeIds = new Set(graph.nodes.map((node) => node.id));

    expect(graph.subgraphs?.length).toBeGreaterThan(0);
    expect(graph.subgraphs?.every((subgraph) => subgraph.nodeIds.length > 0 && subgraph.nodeIds.every((id) => nodeIds.has(id)))).toBe(true);
  });

  it("serializes fixture documents with canvas layout metadata", () => {
    const source = createPerformanceFixtureDocument(100);
    const document = loadMermaidDocument(source);

    expect(source).toContain("%% canvas-layout:");
    expect(document.graph.nodes).toHaveLength(100);
    expect(document.layoutMode).toBe("manual");
    expect(document.edgeRouting).toBe("bezier");
  });
});
