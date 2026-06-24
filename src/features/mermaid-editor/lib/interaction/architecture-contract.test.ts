import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("interaction architecture contract", () => {
  it("keeps canvas viewport navigation behind standard input and intent resolution", () => {
    const canvas = readProjectFile("src/features/mermaid-editor/components/konva-canvas.tsx");

    expect(canvas).toContain("createStandardWheelInput");
    expect(canvas).toContain("createStandardGestureInput");
    expect(canvas).toContain("resolveInteractionIntent");
    expect(canvas).toContain("commandFromInteractionIntent");
    expect(canvas).not.toContain("resolveWheelNavigation");
    expect(canvas).not.toContain("zoomViewportAtPoint");
    expect(canvas).not.toContain("onViewportChange");
  });

  it("keeps render-view navigation on the same standard intent path", () => {
    const preview = readProjectFile("src/features/mermaid-editor/components/preview-panel.tsx");

    expect(preview).toContain("createStandardWheelInput");
    expect(preview).toContain("createStandardGestureInput");
    expect(preview).toContain("resolveInteractionIntent");
    expect(preview).toContain("commandFromInteractionIntent");
    expect(preview).not.toContain("resolveWheelNavigation");
    expect(preview).not.toContain("zoomViewportAtPoint");
  });

  it("keeps canvas document interactions on the standard canvas path", () => {
    const canvasDocumentEditor = readProjectFile("src/features/mermaid-editor/components/canvas-document-editor.tsx");

    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerDown");
    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerMove");
    expect(canvasDocumentEditor).toContain("dispatchStandardCanvasPointerUp");
    expect(canvasDocumentEditor).toContain("createStandardWheelInput");
    expect(canvasDocumentEditor).toContain("resolveInteractionIntent");
    expect(canvasDocumentEditor).toContain("commandFromInteractionIntent");
    expect(canvasDocumentEditor).not.toContain("resolveWheelNavigation");
    expect(canvasDocumentEditor).not.toContain("zoomViewportAtPoint");
  });

  it("keeps Mermaid canvas interaction as a standard adapter", () => {
    const canvasInteraction = readProjectFile("src/features/mermaid-editor/lib/canvas-interaction.ts");

    expect(canvasInteraction).toContain("beginStandardCanvasPointer");
    expect(canvasInteraction).toContain("dispatchStandardCanvasPointerDown");
    expect(canvasInteraction).toContain("toStandardHitTarget");
    expect(canvasInteraction).toContain("fromStandardCommand");
  });
});
