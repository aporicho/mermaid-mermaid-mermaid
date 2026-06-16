import { describe, expect, it } from "vitest";

import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { DEFAULT_EDGE_ROUTING } from "@/features/mermaid-editor/lib/editor-types";

describe("mermaid document", () => {
  it("loads flowchart documents as editable canvas graphs", () => {
    const document = loadMermaidDocument(`flowchart LR
  A[Alpha] --> B[Beta]`);

    expect(document).toMatchObject({
      diagramType: "flowchart",
      editableKind: "flowchart",
      parseStatus: "parsed"
    });
    expect(document.graph.nodes.map((node) => node.id)).toEqual(["A", "B"]);
    expect(document.graph.edges).toHaveLength(1);
  });

  it("keeps non-flowchart documents render-only and source-preserving", () => {
    const source = `sequenceDiagram
  participant User
  User->>AI: update Mermaid`;
    const document = loadMermaidDocument(source);
    const saved = buildMermaidDocument(document.source, document.graph, { x: 0, y: 0, scale: 1 }, DEFAULT_EDGE_ROUTING);

    expect(document).toMatchObject({
      diagramType: "sequence",
      editableKind: "render-only",
      parseStatus: "render-only"
    });
    expect(document.graph.nodes).toEqual([]);
    expect(saved).toContain(source);
  });
});
