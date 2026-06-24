import { describe, expect, it } from "vitest";

import {
  canvasDocumentMarqueeSelection,
  canvasDocumentSelectedIds,
  canvasDocumentSelectionFromIds,
  selectCanvasDocumentConnection,
  selectCanvasDocumentItem,
  standardHitTargetFromCanvasDocumentHit
} from "@/features/mermaid-editor/lib/canvas-document-interaction";
import { createCanvasConnectorElement, createCanvasShapeElement, createCanvasTextElement, type CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";

function documentWith(elements: CanvasDocument["elements"]): CanvasDocument {
  return {
    schema: "mmm.canvas",
    version: 1,
    viewport: { x: 0, y: 0, scale: 1 },
    elements
  };
}

describe("canvas document interaction adapter", () => {
  it("maps canvas document hit targets to standard hit targets", () => {
    const shape = createCanvasShapeElement([], 20, 20);
    const connector = createCanvasConnectorElement([shape], { elementId: shape.id }, { point: { x: 240, y: 20 } });
    const document = documentWith([shape, connector]);

    expect(standardHitTargetFromCanvasDocumentHit({ kind: "element", id: shape.id }, document)).toEqual({ kind: "item", id: shape.id });
    expect(standardHitTargetFromCanvasDocumentHit({ kind: "element", id: connector.id }, document)).toEqual({ kind: "connection", id: connector.id });
    expect(standardHitTargetFromCanvasDocumentHit({ kind: "resize", id: shape.id }, document)).toEqual({ kind: "resizeHandle", itemId: shape.id });
  });

  it("splits selected ids into item and connection buckets", () => {
    const shape = createCanvasShapeElement([], 20, 20);
    const text = createCanvasTextElement([shape], 220, 20);
    const connector = createCanvasConnectorElement([shape, text], { elementId: shape.id }, { elementId: text.id });
    const selection = canvasDocumentSelectionFromIds([shape.id, connector.id, text.id], documentWith([shape, text, connector]));

    expect(selection).toEqual({
      itemIds: [shape.id, text.id],
      connectionIds: [connector.id],
      groupIds: [],
      primaryId: shape.id
    });
    expect(canvasDocumentSelectedIds(selection)).toEqual([shape.id, text.id, connector.id]);
  });

  it("uses standard additive item and connection selection semantics", () => {
    const itemSelection = selectCanvasDocumentItem({ itemIds: ["A"], connectionIds: [], groupIds: [], primaryId: "A" }, "B", true);
    const connectionSelection = selectCanvasDocumentConnection(itemSelection, "C", true);

    expect(connectionSelection).toEqual({
      itemIds: ["A", "B"],
      connectionIds: ["C"],
      groupIds: [],
      primaryId: "C"
    });
  });

  it("marquee-selects items and connectors in a world rect", () => {
    const a = createCanvasShapeElement([], 20, 20);
    const b = createCanvasTextElement([a], 260, 20);
    const connector = createCanvasConnectorElement([a, b], { elementId: a.id }, { elementId: b.id });
    const selection = canvasDocumentMarqueeSelection(documentWith([a, b, connector]), { x: 0, y: 0, width: 500, height: 160 });

    expect(selection.itemIds).toEqual([a.id, b.id]);
    expect(selection.connectionIds).toEqual([connector.id]);
  });
});
