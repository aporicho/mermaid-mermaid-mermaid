import type { DragEvent, RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { createMarkdownDocumentDropHandlers } from "@/features/mermaid-editor/components/mermaid-editor/markdown-document-drop";
import { beginMarkdownDocumentDrag } from "@/features/mermaid-editor/lib/markdown-document";

function createHandlers(addProjectMarkdownFile = vi.fn()) {
  const addProjectHtmlFile = vi.fn();
  const external = {
    enter: vi.fn(), over: vi.fn(), leave: vi.fn(), drop: vi.fn(), runtime: vi.fn()
  };
  const workspaceSurface = {
    getBoundingClientRect: () => ({ left: 100, top: 50, right: 1100, bottom: 750 }),
    contains: vi.fn(() => false)
  };
  const setFileDropFeedback = vi.fn();
  vi.stubGlobal("document", { elementFromPoint: vi.fn(() => workspaceSurface) });
  const handlers = createMarkdownDocumentDropHandlers({
    isCanvasEditable: true,
    workspaceView: "canvas",
    viewport: { x: 20, y: 10, scale: 2 },
    workspaceSurfaceRef: { current: workspaceSurface } as unknown as RefObject<HTMLDivElement>,
    addProjectMarkdownFile,
    addProjectHtmlFile,
    setStatus: vi.fn(),
    setFileDropFeedback,
    usesRuntimeFileDrops: true,
    projectWorkspace: null,
    external
  });
  return { handlers, addProjectMarkdownFile, addProjectHtmlFile, external, setFileDropFeedback, workspaceSurface };
}

describe("Markdown document drops", () => {
  it("adds an internal project-tree drag even when the custom MIME type is missing", () => {
    const file = { name: "spec.md", path: "/repo/spec.md", relativePath: "spec.md" };
    beginMarkdownDocumentDrag(file, { effectAllowed: "none", setData: vi.fn() } as unknown as DataTransfer);
    const { handlers, addProjectMarkdownFile } = createHandlers();
    const event = {
      clientX: 320,
      clientY: 240,
      dataTransfer: { types: [], files: [], getData: () => "" },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn()
    } as unknown as DragEvent<HTMLElement>;

    handlers.drop(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(addProjectMarkdownFile).toHaveBeenCalledWith(file, { x: 100, y: 90 }, "pointer");
  });

  it("turns an Electron file-manager drop into an absolute Markdown card reference", () => {
    const { handlers, addProjectMarkdownFile, external } = createHandlers();

    handlers.runtime({
      type: "drop",
      files: [{ name: "External.md", path: "/tmp/External.md" }],
      position: { x: 320, y: 240 }
    });

    expect(external.runtime).not.toHaveBeenCalled();
    expect(addProjectMarkdownFile).toHaveBeenCalledWith(
      { name: "External.md", path: "/tmp/External.md", relativePath: "/tmp/External.md" },
      { x: 100, y: 90 },
      "pointer"
    );
  });

  it("turns an Electron HTML drop into an HTML file node reference", () => {
    const { handlers, addProjectHtmlFile, external } = createHandlers();

    handlers.runtime({
      type: "drop",
      files: [{ name: "Prototype.html", path: "/tmp/Prototype.html" }],
      position: { x: 320, y: 240 }
    });

    expect(external.runtime).not.toHaveBeenCalled();
    expect(addProjectHtmlFile).toHaveBeenCalledWith(
      { name: "Prototype.html", path: "/tmp/Prototype.html", relativePath: "/tmp/Prototype.html" },
      { x: 100, y: 90 },
      "pointer"
    );
  });

  it("commits a project-tree pointer drag without relying on a browser drop event", () => {
    const file = { name: "spec.md", path: "/repo/spec.md", relativePath: "spec.md" };
    const { handlers, addProjectMarkdownFile } = createHandlers();

    handlers.pointer(file, "markdown", { x: 320, y: 240 }, "move");
    handlers.pointer(file, "markdown", { x: 320, y: 240 }, "drop");

    expect(addProjectMarkdownFile).toHaveBeenCalledWith(file, { x: 100, y: 90 }, "pointer");
  });

  it("does not drop through a floating panel that covers the workspace surface", () => {
    const file = { name: "spec.md", path: "/repo/spec.md", relativePath: "spec.md" };
    const { handlers, addProjectMarkdownFile, setFileDropFeedback } = createHandlers();
    const floatingPanel = {};
    vi.stubGlobal("document", { elementFromPoint: vi.fn(() => floatingPanel) });

    handlers.pointer(file, "markdown", { x: 320, y: 240 }, "move");
    handlers.pointer(file, "markdown", { x: 320, y: 240 }, "drop");

    expect(setFileDropFeedback).toHaveBeenLastCalledWith(null);
    expect(addProjectMarkdownFile).not.toHaveBeenCalled();
  });
});
