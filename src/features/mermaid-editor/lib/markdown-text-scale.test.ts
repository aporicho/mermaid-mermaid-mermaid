import { describe, expect, it } from "vitest";

import {
  adjustMarkdownTextScale,
  clampMarkdownTextScale,
  markdownTextScalePercent
} from "@/features/mermaid-editor/lib/markdown-text-scale";

describe("Markdown text scale", () => {
  it("clamps and snaps persisted values to the 70–200% range", () => {
    expect(clampMarkdownTextScale(Number.NaN)).toBe(1);
    expect(clampMarkdownTextScale(0.65)).toBe(0.7);
    expect(clampMarkdownTextScale(1.26)).toBe(1.3);
    expect(clampMarkdownTextScale(2.08)).toBe(2);
  });

  it("moves in 10% steps without crossing a boundary", () => {
    expect(adjustMarkdownTextScale(1, -1)).toBe(0.9);
    expect(adjustMarkdownTextScale(1, 1)).toBe(1.1);
    expect(adjustMarkdownTextScale(0.7, -1)).toBe(0.7);
    expect(adjustMarkdownTextScale(2, 1)).toBe(2);
    expect(markdownTextScalePercent(1.26)).toBe("130%");
  });
});
