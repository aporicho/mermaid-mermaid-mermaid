import { describe, expect, it } from "vitest";

import {
  beginMarkdownDocumentDrag,
  canvasWorldPointFromClient,
  currentMarkdownDocumentDrag,
  endMarkdownDocumentDrag,
  extractMarkdownDocumentExcerpt,
  extractMarkdownDocumentPreview,
  initialMarkdownDocumentSource,
  isMarkdownDocumentNode,
  markdownDocumentActionForProjectFile,
  markdownDocumentPreviewFromText,
  markdownDocumentNodeForProjectFile,
  markdownDocumentProjectFileForRuntimeFile,
  normalizeNewMarkdownFileName,
  parseMarkdownDocumentDragPayload,
  serializeMarkdownDocumentDragPayload
} from "@/features/mermaid-editor/lib/markdown-document";

describe("Markdown document nodes", () => {
  it("recognizes Markdown file actions without changing the persisted node shape", () => {
    expect(isMarkdownDocumentNode({ action: { kind: "file", path: "docs/spec.md", openMode: "app-window" } })).toBe(true);
    expect(isMarkdownDocumentNode({ action: { kind: "file", path: "diagram.mmd", openMode: "app-window" } })).toBe(false);
    expect(isMarkdownDocumentNode({ action: { kind: "url", url: "https://example.com", openMode: "app-browser" } })).toBe(false);
  });

  it("extracts the first body paragraph and removes common inline Markdown", () => {
    const source = `---
title: Design
---

# Design

This is **the [main](https://example.com) paragraph**.
It continues here.

Second paragraph.`;

    expect(extractMarkdownDocumentExcerpt(source)).toBe("This is the main paragraph. It continues here.");
    expect(extractMarkdownDocumentExcerpt("# Empty\n\n")).toBe("");
  });

  it("builds a plain document preview from its title and full visible content", () => {
    expect(extractMarkdownDocumentPreview("# Design\n\nFirst **paragraph**.\n\n## Details\n\n- One\n- Two")).toEqual({
      title: "Design",
      excerpt: "First paragraph.\n\nDetails\n\nOne\nTwo"
    });
  });

  it("keeps normalized source for the native canvas preview", () => {
    expect(markdownDocumentPreviewFromText("docs/design.md", "# Design\r\n\r\n- **One**")).toMatchObject({
      status: "ready",
      source: "# Design\n\n- **One**",
      title: "Design"
    });
    expect(markdownDocumentPreviewFromText("docs/heading.md", "# Heading").status).toBe("ready");
    expect(markdownDocumentPreviewFromText("docs/empty.md", " \n").status).toBe("empty");
  });

  it("normalizes safe root-level Markdown names and creates a heading template", () => {
    expect(normalizeNewMarkdownFileName("design")).toBe("design.md");
    expect(normalizeNewMarkdownFileName("design.markdown")).toBe("design.markdown");
    expect(normalizeNewMarkdownFileName("docs/design.md")).toBe("");
    expect(normalizeNewMarkdownFileName("design.txt")).toBe("");
    expect(initialMarkdownDocumentSource("design.md")).toBe("# design\n\n");
  });

  it("treats project-relative and Windows absolute references to the same file as duplicates", () => {
    const file = { name: "Spec.md", path: "C:\\Repo\\docs\\Spec.md", relativePath: "docs/Spec.md" };
    const relativeNode = { id: "A", label: "Spec", x: 0, y: 0, fill: "#fff", action: { kind: "file" as const, path: "docs/Spec.md", openMode: "app-window" as const } };
    const absoluteNode = { ...relativeNode, id: "B", action: { ...relativeNode.action, path: "c:\\repo\\docs\\spec.md" } };

    expect(markdownDocumentNodeForProjectFile([relativeNode], file)?.id).toBe("A");
    expect(markdownDocumentNodeForProjectFile([absoluteNode], file)?.id).toBe("B");
  });

  it("round-trips internal drag data and converts client coordinates to canvas world coordinates", () => {
    const file = { name: "spec.md", path: "/repo/docs/spec.md", relativePath: "docs/spec.md" };
    expect(parseMarkdownDocumentDragPayload(serializeMarkdownDocumentDragPayload(file))).toEqual(file);
    expect(canvasWorldPointFromClient({ x: 250, y: 180 }, { left: 10, top: 20 }, { x: 40, y: 20, scale: 2 })).toEqual({ x: 100, y: 70 });
  });

  it("keeps an in-process drag fallback when Chromium omits the custom MIME type", () => {
    const file = { name: "spec.md", path: "/repo/docs/spec.md", relativePath: "docs/spec.md" };
    const values = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData(type: string, value: string) { values.set(type, value); }
    } as unknown as DataTransfer;

    beginMarkdownDocumentDrag(file, dataTransfer);
    expect(currentMarkdownDocumentDrag()).toEqual(file);
    expect(values.get("text/plain")).toBe("docs/spec.md");
    endMarkdownDocumentDrag();
    expect(currentMarkdownDocumentDrag()).toBeNull();
  });

  it("uses project-relative references when possible and preserves absolute external paths", () => {
    const projectFile = { name: "Spec.md", path: "/repo/Docs/Spec.md", relativePath: "Docs/Spec.md" };
    const workspace = { rootName: "repo", rootPath: "/repo", files: [projectFile], scannedAt: 1 };

    expect(markdownDocumentProjectFileForRuntimeFile({ name: "Spec.md", path: "/repo/Docs/Spec.md" }, workspace)).toBe(projectFile);
    const external = markdownDocumentProjectFileForRuntimeFile({ name: "Other.md", path: "/tmp/Other.md" }, workspace);
    expect(markdownDocumentActionForProjectFile(projectFile)).toMatchObject({ path: "docs/spec.md" });
    expect(markdownDocumentActionForProjectFile(external)).toMatchObject({ path: "/tmp/Other.md" });
  });
});
