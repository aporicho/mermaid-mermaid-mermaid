import { describe, expect, it } from "vitest";

import { applyMermaidPatch } from "@/features/mermaid-editor/lib/mermaid-patch";
import { loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";

describe("mermaid patch theme preservation", () => {
  it("keeps file theme while applying graph operations", () => {
    const source = `%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","theme":{"themeId":"custom","customTheme":{"version":2,"name":"文件主题","ui":{"primary":"#123456"},"space":{"nodePaddingX":20}}},"viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`;

    const patched = applyMermaidPatch(source, {
      ops: [{ type: "updateNode", id: "A", label: "Beta" }]
    });

    expect(patched.ok).toBe(true);
    const reloaded = loadMermaidDocument(patched.result?.source || "");
    expect(reloaded.fileTheme?.themeId).toBe("custom");
    expect((reloaded.fileTheme?.customTheme as { ui?: { primary?: string } }).ui?.primary).toBe("#123456");
    expect(reloaded.graph.nodes[0].label).toBe("Beta");
  });

  it("adds image nodes through graph patch operations", () => {
    const patched = applyMermaidPatch("flowchart LR", {
      ops: [
        {
          type: "addNode",
          id: "Logo",
          label: "Logo",
          asset: { kind: "image", src: "assets/logo.png", width: 120, height: 80, labelPosition: "bottom" }
        }
      ]
    });

    expect(patched.ok).toBe(true);
    const reloaded = loadMermaidDocument(patched.result?.source || "");
    expect(reloaded.graph.nodes[0]).toMatchObject({
      id: "Logo",
      label: "Logo",
      asset: {
        kind: "image",
        src: "assets/logo.png",
        width: 120,
        height: 80,
        labelPosition: "bottom"
      }
    });
    expect(patched.result?.source).toContain('Logo@{ img: "assets/logo.png", label: "Logo", pos: "b", w: 120, h: 80, constraint: "on" }');
  });

  it("updates and clears pinned edge anchors through graph patch operations", () => {
    const pinned = applyMermaidPatch(
      `flowchart LR
  A[Alpha] --> B[Beta]
  B[Beta] --> C[Gamma]`,
      {
        ops: [{ type: "updateEdge", id: "A_B_0", fromAnchor: "bottom", toAnchor: "top" }]
      }
    );

    expect(pinned.ok).toBe(true);
    let reloaded = loadMermaidDocument(pinned.result?.source || "");
    expect(reloaded.graph.edges[0]).toMatchObject({
      fromAnchor: "bottom",
      toAnchor: "top"
    });

    const retargeted = applyMermaidPatch(pinned.result?.source || "", {
      ops: [{ type: "updateEdge", id: "A_B_0", to: "C" }]
    });

    expect(retargeted.ok).toBe(true);
    reloaded = loadMermaidDocument(retargeted.result?.source || "");
    expect(reloaded.graph.edges[0]).toMatchObject({
      from: "A",
      to: "C",
      fromAnchor: "bottom"
    });
    expect(reloaded.graph.edges[0].toAnchor).toBeUndefined();
  });

  it("applies full Mermaid edge semantics through graph patch operations", () => {
    const patched = applyMermaidPatch(
      `flowchart LR
  A[Alpha]
  B[Beta]`,
      {
        ops: [
          {
            type: "addEdge",
            from: "A",
            to: "B",
            label: "sync",
            style: "thick",
            markerStart: "circle",
            markerEnd: "cross",
            minLength: 2,
            animation: "fast",
            curve: "stepBefore",
            classes: ["animate", "primary"],
            styleText: "stroke:#f66,stroke-width:4px"
          }
        ]
      }
    );

    expect(patched.ok).toBe(true);
    const reloaded = loadMermaidDocument(patched.result?.source || "");
    expect(reloaded.graph.edges[0]).toMatchObject({
      mermaidId: "e1",
      from: "A",
      to: "B",
      label: "sync",
      style: "thick",
      markerStart: "circle",
      markerEnd: "cross",
      minLength: 2,
      animation: "fast",
      curve: "stepBefore",
      classes: ["animate", "primary"],
      styleText: "stroke:#f66,stroke-width:4px"
    });
    expect(patched.result?.source).toContain("A e1@o===x|sync| B");
    expect(patched.result?.source).toContain("e1@{ animation: fast, curve: stepBefore }");
    expect(patched.result?.source).toContain("class e1 animate,primary");
    expect(patched.result?.source).toContain("linkStyle 0 stroke:#f66,stroke-width:4px");
  });
});
