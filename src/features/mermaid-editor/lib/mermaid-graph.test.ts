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
