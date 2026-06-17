import { describe, expect, it } from "vitest";

import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE } from "@/features/mermaid-editor/lib/editor-types";

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
    const saved = buildMermaidDocument(document.source, document.graph, { x: 0, y: 0, scale: 1 }, DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE);

    expect(document).toMatchObject({
      diagramType: "sequence",
      editableKind: "render-only",
      parseStatus: "render-only"
    });
    expect(document.graph.nodes).toEqual([]);
    expect(saved).toContain(source);
  });

  it("loads saved layout mode and orthogonal routing", () => {
    const document = loadMermaidDocument(`%% canvas-layout: {"version":1,"edgeRouting":"orthogonal","layoutMode":"auto","viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`);

    expect(document.edgeRouting).toBe("orthogonal");
    expect(document.layoutMode).toBe("auto");
    expect(document.graph.nodes[0]).toMatchObject({ id: "A", x: 10, y: 20 });
  });

  it("loads saved mermaid routing as a supported manual canvas routing mode", () => {
    const document = loadMermaidDocument(`%% canvas-layout: {"version":1,"edgeRouting":"mermaid","layoutMode":"manual","viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"},"B":{"x":120,"y":20,"fill":"#eee"}}}
flowchart LR
  A[Alpha] --> B[Beta]`);

    expect(document.edgeRouting).toBe("mermaid");
    expect(document.layoutMode).toBe("manual");
    expect(document.graph.edges).toHaveLength(1);
  });

  it("round-trips file theme through the canvas layout comment", () => {
    const document = loadMermaidDocument(`%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","theme":{"themeId":"custom","customTheme":{"version":2,"name":"文件主题","ui":{"primary":"#123456"},"space":{"nodePaddingX":20}}},"viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`);
    const saved = buildMermaidDocument(document.source, document.graph, { x: 12, y: 24, scale: 1.2 }, document.edgeRouting, document.layoutMode, document.fileTheme);
    const reloaded = loadMermaidDocument(saved);

    expect(document.fileTheme?.themeId).toBe("custom");
    expect(reloaded.fileTheme?.themeId).toBe("custom");
    expect((reloaded.fileTheme?.customTheme as { ui?: { primary?: string } }).ui?.primary).toBe("#123456");
    expect(reloaded.viewport).toEqual({ x: 12, y: 24, scale: 1.2 });
  });
});
