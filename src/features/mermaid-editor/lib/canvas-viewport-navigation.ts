import type { CanvasPoint, InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { StandardCanvasInteractionState } from "@/features/mermaid-editor/lib/canvas-interaction-standard";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasInteractionKind = InteractionState["kind"] | StandardCanvasInteractionState["kind"];

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
  timestamp?: number;
  intentTracker?: WheelIntentTracker;
  interactionKind: CanvasInteractionKind;
};

export type WheelNavigationIntent = "pan" | "zoom";
export type WheelInputSource = "precision" | "discrete" | "unknown";

export type WheelIntentTracker = {
  transaction: {
    intent: WheelNavigationIntent;
    source: WheelInputSource;
    lastEventAt: number;
  } | null;
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
const WHEEL_TRANSACTION_TIMEOUT_MS = 180;
const WHEEL_PIXEL_DISCRETE_DELTA_MIN = 80;
const WHEEL_DISCRETE_PIXEL_STEPS = [100, 120, 125];

export function createWheelIntentTracker(): WheelIntentTracker {
  return { transaction: null };
}

export function resolveWheelNavigation(input: CanvasWheelNavigationInput): CanvasWheelNavigationResult {
  if (input.interactionKind !== "idle") {
    if (input.intentTracker) input.intentTracker.transaction = null;
    return { kind: "ignored" };
  }

  const deltaX = normalizeWheelDelta(input.deltaX, input.deltaMode, input.canvasSize.width);
  const deltaY = normalizeWheelDelta(input.deltaY, input.deltaMode, input.canvasSize.height);

  if (Math.abs(deltaX) < WHEEL_DELTA_EPSILON && Math.abs(deltaY) < WHEEL_DELTA_EPSILON) return { kind: "ignored" };

  const intent = resolveWheelIntent(input, deltaX, deltaY);
  if (intent === "zoom" && Math.abs(deltaY) >= WHEEL_DELTA_EPSILON) {
    return {
      kind: "zoom",
      viewport: zoomViewportAtPoint(input.viewport, input.pointer, input.viewport.scale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY))
    };
  }

  const panDelta = resolvePanDelta(input, deltaX, deltaY);
  if (Math.abs(panDelta.x) < WHEEL_DELTA_EPSILON && Math.abs(panDelta.y) < WHEEL_DELTA_EPSILON) return { kind: "ignored" };

  return {
    kind: "pan",
    viewport: {
      ...input.viewport,
      x: input.viewport.x - panDelta.x,
      y: input.viewport.y - panDelta.y
    }
  };
}

export function classifyWheelInput(input: Pick<CanvasWheelNavigationInput, "deltaMode" | "deltaX" | "deltaY">): WheelInputSource {
  if (input.deltaMode === 1 || input.deltaMode === 2) return "discrete";
  if (input.deltaMode !== 0) return "unknown";

  const absX = Math.abs(input.deltaX);
  const absY = Math.abs(input.deltaY);
  if (absX >= WHEEL_DELTA_EPSILON) return "precision";
  if (hasFractionalDelta(input.deltaX) || hasFractionalDelta(input.deltaY)) return "precision";
  if (absY < WHEEL_PIXEL_DISCRETE_DELTA_MIN) return "precision";
  if (isLikelyDiscretePixelStep(absY)) return "discrete";
  return "unknown";
}

function resolveWheelIntent(input: CanvasWheelNavigationInput, deltaX: number, deltaY: number): WheelNavigationIntent {
  if ((input.ctrlKey || input.metaKey) && Math.abs(deltaY) >= WHEEL_DELTA_EPSILON) {
    rememberWheelIntent(input, "zoom", "unknown");
    return "zoom";
  }

  if (input.shiftKey) {
    rememberWheelIntent(input, "pan", "unknown");
    return "pan";
  }

  const lockedIntent = lockedTransactionIntent(input);
  if (lockedIntent) return lockedIntent;

  const source = classifyWheelInput(input);
  const intent = source === "discrete" && Math.abs(deltaY) >= WHEEL_DELTA_EPSILON && Math.abs(deltaX) < WHEEL_DELTA_EPSILON ? "zoom" : "pan";
  rememberWheelIntent(input, intent, source);
  return intent;
}

function lockedTransactionIntent(input: CanvasWheelNavigationInput): WheelNavigationIntent | null {
  const tracker = input.intentTracker;
  const now = input.timestamp;
  if (!tracker?.transaction || typeof now !== "number" || !Number.isFinite(now)) return null;

  if (now - tracker.transaction.lastEventAt <= WHEEL_TRANSACTION_TIMEOUT_MS) {
    tracker.transaction.lastEventAt = now;
    return tracker.transaction.intent;
  }

  tracker.transaction = null;
  return null;
}

function rememberWheelIntent(input: CanvasWheelNavigationInput, intent: WheelNavigationIntent, source: WheelInputSource) {
  const tracker = input.intentTracker;
  const now = input.timestamp;
  if (!tracker || typeof now !== "number" || !Number.isFinite(now)) return;

  tracker.transaction = { intent, source, lastEventAt: now };
}

function resolvePanDelta(input: CanvasWheelNavigationInput, deltaX: number, deltaY: number) {
  if (input.shiftKey && Math.abs(deltaX) < WHEEL_DELTA_EPSILON) {
    return {
      x: deltaY,
      y: 0
    };
  }

  return {
    x: deltaX,
    y: deltaY
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

function hasFractionalDelta(value: number) {
  return Math.abs(value - Math.round(value)) >= WHEEL_DELTA_EPSILON;
}

function isLikelyDiscretePixelStep(value: number) {
  if (hasFractionalDelta(value)) return false;
  return WHEEL_DISCRETE_PIXEL_STEPS.some((step) => isNearMultiple(value, step));
}

function isNearMultiple(value: number, step: number) {
  const remainder = value % step;
  return remainder <= 1 || step - remainder <= 1;
}

function clampScale(value: number) {
  return Math.min(CANVAS_MAX_SCALE, Math.max(CANVAS_MIN_SCALE, value));
}
