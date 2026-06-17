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
});
