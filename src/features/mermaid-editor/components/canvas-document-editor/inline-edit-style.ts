import { DEFAULT_TEXT_COLOR, PIXI_TEXT_FONT_FAMILY } from "@/features/mermaid-editor/components/canvas-document-editor/constants";
import type {
  CanvasDocumentInlineEdit,
  CanvasDocumentInlineEditStyle,
  Point
} from "@/features/mermaid-editor/components/canvas-document-editor/types";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import { canvasDocumentEndpointPoint } from "@/features/mermaid-editor/lib/canvas-document-rendering";

export function resolveCanvasDocumentInlineEditStyle({
  document,
  inlineEdit,
  screenFromWorld
}: {
  document: CanvasDocument;
  inlineEdit: CanvasDocumentInlineEdit | null;
  screenFromWorld: (point: Point) => Point;
}): CanvasDocumentInlineEditStyle | null {
  if (!inlineEdit) return null;
  const element = document.elements.find((item) => item.id === inlineEdit.id);
  if (!element) return null;
  const scale = Math.max(document.viewport.scale, 0.01);

  if (inlineEdit.type === "item") {
    if (element.type === "shape") {
      const insetX = 12;
      const insetY = 12;
      const screen = screenFromWorld({ x: element.x + insetX, y: element.y + insetY });
      return {
        left: screen.x,
        top: screen.y,
        width: Math.max(1, element.width - insetX * 2) * scale,
        height: Math.max(1, element.height - insetY * 2) * scale,
        fontFamily: PIXI_TEXT_FONT_FAMILY,
        fontSize: 14 * scale,
        lineHeight: Math.round(14 * 1.25 * scale),
        textAlign: "center",
        fontWeight: 400,
        color: DEFAULT_TEXT_COLOR,
        verticalAlign: "middle"
      };
    }

    if (element.type === "card") {
      const insetX = 22;
      const insetY = 22;
      const screen = screenFromWorld({ x: element.x + insetX, y: element.y + insetY });
      return {
        left: screen.x,
        top: screen.y,
        width: Math.max(1, element.width - insetX * 2) * scale,
        height: Math.max(1, element.height - insetY * 2) * scale,
        fontFamily: PIXI_TEXT_FONT_FAMILY,
        fontSize: 16 * scale,
        lineHeight: Math.round(16 * 1.3 * scale),
        textAlign: "left",
        fontWeight: 400,
        color: DEFAULT_TEXT_COLOR,
        verticalAlign: "top"
      };
    }

    if (element.type === "text") {
      const screen = screenFromWorld({ x: element.x, y: element.y });
      return {
        left: screen.x,
        top: screen.y,
        width: Math.max(1, element.width) * scale,
        height: Math.max(1, element.height) * scale,
        fontFamily: PIXI_TEXT_FONT_FAMILY,
        fontSize: element.fontSize * scale,
        lineHeight: Math.round(element.fontSize * 1.25 * scale),
        textAlign: "left",
        fontWeight: 400,
        color: element.fill,
        verticalAlign: "top"
      };
    }

    return null;
  }

  if (element.type !== "connector") return null;
  const elementsById = new Map(document.elements.map((item) => [item.id, item]));
  const from = canvasDocumentEndpointPoint(element.from, elementsById);
  const to = canvasDocumentEndpointPoint(element.to, elementsById);
  const center = screenFromWorld({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 8 });
  const width = 180 * scale;
  const height = 28 * scale;
  return {
    left: center.x - width / 2,
    top: center.y - height / 2,
    width,
    height,
    fontFamily: PIXI_TEXT_FONT_FAMILY,
    fontSize: 12 * scale,
    lineHeight: Math.round(12 * 1.25 * scale),
    textAlign: "center",
    fontWeight: 400,
    color: DEFAULT_TEXT_COLOR,
    verticalAlign: "middle",
    borderRadius: 4 * scale,
    paddingX: 8 * scale
  };
}
