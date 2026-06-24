import { describe, expect, it } from "vitest";

import {
  documentKindFromPath,
  ensureDocumentFileName,
  isSupportedDocumentFilePath,
  isSupportedMarkdownFilePath,
  isSupportedMermaidFilePath
} from "@/features/mermaid-editor/lib/document-kind";

describe("document kind", () => {
  it("detects supported document extensions", () => {
    expect(documentKindFromPath("diagram.mmd")).toBe("mermaid");
    expect(documentKindFromPath("diagram.mermaid")).toBe("mermaid");
    expect(documentKindFromPath("notes.md")).toBe("markdown");
    expect(documentKindFromPath("notes.markdown")).toBe("markdown");
    expect(documentKindFromPath("board.canvas.json")).toBe("canvas");
    expect(documentKindFromPath("image.png")).toBeUndefined();
  });

  it("checks document kinds", () => {
    expect(isSupportedMermaidFilePath("diagram.mmd")).toBe(true);
    expect(isSupportedMarkdownFilePath("notes.md")).toBe(true);
    expect(isSupportedDocumentFilePath("board.canvas.json")).toBe(true);
    expect(isSupportedDocumentFilePath("notes.markdown")).toBe(true);
  });

  it("normalizes suggested file names", () => {
    expect(ensureDocumentFileName("diagram.txt", "mermaid")).toBe("diagram.mmd");
    expect(ensureDocumentFileName("notes.txt", "markdown")).toBe("notes.md");
    expect(ensureDocumentFileName("board.txt", "canvas")).toBe("board.canvas.json");
    expect(ensureDocumentFileName("board.canvas.json", "canvas")).toBe("board.canvas.json");
    expect(ensureDocumentFileName(undefined, "markdown")).toBe("document.md");
  });
});
