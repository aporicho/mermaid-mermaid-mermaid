import type { CanvasPoint, HitTarget } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasMotionFrame, CanvasProximityScales } from "@/features/mermaid-editor/lib/canvas-motion";
import {
  type EdgeLabelGeometrySpec,
  type EdgeLabelGeometryTokens
} from "@/features/mermaid-editor/lib/edge-label-geometry";
import {
  defaultNodeGeometrySpec,
  type NodeGeometryTokens
} from "@/features/mermaid-editor/lib/node-geometry";

let textMeasureCanvas: HTMLCanvasElement | null = null;

export type SelectionBox = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const PROXIMITY_SCALE_EPSILON = 0.001;

export function measureTextWidth(value: string, tokens: { fontSize: number; fontFamily: string; fontWeight: number }) {
  if (typeof document === "undefined") return value.length * tokens.fontSize * 0.58;

  textMeasureCanvas ??= document.createElement("canvas");
  const context = textMeasureCanvas.getContext("2d");
  if (!context) return value.length * tokens.fontSize * 0.58;

  context.font = `${tokens.fontWeight} ${tokens.fontSize}px ${tokens.fontFamily}`;
  return context.measureText(value).width;
}

export function measureNodeTextWidth(value: string, tokens: NodeGeometryTokens) {
  return measureTextWidth(value, tokens);
}

export function measureEdgeLabelTextWidth(value: string, tokens: EdgeLabelGeometryTokens) {
  return measureTextWidth(value, tokens);
}

export function nodeGeometrySpec(tokens: NodeGeometryTokens) {
  return defaultNodeGeometrySpec((value) => measureNodeTextWidth(value, tokens), tokens);
}

export function edgeLabelGeometrySpec(tokens: EdgeLabelGeometryTokens): EdgeLabelGeometrySpec {
  return {
    minChars: tokens.minChars,
    maxChars: tokens.maxChars,
    paddingX: tokens.paddingX,
    height: tokens.height,
    measureText: (value) => measureEdgeLabelTextWidth(value, tokens)
  };
}

export function normalizeBox(box: SelectionBox) {
  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const width = Math.abs(box.endX - box.startX);
  const height = Math.abs(box.endY - box.startY);
  return { x, y, width, height };
}

export function normalizeProximityScales(scales: CanvasProximityScales): CanvasProximityScales {
  return Object.fromEntries(Object.entries(scales).filter(([, scale]) => Math.abs(scale - 1) > PROXIMITY_SCALE_EPSILON));
}

export function proximityScaleMapsEqual(left: CanvasProximityScales, right: CanvasProximityScales) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Math.abs((left[key] ?? 1) - (right[key] ?? 1)) <= PROXIMITY_SCALE_EPSILON);
}

export function scaleLocalPointFromCenter(point: CanvasPoint, frame: CanvasMotionFrame, scale: number) {
  if (!Number.isFinite(scale) || scale <= 1) return point;

  const center = { x: frame.width / 2, y: frame.height / 2 };
  return {
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale
  };
}

export function scaleLocalRectFromCenter<T extends { x: number; y: number; width: number; height: number }>(rect: T, frame: CanvasMotionFrame, scale: number): T {
  if (!Number.isFinite(scale) || scale <= 1) return rect;

  const origin = scaleLocalPointFromCenter({ x: rect.x, y: rect.y }, frame, scale);
  return {
    ...rect,
    x: origin.x,
    y: origin.y,
    width: rect.width * scale,
    height: rect.height * scale
  };
}

export function isEdgeHitTarget(hit: HitTarget) {
  return hit.kind === "edge" || hit.kind === "edgeLabel" || hit.kind === "edgeEndpoint";
}

export function unique(values: string[]) {
  return Array.from(new Set(values));
}
