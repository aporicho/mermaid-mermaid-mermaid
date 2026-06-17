import { describe, expect, it } from "vitest";

import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { FLOWCHART_SHAPES } from "@/features/mermaid-editor/lib/flowchart-shapes";
import {
  createNode,
  detectDiagramType,
  nextCanvasNodeId,
  parseMermaid,
  serializeMermaid
} from "@/features/mermaid-editor/lib/mermaid-graph";

function node(id: string): CanvasNode {
  return { id, label: id, x: 0, y: 0, fill: "#ffffff", shape: "rect" };
}

describe("mermaid graph parser", () => {
  it("generates compact Mermaid source IDs only for new canvas nodes", () => {
    expect(nextCanvasNodeId([])).toBe("N1");
    expect(nextCanvasNodeId([node("A"), node("WebUI")])).toBe("N1");
    expect(nextCanvasNodeId([node("N1"), node("N2")])).toBe("N3");
    expect(nextCanvasNodeId([node("N1"), node("N3")])).toBe("N4");

    expect(createNode([node("N1"), node("N3")], 24, 48)).toMatchObject({
      id: "N4",
      label: "新节点",
      x: 24,
      y: 48
    });
  });

  it("parses editable flowchart node shapes and edge semantics", () => {
    const graph = parseMermaid(`flowchart LR
  A([Start]) -.->|review| B{{Decision}}
  B --x C[(Database)]
  C --- A`);

    expect(graph.editableKind).toBe("flowchart");
    expect(graph.nodes.find((node) => node.id === "A")?.shape).toBe("stadium");
    expect(graph.nodes.find((node) => node.id === "B")?.shape).toBe("hex");
    expect(graph.nodes.find((node) => node.id === "C")?.shape).toBe("cyl");
    expect(graph.edges[0]).toMatchObject({ from: "A", to: "B", label: "review", style: "dotted", arrowType: "arrow" });
    expect(graph.edges[1]).toMatchObject({ from: "B", to: "C", style: "solid", arrowType: "cross" });
    expect(graph.edges[2]).toMatchObject({ from: "C", to: "A", style: "solid", arrowType: "none" });
  });

  it("serializes flowchart shapes and arrow markers back to Mermaid", () => {
    const serialized = serializeMermaid(parseMermaid(`flowchart LR
  A([Start]) --> B{Decision}
  B --o C((Done))`));

    expect(serialized).toContain('A@{ shape: stadium, label: "Start" }');
    expect(serialized).toContain('B@{ shape: diam, label: "Decision" }');
    expect(serialized).toContain('C@{ shape: circle, label: "Done" }');
    expect(serialized).toContain("B --o C");
  });

  it("serializes edge operators with legal Mermaid flowchart syntax", () => {
    const serialized = serializeMermaid({
      direction: "LR",
      nodes: [node("A"), node("B"), node("C"), node("D")],
      edges: [
        { id: "e1", from: "A", to: "B", label: "review", style: "dotted", arrowType: "arrow" },
        { id: "e2", from: "B", to: "C", label: "", style: "dotted", arrowType: "none" },
        { id: "e3", from: "C", to: "D", label: "ship", style: "thick", arrowType: "arrow" },
        { id: "e4", from: "D", to: "A", label: "", style: "solid", arrowType: "cross" }
      ]
    });

    expect(serialized).toContain("A -.->|review| B");
    expect(serialized).toContain("B -.- C");
    expect(serialized).toContain("C ==>|ship| D");
    expect(serialized).toContain("D --x A");
    expect(serialized).not.toContain("-.>|");
  });

  it("parses Mermaid 11 object shape syntax", () => {
    const graph = parseMermaid(`flowchart LR
  A@{ shape: doc, label: "设计文档" }
  B@{ shape: database, label: "Mermaid 文件" }
  A --> B`);

    expect(graph.nodes.find((node) => node.id === "A")).toMatchObject({ label: "设计文档", shape: "doc" });
    expect(graph.nodes.find((node) => node.id === "B")).toMatchObject({ label: "Mermaid 文件", shape: "cyl" });
  });

  it("round-trips every public Mermaid 11 flowchart shape through the canonical serializer", () => {
    const source = [
      "flowchart LR",
      ...FLOWCHART_SHAPES.map((shape, index) => `  N${index}@{ shape: ${shape.id}, label: "${shape.label}" }`)
    ].join("\n");
    const graph = parseMermaid(source);
    const serialized = serializeMermaid(graph);

    expect(graph.nodes).toHaveLength(FLOWCHART_SHAPES.length);
    for (const [index, shape] of FLOWCHART_SHAPES.entries()) {
      expect(graph.nodes[index]).toMatchObject({ id: `N${index}`, shape: shape.id, label: shape.label });
      expect(serialized).toContain(`N${index}@{ shape: ${shape.id}, label: "${shape.label}" }`);
    }
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

  it("round-trips nested subgraphs, subgraph direction, and subgraph edges", () => {
    const graph = parseMermaid(`flowchart LR
  subgraph Outer [外层]
    direction TB
    subgraph Inner [内层]
      A[Alpha]
    end
    B[Beta]
  end
  Inner --> B
  Outer -.-> A`);

    expect(graph.nodes.map((item) => item.id).sort()).toEqual(["A", "B"]);
    expect(graph.subgraphs).toEqual([
      { id: "Outer", title: "外层", nodeIds: ["B"], direction: "TB" },
      { id: "Inner", title: "内层", nodeIds: ["A"], parentId: "Outer" }
    ]);
    expect(graph.edges).toMatchObject([
      { from: "Inner", to: "B", style: "solid" },
      { from: "Outer", to: "A", style: "dotted" }
    ]);

    const serialized = serializeMermaid(graph);
    expect(serialized).toContain("subgraph Outer [外层]");
    expect(serialized).toContain("direction TB");
    expect(serialized).toContain("subgraph Inner [内层]");
    expect(serialized).toContain("Inner --> B");
    expect(serialized).toContain("Outer -.-> A");
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
