import { describe, expect, it } from "vitest";

import {
  CANVAS_DOCUMENT_SCHEMA,
  createBlankCanvasDocument,
  createCanvasCardElement,
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
    const card = createCanvasCardElement([shape], 340, 120, "卡片内容");
    const text = createCanvasTextElement([shape, card], 620, 140, "说明");
    const connector = createCanvasConnectorElement([shape, card, text], { elementId: shape.id }, { elementId: card.id });
    const serialized = serializeCanvasDocument({
      schema: CANVAS_DOCUMENT_SCHEMA,
      version: 1,
      viewport: { x: 10, y: 20, scale: 1.2 },
      elements: [shape, card, text, connector]
    });

    expect(parseCanvasDocument(serialized)).toMatchObject({
      schema: CANVAS_DOCUMENT_SCHEMA,
      version: 1,
      viewport: { x: 10, y: 20, scale: 1.2 },
      elements: [
        { type: "shape", shape: "ellipse", text: "节点" },
        { type: "card", text: "卡片内容", cornerRadius: 32 },
        { type: "text", text: "说明" },
        { type: "connector", markerEnd: "arrow" }
      ]
    });
  });

  it("normalizes card geometry and style fields", () => {
    const document = parseCanvasDocument(
      JSON.stringify({
        schema: CANVAS_DOCUMENT_SCHEMA,
        version: 1,
        viewport: { x: 0, y: 0, scale: 1 },
        elements: [
          {
            id: "card-a",
            type: "card",
            x: "10",
            y: "20",
            width: 4,
            height: 2,
            fill: "",
            stroke: "#123456",
            strokeWidth: -2,
            cornerRadius: "bad",
            text: "A"
          }
        ]
      })
    );

    expect(document.elements[0]).toMatchObject({
      id: "card-a",
      type: "card",
      x: 10,
      y: 20,
      width: 24,
      height: 24,
      stroke: "#123456",
      strokeWidth: 0,
      cornerRadius: 32,
      text: "A"
    });
  });

  it("normalizes invalid or unsupported JSON to a blank document", () => {
    expect(parseCanvasDocument("{}")).toMatchObject({ schema: CANVAS_DOCUMENT_SCHEMA, version: 1 });
    expect(parseCanvasDocument("")).toMatchObject({ schema: CANVAS_DOCUMENT_SCHEMA, version: 1 });
  });

  it("drops legacy document theme metadata", () => {
    const document = parseCanvasDocument(
      JSON.stringify({
        schema: CANVAS_DOCUMENT_SCHEMA,
        version: 1,
        viewport: { x: 0, y: 0, scale: 1 },
        theme: { themeId: "minimal-mono" },
        elements: []
      })
    );
    const serialized = serializeCanvasDocument(document);

    expect((document as { theme?: unknown }).theme).toBeUndefined();
    expect(serialized).not.toContain('"theme"');
  });

  it("generates compact element ids", () => {
    expect(nextCanvasElementId([])).toBe("C1");
    expect(nextCanvasElementId([{ id: "C1" }, { id: "C2" }])).toBe("C3");
  });
});
