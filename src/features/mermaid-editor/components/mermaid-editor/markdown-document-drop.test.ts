import type { DragEvent, RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { createMarkdownDocumentDropHandlers } from "@/features/mermaid-editor/components/mermaid-editor/markdown-document-drop";
import { beginMarkdownDocumentDrag } from "@/features/mermaid-editor/lib/markdown-document";
import type { MarkdownImageDropController } from "@/features/mermaid-editor/lib/markdown-image-drop";

function createHandlers(addProjectMarkdownFile = vi.fn(), imageDropController?: MarkdownImageDropController) {
  const addProjectHtmlFile = vi.fn();
  const addProjectTextFile = vi.fn();
  const addProjectCsvFile = vi.fn();
  const importProjectImageFileAtWindowPoint = vi.fn();
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
    addProjectTextFile,
    addProjectCsvFile,
    importProjectImageFileAtWindowPoint,
    setStatus: vi.fn(),
    setFileDropFeedback,
    usesRuntimeFileDrops: true,
    projectWorkspace: null,
    imageDropController,
    external
  });
  return { handlers, addProjectMarkdownFile, addProjectHtmlFile, addProjectTextFile, addProjectCsvFile, importProjectImageFileAtWindowPoint, external, setFileDropFeedback, workspaceSurface };
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

  it.each([
    { kind: "html" as const, name: "prototype.html", callback: "addProjectHtmlFile" as const },
    { kind: "text" as const, name: "notes.txt", callback: "addProjectTextFile" as const },
    { kind: "csv" as const, name: "people.csv", callback: "addProjectCsvFile" as const }
  ])("converts a project-tree $kind node drop to canvas coordinates exactly once", ({ kind, name, callback }) => {
    const file = { name, path: `/repo/${name}`, relativePath: name };
    const harness = createHandlers();

    harness.handlers.pointer(file, kind, { x: 320, y: 240 }, "drop");

    expect(harness[callback]).toHaveBeenCalledWith(file, { x: 100, y: 90 }, "pointer");
  });

  it("imports a project-tree image at the pointer's canvas position", () => {
    const file = { name: "cover.png", path: "/repo/cover.png", relativePath: "cover.png" };
    const { handlers, importProjectImageFileAtWindowPoint, setFileDropFeedback } = createHandlers();

    handlers.pointer(file, "image", { x: 320, y: 240 }, "move");
    expect(setFileDropFeedback).toHaveBeenLastCalledWith(expect.objectContaining({
      message: "释放以添加 图片节点",
      tone: "ready"
    }));

    handlers.pointer(file, "image", { x: 320, y: 240 }, "drop");

    expect(importProjectImageFileAtWindowPoint).toHaveBeenCalledWith(file, { x: 320, y: 240 });
  });

  it("routes a project-tree image to the Markdown target before the canvas", () => {
    const file = { name: "cover.png", path: "/repo/cover.png", relativePath: "cover.png" };
    const route = vi.fn(() => ({ handled: true, target: null }));
    const imageDropController = {
      route,
      register: vi.fn(),
      targetAtPoint: vi.fn(),
      clear: vi.fn()
    } as unknown as MarkdownImageDropController;
    const { handlers, importProjectImageFileAtWindowPoint, setFileDropFeedback } = createHandlers(vi.fn(), imageDropController);

    handlers.pointer(file, "image", { x: 320, y: 240 }, "move");
    handlers.pointer(file, "image", { x: 320, y: 240 }, "drop");

    expect(route).toHaveBeenNthCalledWith(1, { imageFile: file, point: { x: 320, y: 240 }, phase: "move" });
    expect(route).toHaveBeenNthCalledWith(2, { imageFile: file, point: { x: 320, y: 240 }, phase: "drop" });
    expect(setFileDropFeedback).toHaveBeenCalledWith(expect.objectContaining({ message: "释放以插入 Markdown 图片", tone: "ready" }));
    expect(importProjectImageFileAtWindowPoint).not.toHaveBeenCalled();
  });

  it("routes an Electron image drop to a Markdown target before the external image workflow", () => {
    const route = vi.fn(() => ({ handled: true, target: null }));
    const imageDropController = {
      route,
      register: vi.fn(),
      targetAtPoint: vi.fn(),
      clear: vi.fn()
    } as unknown as MarkdownImageDropController;
    const { handlers, external } = createHandlers(vi.fn(), imageDropController);

    handlers.runtime({
      type: "drop",
      files: [{ name: "cover.png", path: "/tmp/cover.png" }],
      position: { x: 320, y: 240 }
    });

    expect(route).toHaveBeenCalledWith({
      imageFile: { name: "cover.png", path: "/tmp/cover.png", relativePath: "/tmp/cover.png" },
      point: { x: 320, y: 240 },
      phase: "drop"
    });
    expect(external.runtime).not.toHaveBeenCalled();
  });

  it("leaves a native image file drop inside Markdown to Crepe", () => {
    const { handlers, external, setFileDropFeedback } = createHandlers();
    const event = {
      target: { closest: vi.fn(() => ({})) },
      dataTransfer: { files: [{ name: "cover.png" }], types: ["Files"] },
      preventDefault: vi.fn()
    } as unknown as DragEvent<HTMLElement>;

    handlers.enter(event);
    handlers.over(event);
    handlers.drop(event);

    expect(external.enter).not.toHaveBeenCalled();
    expect(external.over).not.toHaveBeenCalled();
    expect(external.drop).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(setFileDropFeedback).toHaveBeenLastCalledWith(null);
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
