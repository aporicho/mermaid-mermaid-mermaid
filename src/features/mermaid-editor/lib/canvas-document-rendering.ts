import {
  canvasElementFrame,
  type CanvasConnectorElement,
  type CanvasConnectorEndpoint,
  type CanvasDocument,
  type CanvasDocumentElement
} from "@/features/mermaid-editor/lib/canvas-document";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasDocumentDimensions = {
  width: number;
  height: number;
};

export type CanvasDocumentClientRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasDocumentHitTarget =
  | {
      kind: "element";
      id: string;
    }
  | {
      kind: "resize";
      id: string;
    }
  | {
      kind: "blank";
    };

export type CanvasDocumentWorldBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const CANVAS_DOCUMENT_RENDER_OVERSCAN_PX = 960;
const CONNECTOR_HIT_WIDTH_PX = 14;
const RESIZE_HANDLE_SIZE_PX = 14;

export function canvasDocumentWorldBounds(viewport: ViewportState, dimensions: CanvasDocumentDimensions, overscanPx = CANVAS_DOCUMENT_RENDER_OVERSCAN_PX): CanvasDocumentWorldBounds | null {
  if (dimensions.width <= 0 || dimensions.height <= 0 || viewport.scale <= 0) return null;
  return {
    x: (-overscanPx - viewport.x) / viewport.scale,
    y: (-overscanPx - viewport.y) / viewport.scale,
    width: (dimensions.width + overscanPx * 2) / viewport.scale,
    height: (dimensions.height + overscanPx * 2) / viewport.scale
  };
}

export function canvasDocumentVisibleElements(
  document: CanvasDocument,
  dimensions: CanvasDocumentDimensions,
  selectedIds: string[] = [],
  connectorStartId: string | null = null,
  overscanPx = CANVAS_DOCUMENT_RENDER_OVERSCAN_PX
) {
  const bounds = canvasDocumentWorldBounds(document.viewport, dimensions, overscanPx);
  if (!bounds) return document.elements;

  const selected = new Set(selectedIds);
  const protectedIds = new Set(selectedIds);
  if (connectorStartId) protectedIds.add(connectorStartId);

  for (const element of document.elements) {
    if (element.type !== "connector") continue;
    if (selected.has(element.id) || endpointReferencesSelection(element.from, selected) || endpointReferencesSelection(element.to, selected)) {
      protectedIds.add(element.id);
      addEndpointElementId(protectedIds, element.from);
      addEndpointElementId(protectedIds, element.to);
    }
  }

  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  return document.elements.filter((element) => {
    if (protectedIds.has(element.id)) return true;
    if (element.type === "connector") return connectorIntersectsBounds(element, elementsById, bounds);
    return rectIntersects(canvasElementFrame(element), bounds);
  });
}

export function hitCanvasDocument(
  document: CanvasDocument,
  screen: { x: number; y: number },
  dimensions: CanvasDocumentDimensions,
  selectedIds: string[] = []
): CanvasDocumentHitTarget {
  const world = canvasDocumentScreenToWorld(screen, document.viewport);
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const selectedElements = selectedIds.map((id) => elementsById.get(id)).filter((element): element is CanvasDocumentElement => Boolean(element));
  const selectedSingleElement = selectedElements.length === 1 ? selectedElements[0] : null;

  if (selectedSingleElement && selectedSingleElement.type !== "connector" && hitResizeHandle(screen, selectedSingleElement, document.viewport)) {
    return { kind: "resize", id: selectedSingleElement.id };
  }

  const visibleElements = canvasDocumentVisibleElements(document, dimensions, selectedIds, null, 0);
  for (let index = visibleElements.length - 1; index >= 0; index -= 1) {
    const element = visibleElements[index];
    if (element.type === "connector") {
      if (hitConnector(element, elementsById, world, document.viewport.scale)) return { kind: "element", id: element.id };
      continue;
    }
    const frame = canvasElementFrame(element);
    if (pointInRect(world, frame)) return { kind: "element", id: element.id };
  }

  return { kind: "blank" };
}

