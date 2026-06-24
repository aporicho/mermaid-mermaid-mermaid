import {
  canvasElementFrame,
  type CanvasConnectorElement,
  type CanvasDocument,
  type CanvasDocumentElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasDocumentEndpointPoint,
  type CanvasDocumentHitTarget,
  type CanvasDocumentWorldBounds
} from "@/features/mermaid-editor/lib/canvas-document-rendering";
import {
  standardHasSelection,
  standardSelectionVersionKey,
  type StandardCanvasHitTarget,
  type StandardCanvasSelection
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";

export type CanvasDocumentSelection = StandardCanvasSelection;

export const emptyCanvasDocumentSelection: CanvasDocumentSelection = {
  itemIds: [],
  connectionIds: [],
  groupIds: []
};

export function canvasDocumentSelectionFromIds(ids: string[], document: CanvasDocument): CanvasDocumentSelection {
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const itemIds: string[] = [];
  const connectionIds: string[] = [];

  for (const id of ids) {
    const element = elementsById.get(id);
    if (!element) continue;
    if (element.type === "connector") connectionIds.push(id);
    else itemIds.push(id);
  }

  return {
    itemIds,
    connectionIds,
    groupIds: [],
    primaryId: ids.find((id) => elementsById.has(id))
  };
}

export function canvasDocumentSelectedIds(selection: CanvasDocumentSelection) {
  return [...selection.itemIds, ...selection.connectionIds];
}

export function canvasDocumentHasSelection(selection: CanvasDocumentSelection) {
  return standardHasSelection(selection);
}

export function canvasDocumentSelectionVersionKey(selection: CanvasDocumentSelection) {
  return standardSelectionVersionKey(selection);
}

export function selectCanvasDocumentItem(selection: CanvasDocumentSelection, id: string, additive: boolean): CanvasDocumentSelection {
  if (!additive) return { itemIds: [id], connectionIds: [], groupIds: [], primaryId: id };
  const itemIds = toggleId(selection.itemIds, id);
  return { ...selection, itemIds, primaryId: id };
}

export function selectCanvasDocumentConnection(selection: CanvasDocumentSelection, id: string, additive: boolean): CanvasDocumentSelection {
  if (!additive) return { itemIds: [], connectionIds: [id], groupIds: [], primaryId: id };
  const connectionIds = toggleId(selection.connectionIds, id);
  return { ...selection, connectionIds, primaryId: id };
}

export function standardHitTargetFromCanvasDocumentHit(hit: CanvasDocumentHitTarget, document: CanvasDocument): StandardCanvasHitTarget {
  if (hit.kind === "blank") return { kind: "blank" };
  if (hit.kind === "resize") return { kind: "resizeHandle", itemId: hit.id };

  const element = document.elements.find((item) => item.id === hit.id);
  if (!element) return { kind: "blank" };
  if (element.type === "connector") return { kind: "connection", id: element.id };
  return { kind: "item", id: element.id };
}

export function canvasDocumentMarqueeSelection(document: CanvasDocument, rect: CanvasDocumentWorldBounds): CanvasDocumentSelection {
  const elementsById = new Map(document.elements.map((element) => [element.id, element]));
  const itemIds: string[] = [];
  const connectionIds: string[] = [];

  for (const element of document.elements) {
    if (element.type === "connector") {
      if (connectorIntersectsRect(element, elementsById, rect)) connectionIds.push(element.id);
      continue;
    }
    if (rectIntersects(canvasElementFrame(element), rect)) itemIds.push(element.id);
  }

  return {
    itemIds,
    connectionIds,
    groupIds: [],
    primaryId: itemIds[0] || connectionIds[0]
  };
}

export function isCanvasDocumentItem(element: CanvasDocumentElement | undefined): element is Exclude<CanvasDocumentElement, CanvasConnectorElement> {
  return Boolean(element && element.type !== "connector");
}

function connectorIntersectsRect(connector: CanvasConnectorElement, elements: Map<string, CanvasDocumentElement>, rect: CanvasDocumentWorldBounds) {
  const from = canvasDocumentEndpointPoint(connector.from, elements);
  const to = canvasDocumentEndpointPoint(connector.to, elements);
  return segmentIntersectsRect(from, to, rect) || pointInRect(from, rect) || pointInRect(to, rect);
}

function segmentIntersectsRect(from: { x: number; y: number }, to: { x: number; y: number }, rect: CanvasDocumentWorldBounds) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  return (
    segmentsIntersect(from, to, { x: left, y: top }, { x: right, y: top }) ||
    segmentsIntersect(from, to, { x: right, y: top }, { x: right, y: bottom }) ||
    segmentsIntersect(from, to, { x: right, y: bottom }, { x: left, y: bottom }) ||
    segmentsIntersect(from, to, { x: left, y: bottom }, { x: left, y: top })
  );
}

function segmentsIntersect(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function rectIntersects(rect: CanvasDocumentWorldBounds, bounds: CanvasDocumentWorldBounds) {
  return rect.x < bounds.x + bounds.width && rect.x + rect.width > bounds.x && rect.y < bounds.y + bounds.height && rect.y + rect.height > bounds.y;
}

function pointInRect(point: { x: number; y: number }, rect: CanvasDocumentWorldBounds) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function toggleId(values: string[], id: string) {
  return values.includes(id) ? values.filter((item) => item !== id) : [...values, id];
}
