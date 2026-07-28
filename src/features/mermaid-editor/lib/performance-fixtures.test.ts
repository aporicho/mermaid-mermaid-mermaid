import { describe, expect, it } from "vitest";

import { createMixedPerformanceFixtureGraph, createPerformanceFixtureDocument, createPerformanceFixtureGraph, MIXED_PERFORMANCE_FIXTURE_NODE_COUNT, PERFORMANCE_FIXTURE_SIZES } from "@/features/mermaid-editor/lib/performance-fixtures";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
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

  it("builds a deterministic mixed fixture covering every canvas node kind", () => {
    const first = createMixedPerformanceFixtureGraph();
    const second = createMixedPerformanceFixtureGraph();
    const counts = Object.fromEntries(
      [...new Set(first.nodes.map(resolveCanvasNodeKind))].map((kind) => [kind, first.nodes.filter((node) => resolveCanvasNodeKind(node) === kind).length])
    );

    expect(first.nodes).toHaveLength(MIXED_PERFORMANCE_FIXTURE_NODE_COUNT);
    expect(counts).toEqual({
      standard: 40,
      image: 20,
      "link-card": 20,
      "markdown-document": 16,
      "html-document": 12,
      table: 12
    });
    expect(second).toEqual(first);
    expect(first.nodes.flatMap((node) => [node.asset?.src, node.preview?.cover?.src]).filter(Boolean).every((source) => String(source).startsWith("data:image/svg+xml"))).toBe(true);
  });
});