export function canvasDocumentScreenToWorld(point: { x: number; y: number }, viewport: ViewportState) {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale
  };
}

export function canvasDocumentClientToScreen(point: { clientX: number; clientY: number }, rect: CanvasDocumentClientRect, dimensions: CanvasDocumentDimensions) {
  if (rect.width <= 0 || rect.height <= 0 || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top
    };
  }

  return {
    x: ((point.clientX - rect.left) / rect.width) * dimensions.width,
    y: ((point.clientY - rect.top) / rect.height) * dimensions.height
  };
}

export function canvasDocumentEndpointPoint(endpoint: CanvasConnectorEndpoint, elements: Map<string, CanvasDocumentElement>) {
  if ("point" in endpoint) return endpoint.point;
  const element = elements.get(endpoint.elementId);
  if (!element || element.type === "connector") return { x: 0, y: 0 };
  const frame = canvasElementFrame(element);
  const anchor = endpoint.anchor || "center";
  if (anchor === "top") return { x: frame.x + frame.width / 2, y: frame.y };
  if (anchor === "right") return { x: frame.x + frame.width, y: frame.y + frame.height / 2 };
  if (anchor === "bottom") return { x: frame.x + frame.width / 2, y: frame.y + frame.height };
  if (anchor === "left") return { x: frame.x, y: frame.y + frame.height / 2 };
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

export function canUseCanvasBitmapText(value: string) {
  return Array.from(value).every((character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
  });
}

export function endpointReferencesSelection(endpoint: CanvasConnectorEndpoint, selected: Set<string>) {
  return "elementId" in endpoint && selected.has(endpoint.elementId);
}

function addEndpointElementId(values: Set<string>, endpoint: CanvasConnectorEndpoint) {
  if ("elementId" in endpoint) values.add(endpoint.elementId);
}

function connectorIntersectsBounds(connector: CanvasConnectorElement, elements: Map<string, CanvasDocumentElement>, bounds: CanvasDocumentWorldBounds) {
  const from = canvasDocumentEndpointPoint(connector.from, elements);
  const to = canvasDocumentEndpointPoint(connector.to, elements);
  const connectorBounds = {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(from.x - to.x),
    height: Math.abs(from.y - to.y)
  };
  return rectIntersects(expandRect(connectorBounds, CONNECTOR_HIT_WIDTH_PX), bounds);
}

function hitResizeHandle(screen: { x: number; y: number }, element: Exclude<CanvasDocumentElement, CanvasConnectorElement>, viewport: ViewportState) {
  const frame = canvasElementFrame(element);
  const right = viewport.x + (frame.x + frame.width) * viewport.scale;
  const bottom = viewport.y + (frame.y + frame.height) * viewport.scale;
  return screen.x >= right - RESIZE_HANDLE_SIZE_PX && screen.x <= right + RESIZE_HANDLE_SIZE_PX && screen.y >= bottom - RESIZE_HANDLE_SIZE_PX && screen.y <= bottom + RESIZE_HANDLE_SIZE_PX;
}

function hitConnector(connector: CanvasConnectorElement, elements: Map<string, CanvasDocumentElement>, point: { x: number; y: number }, scale: number) {
  const from = canvasDocumentEndpointPoint(connector.from, elements);
  const to = canvasDocumentEndpointPoint(connector.to, elements);
  const maxDistance = Math.max(connector.strokeWidth + 4, CONNECTOR_HIT_WIDTH_PX / Math.max(scale, 0.01));
  return distanceToSegment(point, from, to) <= maxDistance;
}

function distanceToSegment(point: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
}

function rectIntersects(rect: CanvasDocumentWorldBounds, bounds: CanvasDocumentWorldBounds) {
  return rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y;
}

function pointInRect(point: { x: number; y: number }, rect: CanvasDocumentWorldBounds) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function expandRect(rect: CanvasDocumentWorldBounds, amount: number) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2
  };
}
