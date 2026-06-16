import { describe, expect, it } from "vitest";

import { detectDiagramType, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";

describe("mermaid graph parser", () => {
  it("parses editable flowchart node shapes and edge semantics", () => {
    const graph = parseMermaid(`flowchart LR
  A([Start]) -.->|review| B{{Decision}}
  B --x C[(Database)]
  C --- A`);

    expect(graph.editableKind).toBe("flowchart");
    expect(graph.nodes.find((node) => node.id === "A")?.shape).toBe("stadium");
    expect(graph.nodes.find((node) => node.id === "B")?.shape).toBe("hexagon");
    expect(graph.nodes.find((node) => node.id === "C")?.shape).toBe("database");
    expect(graph.edges[0]).toMatchObject({ from: "A", to: "B", label: "review", style: "dotted", arrowType: "arrow" });
    expect(graph.edges[1]).toMatchObject({ from: "B", to: "C", style: "solid", arrowType: "cross" });
    expect(graph.edges[2]).toMatchObject({ from: "C", to: "A", style: "solid", arrowType: "none" });
  });

  it("serializes flowchart shapes and arrow markers back to Mermaid", () => {
    const serialized = serializeMermaid(parseMermaid(`flowchart LR
  A([Start]) --> B{Decision}
  B --o C((Done))`));

    expect(serialized).toContain('A(["Start"])');
    expect(serialized).toContain('B{"Decision"}');
    expect(serialized).toContain('C(("Done"))');
    expect(serialized).toContain("B --o C");
  });

  it("preserves flowchart comments and semantic statements during serialization", () => {
    const serialized = serializeMermaid(parseMermaid(`flowchart TD
  %% keep this comment
  A[Alpha]
  classDef primary fill:#fff,stroke:#333
  class A primary
  style A fill:#eee`));

    expect(serialized).toContain("%% keep this comment");
    expect(serialized).toContain("classDef primary fill:#fff,stroke:#333");
    expect(serialized).toContain("class A primary");
    expect(serialized).toContain("style A fill:#eee");
  });

  it("preserves unsupported flowchart statements instead of dropping source", () => {
    const serialized = serializeMermaid(parseMermaid(`flowchart LR
  A -- unsupported label syntax --> B
  click A href "https://example.com"`));

    expect(serialized).toContain("A -- unsupported label syntax --> B");
    expect(serialized).toContain('click A href "https://example.com"');
  });

  it("captures subgraph membership without treating subgraph syntax as loose nodes", () => {
    const graph = parseMermaid(`flowchart TD
  subgraph frontend [前端]
    WebUI[WebUI]
    Source[Mermaid 文件]
  end
  WebUI --> Source`);

    expect(graph.subgraphs).toEqual([{ id: "frontend", title: "前端", nodeIds: ["WebUI", "Source"] }]);
    expect(serializeMermaid(graph)).toContain("subgraph frontend [前端]");
  });

  it("detects non-flowchart Mermaid types as render-only", () => {
    expect(detectDiagramType("sequenceDiagram\n  A->>B: hello")).toBe("sequence");
    expect(parseMermaid("sequenceDiagram\n  A->>B: hello")).toMatchObject({
      diagramType: "sequence",
      editableKind: "render-only",
      parseStatus: "render-only",
      nodes: [],
      edges: []
    });
  });
});
