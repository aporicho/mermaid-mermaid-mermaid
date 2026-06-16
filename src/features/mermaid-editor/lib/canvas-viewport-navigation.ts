import type { CanvasPoint, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasWheelNavigationInput = {
  viewport: ViewportState;
  pointer: CanvasPoint;
  canvasSize: { width: number; height: number };
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  interactionKind: InteractionState["kind"];
};

export type CanvasWheelNavigationResult =
  | { kind: "pan"; viewport: ViewportState }
  | { kind: "zoom"; viewport: ViewportState }
  | { kind: "ignored" };

export const CANVAS_MIN_SCALE = 0.28;
export const CANVAS_MAX_SCALE = 2.4;

const WHEEL_LINE_DELTA_PX = 16;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_EPSILON = 0.001;

export function resolveWheelNavigation(input: CanvasWheelNavigationInput): CanvasWheelNavigationResult {
  if (input.interactionKind !== "idle") return { kind: "ignored" };

  const deltaX = normalizeWheelDelta(input.deltaX, input.deltaMode, input.canvasSize.width);
  const deltaY = normalizeWheelDelta(input.deltaY, input.deltaMode, input.canvasSize.height);

  if (input.ctrlKey || input.metaKey) {
    if (deltaY === 0) return { kind: "ignored" };

    return {
      kind: "zoom",
      viewport: zoomViewportAtPoint(input.viewport, input.pointer, input.viewport.scale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY))
    };
  }

  const shouldMapShiftToHorizontal = input.shiftKey && Math.abs(deltaX) < WHEEL_DELTA_EPSILON;
  const panDeltaX = shouldMapShiftToHorizontal ? deltaY : deltaX;
  const panDeltaY = shouldMapShiftToHorizontal ? 0 : deltaY;
  if (Math.abs(panDeltaX) < WHEEL_DELTA_EPSILON && Math.abs(panDeltaY) < WHEEL_DELTA_EPSILON) return { kind: "ignored" };

  return {
    kind: "pan",
    viewport: {
      ...input.viewport,
      x: input.viewport.x - panDeltaX,
      y: input.viewport.y - panDeltaY
    }
  };
}

export function zoomViewportAtPoint(viewport: ViewportState, pointer: CanvasPoint, nextScale: number): ViewportState {
  const scale = clampScale(nextScale);
  const worldPoint = {
    x: (pointer.x - viewport.x) / viewport.scale,
    y: (pointer.y - viewport.y) / viewport.scale
  };

  return {
    scale,
    x: pointer.x - worldPoint.x * scale,
    y: pointer.y - worldPoint.y * scale
  };
}

function normalizeWheelDelta(value: number, deltaMode: number, pageSize: number) {
  if (deltaMode === 1) return value * WHEEL_LINE_DELTA_PX;
  if (deltaMode === 2) return value * pageSize;
  return value;
}

function clampScale(value: number) {
  return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, value));
}
