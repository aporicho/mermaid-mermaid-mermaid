import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasDocumentElementKind = "shape" | "card" | "text" | "image" | "connector";
export type CanvasShapeKind = "rect" | "roundRect" | "ellipse" | "diamond";
export type CanvasConnectorEndpoint =
  | {
      elementId: string;
      anchor?: "center" | "top" | "right" | "bottom" | "left";
    }
  | {
      point: {
        x: number;
        y: number;
      };
    };

export type CanvasDocumentElementBase = {
  id: string;
  type: CanvasDocumentElementKind;
};

export type CanvasShapeElement = CanvasDocumentElementBase & {
  type: "shape";
  shape: CanvasShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text?: string;
};

export type CanvasCardElement = CanvasDocumentElementBase & {
  type: "card";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  text?: string;
};

export type CanvasTextElement = CanvasDocumentElementBase & {
  type: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fill: string;
};

export type CanvasImageElement = CanvasDocumentElementBase & {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  preserveAspectRatio: boolean;
};

export type CanvasConnectorElement = CanvasDocumentElementBase & {
  type: "connector";
  from: CanvasConnectorEndpoint;
  to: CanvasConnectorEndpoint;
  stroke: string;
  strokeWidth: number;
  markerEnd?: "arrow" | "none";
  label?: string;
};

export type CanvasDocumentElement = CanvasShapeElement | CanvasCardElement | CanvasTextElement | CanvasImageElement | CanvasConnectorElement;

export type CanvasDocumentAsset = {
  id: string;
  src: string;
  kind: "image";
};

export type CanvasDocument = {
  schema: "mmm.canvas";
  version: 1;
  viewport: ViewportState;
  elements: CanvasDocumentElement[];
  assets?: CanvasDocumentAsset[];
  theme?: {
    themeId?: string;
  };
};

export const CANVAS_DOCUMENT_SCHEMA = "mmm.canvas";
export const CANVAS_DOCUMENT_VERSION = 1;
export const DEFAULT_CANVAS_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };
const DEFAULT_SHAPE_FILL = "#fbf6ef";
const DEFAULT_CARD_FILL = "#fffdf8";
const DEFAULT_CARD_STROKE = "#d8d3ca";
const DEFAULT_STROKE = "#2f2a25";
const DEFAULT_TEXT_FILL = "#2f2a25";
const DEFAULT_CARD_CORNER_RADIUS = 32;

export function createBlankCanvasDocument(): CanvasDocument {
  return {
    schema: CANVAS_DOCUMENT_SCHEMA,
    version: CANVAS_DOCUMENT_VERSION,
    viewport: DEFAULT_CANVAS_VIEWPORT,
    elements: [
      createCanvasShapeElement([], 120, 120, "rect", "想法"),
      createCanvasTextElement([{ id: "C1" }], 360, 150, "双击对象可以编辑文本")
    ]
  };
}

export function parseCanvasDocument(text: string): CanvasDocument {
  if (!text.trim()) return createBlankCanvasDocument();
  const parsed = JSON.parse(text) as unknown;
  return normalizeCanvasDocument(parsed);
}

export function serializeCanvasDocument(document: CanvasDocument) {
  return `${JSON.stringify(normalizeCanvasDocument(document), null, 2)}\n`;
}

export function normalizeCanvasDocument(value: unknown): CanvasDocument {
  if (!value || typeof value !== "object") return createBlankCanvasDocument();
  const raw = value as Partial<CanvasDocument>;
  if (raw.schema !== CANVAS_DOCUMENT_SCHEMA || raw.version !== CANVAS_DOCUMENT_VERSION) {
    return createBlankCanvasDocument();
  }

  return {
    schema: CANVAS_DOCUMENT_SCHEMA,
    version: CANVAS_DOCUMENT_VERSION,
    viewport: normalizeViewport(raw.viewport),
    elements: Array.isArray(raw.elements) ? raw.elements.map(normalizeElement).filter((item): item is CanvasDocumentElement => Boolean(item)) : [],
    ...(Array.isArray(raw.assets) ? { assets: raw.assets.map(normalizeAsset).filter((item): item is CanvasDocumentAsset => Boolean(item)) } : {}),
    ...(raw.theme && typeof raw.theme === "object" ? { theme: { ...(typeof raw.theme.themeId === "string" ? { themeId: raw.theme.themeId } : {}) } } : {})
  };
}

