import { describe, expect, it } from "vitest";

import { createCanvasConnectorElement, createCanvasShapeElement, createCanvasTextElement, type CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import {
  canUseCanvasBitmapText,
  canvasDocumentEndpointPoint,
  canvasDocumentVisibleElements,
  canvasDocumentWorldBounds,
  hitCanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document-rendering";

function testDocument(elements: CanvasDocument["elements"]): CanvasDocument {
  return {
    schema: "mmm.canvas",
    version: 1,
    viewport: { x: 0, y: 0, scale: 1 },
    elements
  };
}

describe("canvas document rendering helpers", () => {
  it("resolves viewport world bounds with overscan", () => {
    expect(canvasDocumentWorldBounds({ x: 100, y: 60, scale: 2 }, { width: 400, height: 200 }, 20)).toEqual({
      x: -60,
      y: -40,
      width: 220,
      height: 120
    });
  });

  it("culls offscreen elements while keeping selected elements", () => {
    const visible = createCanvasShapeElement([], 20, 20, "rect", "visible");
    const offscreen = createCanvasShapeElement([visible], 5000, 5000, "rect", "offscreen");
    const document = testDocument([visible, offscreen]);

    expect(canvasDocumentVisibleElements(document, { width: 300, height: 200 }, [], null, 0).map((element) => element.id)).toEqual([visible.id]);
    expect(canvasDocumentVisibleElements(document, { width: 300, height: 200 }, [offscreen.id], null, 0).map((element) => element.id)).toEqual([visible.id, offscreen.id]);
  });

  it("hits resize handles before object bodies", () => {
    const shape = createCanvasShapeElement([], 20, 20);
    const document = testDocument([shape]);

    expect(hitCanvasDocument(document, { x: 188, y: 116 }, { width: 300, height: 200 }, [shape.id])).toEqual({ kind: "resize", id: shape.id });
  });

  it("hits connectors by distance to segment", () => {
    const a = createCanvasShapeElement([], 0, 0);
    const b = createCanvasTextElement([a], 240, 0);
    const connector = createCanvasConnectorElement([a, b], { elementId: a.id }, { elementId: b.id });
    const document = testDocument([a, b, connector]);

    expect(hitCanvasDocument(document, { x: 200, y: 48 }, { width: 500, height: 240 }, [])).toEqual({ kind: "element", id: connector.id });
  });

  it("resolves connector endpoint anchors", () => {
    const shape = createCanvasShapeElement([], 20, 30);
    const elements = new Map([[shape.id, shape] as const]);

    expect(canvasDocumentEndpointPoint({ elementId: shape.id, anchor: "right" }, elements)).toEqual({ x: 188, y: 78 });
  });

  it("uses bitmap text only for basic latin content", () => {
    expect(canUseCanvasBitmapText("Hello 123")).toBe(true);
    expect(canUseCanvasBitmapText("想法")).toBe(false);
  });
});
