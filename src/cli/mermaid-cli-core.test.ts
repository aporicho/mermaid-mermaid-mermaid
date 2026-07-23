import { describe, expect, it } from "vitest";

import {
  diffMermaidDocuments,
  layoutMermaidDocument,
  patchMermaidDocument,
  readMermaidDocument,
  validateMermaidDocument
} from "@/cli/mermaid-cli-core";

describe("mermaid CLI core", () => {
  it("reads Mermaid documents through the shared editor document model", () => {
    const result = readMermaidDocument(`%% canvas-layout: {"version":1,"edgeRouting":"mermaid","layoutMode":"manual","viewport":{"x":1,"y":2,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha] --> B[Beta]`);

    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({ diagramType: "flowchart", editableKind: "flowchart", edgeRouting: "mermaid", layoutMode: "manual" });
    expect(result.result?.graph.nodes.map((node) => node.id)).toEqual(["A", "B"]);
  });

  it("validates with the official Mermaid parser", async () => {
    const result = await validateMermaidDocument(`flowchart LR
  A -.>|bad| B`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "MERMAID_PARSE_ERROR", severity: "error" });
  });

  it("patches nodes by stable ID instead of label text", async () => {
    const result = await patchMermaidDocument(`flowchart LR
  A[Same] --> B[Same]`, { ops: [{ type: "updateNode", id: "B", label: "Changed" }] });
    expect(result.ok).toBe(true);
    expect(result.result?.written).toBe(false);
    expect(result.result?.source).toContain('B@{ shape: rect, label: "Changed" }');
    expect(result.result?.diff.semanticChanges.nodes[0]).toMatchObject({ type: "updated", id: "B" });
  });

  it("keeps render-only Mermaid diagrams readable but blocks structural patching", async () => {
    const source = `sequenceDiagram
  participant User
  User->>AI: update`;
    expect((await validateMermaidDocument(source)).ok).toBe(true);
    const result = await patchMermaidDocument(source, [{ type: "addNode", id: "A", label: "Alpha" }]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code: "UNSUPPORTED_DIAGRAM_TYPE" });
  });

  it("diffs semantic changes separately from layout changes", () => {
    const before = `%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`;
    const after = before.replace('"x":10', '"x":40');
    const result = diffMermaidDocuments(before, after);
    expect(result.result?.semanticChanges.nodes).toEqual([]);
    expect(result.result?.layoutChanges.nodes).toHaveLength(1);
  });

  it("applies Dagre layout and updates canvas layout metadata", async () => {
    const result = await layoutMermaidDocument(`flowchart LR
  A[Alpha] --> B[Beta] --> C[Gamma]`, { edgeRouting: "mermaid", layoutMode: "auto" });
    expect(result.ok).toBe(true);
    expect(result.result?.source).toContain('"edgeRouting":"mermaid"');
    expect(result.result?.source).toContain('"layoutMode":"auto"');
    expect(result.result?.diff.layoutChanges.nodes.length).toBeGreaterThan(0);
  });
});