export function createCanvasShapeElement(existing: Pick<CanvasDocumentElement, "id">[], x: number, y: number, shape: CanvasShapeKind = "rect", text = "新形状"): CanvasShapeElement {
  return {
    id: nextCanvasElementId(existing),
    type: "shape",
    shape,
    x,
    y,
    width: 168,
    height: 96,
    fill: DEFAULT_SHAPE_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 1.5,
    text
  };
}

export function createCanvasCardElement(existing: Pick<CanvasDocumentElement, "id">[], x: number, y: number, text = "卡片"): CanvasCardElement {
  return {
    id: nextCanvasElementId(existing),
    type: "card",
    x,
    y,
    width: 240,
    height: 156,
    fill: DEFAULT_CARD_FILL,
    stroke: DEFAULT_CARD_STROKE,
    strokeWidth: 1.2,
    cornerRadius: DEFAULT_CARD_CORNER_RADIUS,
    text
  };
}

export function createCanvasTextElement(existing: Pick<CanvasDocumentElement, "id">[], x: number, y: number, text = "文本"): CanvasTextElement {
  return {
    id: nextCanvasElementId(existing),
    type: "text",
    x,
    y,
    width: 220,
    height: 72,
    text,
    fontSize: 18,
    fill: DEFAULT_TEXT_FILL
  };
}

export function createCanvasImageElement(existing: Pick<CanvasDocumentElement, "id">[], x: number, y: number, src: string, width = 240, height = 160): CanvasImageElement {
  return {
    id: nextCanvasElementId(existing),
    type: "image",
    x,
    y,
    width,
    height,
    src,
    preserveAspectRatio: true
  };
}

export function createCanvasConnectorElement(
  existing: Pick<CanvasDocumentElement, "id">[],
  from: CanvasConnectorEndpoint,
  to: CanvasConnectorEndpoint
): CanvasConnectorElement {
  return {
    id: nextCanvasElementId(existing),
    type: "connector",
    from,
    to,
    stroke: DEFAULT_STROKE,
    strokeWidth: 1.5,
    markerEnd: "arrow"
  };
}

export function nextCanvasElementId(existing: Pick<CanvasDocumentElement, "id">[]) {
  const used = new Set(existing.map((item) => item.id));
  for (let index = 1; index < Number.MAX_SAFE_INTEGER; index += 1) {
    const id = `C${index}`;
    if (!used.has(id)) return id;
  }
  return `C${Date.now()}`;
}

export function canvasElementFrame(element: CanvasDocumentElement) {
  if (element.type === "connector") {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }

  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height
  };
}

