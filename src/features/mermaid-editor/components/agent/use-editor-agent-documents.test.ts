import { describe, expect, it } from "vitest";

import { parseCanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";

import { applyCanvasOperations, applyTextEdits } from "./use-editor-agent-documents";

describe("Agent live document patches", () => {
  it("applies multiple UTF-16 edits against one immutable revision", () => {
    expect(applyTextEdits("Alpha Beta Gamma", [
      { start: 0, end: 5, text: "A" },
      { start: 11, end: 16, text: "G" }
    ])).toBe("A Beta G");
  });

  it("rejects overlapping edits", () => {
    expect(() => applyTextEdits("abcdef", [
      { start: 1, end: 4, text: "x" },
      { start: 3, end: 5, text: "y" }
    ])).toThrow("不能重叠");
  });

  it("updates Canvas elements without changing their identity or kind", () => {
    const source = JSON.stringify({
      schema: "mmm.canvas",
      version: 1,
      viewport: { x: 0, y: 0, scale: 1 },
      elements: [{ id: "C1", type: "text", x: 10, y: 20, width: 100, height: 30, text: "before", fontSize: 16, fill: "#000" }]
    });
    const next = parseCanvasDocument(applyCanvasOperations(source, [
      { type: "updateElement", id: "C1", patch: { id: "renamed", type: "image", text: "after" } },
      { type: "setViewport", viewport: { x: 120 } }
    ]));
    expect(next.elements[0]).toMatchObject({ id: "C1", type: "text", text: "after" });
    expect(next.viewport.x).toBe(120);
  });
});
