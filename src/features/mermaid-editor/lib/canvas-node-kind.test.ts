import { describe, expect, it } from "vitest";

import { isCsvTableNode, resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

function node(patch: Partial<CanvasNode> = {}): CanvasNode {
  return { id: "T", label: "Data", x: 10, y: 20, fill: "#fff", ...patch };
}

describe("canvas node kind", () => {
  it("recognizes CSV file references before transient content is loaded", () => {
    const loading = node({ action: { kind: "file", path: "data/report.CSV", openMode: "app-window" } });

    expect(isCsvTableNode(loading)).toBe(true);
    expect(resolveCanvasNodeKind(loading)).toBe("table");
  });

  it("keeps a CSV reference as a table after transient content is injected", () => {
    const loaded = node({
      action: { kind: "file", path: "data/report.csv", openMode: "app-window" },
      content: createDefaultCanvasTableContent(2, 2)
    });

    expect(resolveCanvasNodeKind(loaded)).toBe("table");
  });

  it("keeps legacy content-backed tables compatible during the CSV migration", () => {
    expect(resolveCanvasNodeKind(node({ content: createDefaultCanvasTableContent(2, 2) }))).toBe("table");
    expect(resolveCanvasNodeKind(node({ action: { kind: "file", path: "notes/table.md", openMode: "app-window" } }))).toBe("markdown-document");
  });

  it("renders HTML file actions as their own special node kind", () => {
    expect(resolveCanvasNodeKind(node({ action: { kind: "file", path: "web/index.html", openMode: "app-window" } }))).toBe("html-document");
  });
});
