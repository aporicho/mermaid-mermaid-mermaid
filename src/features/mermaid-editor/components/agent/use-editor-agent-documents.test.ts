import { describe, expect, it } from "vitest";

import { applyTextEdits } from "./use-editor-agent-documents";

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

});