function normalizeElement(value: unknown): CanvasDocumentElement | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CanvasDocumentElement>;
  const id = normalizeId(raw.id);
  if (!id) return null;

  if (raw.type === "shape") {
    return {
      id,
      type: "shape",
      shape: normalizeShape(raw.shape),
      x: normalizeNumber(raw.x, 120),
      y: normalizeNumber(raw.y, 120),
      width: normalizeNumber(raw.width, 168, 24),
      height: normalizeNumber(raw.height, 96, 24),
      fill: normalizeColor(raw.fill, DEFAULT_SHAPE_FILL),
      stroke: normalizeColor(raw.stroke, DEFAULT_STROKE),
      strokeWidth: normalizeNumber(raw.strokeWidth, 1.5, 0),
      ...(typeof raw.text === "string" ? { text: raw.text } : {})
    };
  }

  if (raw.type === "card") {
    return {
      id,
      type: "card",
      x: normalizeNumber(raw.x, 120),
      y: normalizeNumber(raw.y, 120),
      width: normalizeNumber(raw.width, 240, 24),
      height: normalizeNumber(raw.height, 156, 24),
      fill: normalizeColor(raw.fill, DEFAULT_CARD_FILL),
      stroke: normalizeColor(raw.stroke, DEFAULT_CARD_STROKE),
      strokeWidth: normalizeNumber(raw.strokeWidth, 1.2, 0),
      cornerRadius: normalizeNumber(raw.cornerRadius, DEFAULT_CARD_CORNER_RADIUS, 0),
      ...(typeof raw.text === "string" ? { text: raw.text } : {})
    };
  }

  if (raw.type === "text") {
    return {
      id,
      type: "text",
      x: normalizeNumber(raw.x, 120),
      y: normalizeNumber(raw.y, 120),
      width: normalizeNumber(raw.width, 220, 24),
      height: normalizeNumber(raw.height, 72, 24),
      text: typeof raw.text === "string" ? raw.text : "文本",
      fontSize: normalizeNumber(raw.fontSize, 18, 8),
      fill: normalizeColor(raw.fill, DEFAULT_TEXT_FILL)
    };
  }

  if (raw.type === "image") {
    return {
      id,
      type: "image",
      x: normalizeNumber(raw.x, 120),
      y: normalizeNumber(raw.y, 120),
      width: normalizeNumber(raw.width, 240, 24),
      height: normalizeNumber(raw.height, 160, 24),
      src: typeof raw.src === "string" ? raw.src : "",
      preserveAspectRatio: raw.preserveAspectRatio !== false
    };
  }

  if (raw.type === "connector") {
    const from = normalizeEndpoint(raw.from);
    const to = normalizeEndpoint(raw.to);
    if (!from || !to) return null;
    return {
      id,
      type: "connector",
      from,
      to,
      stroke: normalizeColor(raw.stroke, DEFAULT_STROKE),
      strokeWidth: normalizeNumber(raw.strokeWidth, 1.5, 0),
      markerEnd: raw.markerEnd === "none" ? "none" : "arrow",
      ...(typeof raw.label === "string" ? { label: raw.label } : {})
    };
  }

  return null;
}

function normalizeEndpoint(value: unknown): CanvasConnectorEndpoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CanvasConnectorEndpoint>;
  if ("elementId" in raw && typeof raw.elementId === "string" && raw.elementId.trim()) {
    const anchor = "anchor" in raw && isAnchor(raw.anchor) ? raw.anchor : "center";
    return { elementId: raw.elementId.trim(), anchor };
  }
  if ("point" in raw && raw.point && typeof raw.point === "object") {
    const point = raw.point as Partial<{ x: unknown; y: unknown }>;
    return { point: { x: normalizeNumber(point.x, 0), y: normalizeNumber(point.y, 0) } };
  }
  return null;
}

function normalizeAsset(value: unknown): CanvasDocumentAsset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CanvasDocumentAsset>;
  if (typeof raw.id !== "string" || typeof raw.src !== "string") return null;
  return { id: raw.id, src: raw.src, kind: "image" };
}

function normalizeViewport(value: unknown): ViewportState {
  if (!value || typeof value !== "object") return DEFAULT_CANVAS_VIEWPORT;
  const raw = value as Partial<ViewportState>;
  return {
    x: normalizeNumber(raw.x, DEFAULT_CANVAS_VIEWPORT.x),
    y: normalizeNumber(raw.y, DEFAULT_CANVAS_VIEWPORT.y),
    scale: Math.min(3, Math.max(0.2, normalizeNumber(raw.scale, DEFAULT_CANVAS_VIEWPORT.scale, 0.01)))
  };
}

function normalizeId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeShape(value: unknown): CanvasShapeKind {
  if (value === "roundRect" || value === "ellipse" || value === "diamond") return value;
  return "rect";
}

function normalizeNumber(value: unknown, fallback: number, minimum = -Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, number) : fallback;
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isAnchor(value: unknown): value is NonNullable<Extract<CanvasConnectorEndpoint, { elementId: string }>["anchor"]> {
  return value === "center" || value === "top" || value === "right" || value === "bottom" || value === "left";
}
