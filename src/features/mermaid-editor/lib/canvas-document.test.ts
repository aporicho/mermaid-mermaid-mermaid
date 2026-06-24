import { describe, expect, it } from "vitest";

import {
  CANVAS_DOCUMENT_SCHEMA,
  createBlankCanvasDocument,
  createCanvasConnectorElement,
  createCanvasShapeElement,
  createCanvasTextElement,
  nextCanvasElementId,
  parseCanvasDocument,
  serializeCanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";

describe("canvas document", () => {
  it("creates a v1 whiteboard document", () => {
    const document = createBlankCanvasDocument();

    expect(document).toMatchObject({
      schema: CANVAS_DOCUMENT_SCHEMA,
      version: 1,
      viewport: { x: 160, y: 90, scale: 1 }
    });
    expect(document.elements.length).toBeGreaterThan(0);
  });

  it("round-trips supported elements through stable JSON", () => {
    const shape = createCanvasShapeElement([], 100, 120, "ellipse", "节点");
    const text = createCanvasTextElement([shape], 340, 140, "说明");
    const connector = createCanvasConnectorElement([shape, text], { elementId: shape.id }, { elementId: text.id });
    const serialized = serializeCanvasDocument({
      schema: CANVAS_DOCUMENT_SCHEMA,
      version: 1,
      viewport: { x: 10, y: 20, scale: 1.2 },
      elements: [shape, text, connector]
    });

    expect(parseCanvasDocument(serialized)).toMatchObject({
      schema: CANVAS_DOCUMENT_SCHEMA,
      version: 1,
      viewport: { x: 10, y: 20, scale: 1.2 },
      elements: [
        { type: "shape", shape: "ellipse", text: "节点" },
        { type: "text", text: "说明" },
        { type: "connector", markerEnd: "arrow" }
      ]
    });
  });

  it("normalizes invalid or unsupported JSON to a blank document", () => {
    expect(parseCanvasDocument("{}")).toMatchObject({ schema: CANVAS_DOCUMENT_SCHEMA, version: 1 });
    expect(parseCanvasDocument("")).toMatchObject({ schema: CANVAS_DOCUMENT_SCHEMA, version: 1 });
  });

  it("generates compact element ids", () => {
    expect(nextCanvasElementId([])).toBe("C1");
    expect(nextCanvasElementId([{ id: "C1" }, { id: "C2" }])).toBe("C3");
  });
});
