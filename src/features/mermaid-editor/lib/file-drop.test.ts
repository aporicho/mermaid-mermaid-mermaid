import { describe, expect, it } from "vitest";

import { canvasScreenToWorldPoint, classifyFileDrop, windowPointToSurfacePoint } from "@/features/mermaid-editor/lib/file-drop";

describe("file drop helpers", () => {
  it("prioritizes document files over image files", () => {
    const result = classifyFileDrop([
      { path: "C:\\demo\\logo.png" },
      { path: "C:\\demo\\diagram.mmd" }
    ]);

    expect(result).toMatchObject({ kind: "document", documentKind: "mermaid", file: { path: "C:\\demo\\diagram.mmd" } });
  });

  it("detects Markdown document files", () => {
    const result = classifyFileDrop([{ path: "/tmp/notes.md" }]);

    expect(result).toMatchObject({ kind: "document", documentKind: "markdown", file: { path: "/tmp/notes.md" } });
  });

  it("detects canvas document files", () => {
    const result = classifyFileDrop([{ path: "/tmp/board.canvas.json" }]);

    expect(result).toMatchObject({ kind: "document", documentKind: "canvas", file: { path: "/tmp/board.canvas.json" } });
  });

  it("detects image files when no Mermaid file is present", () => {
    const result = classifyFileDrop([{ path: "/tmp/logo.svg" }]);

    expect(result).toMatchObject({ kind: "image", file: { path: "/tmp/logo.svg" } });
  });

  it("converts window drop coordinates to canvas world coordinates", () => {
    const surfacePoint = windowPointToSurfacePoint({ x: 260, y: 180 }, { left: 40, top: 30 });
    const worldPoint = canvasScreenToWorldPoint(surfacePoint, { x: 20, y: 10, scale: 2 });

    expect(surfacePoint).toEqual({ x: 220, y: 150 });
    expect(worldPoint).toEqual({ x: 100, y: 70 });
  });
});
