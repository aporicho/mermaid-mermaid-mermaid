import { describe, expect, it } from "vitest";

import {
  CANVAS_MAX_SCALE,
  CANVAS_MIN_SCALE,
  classifyWheelInput,
  createWheelIntentTracker,
  resolveWheelNavigation,
  zoomViewportAtPoint
} from "@/features/mermaid-editor/lib/canvas-viewport-navigation";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

const viewport: ViewportState = { x: 100, y: 80, scale: 1 };
const pointer = { x: 300, y: 220 };
const canvasSize = { width: 1000, height: 700 };

function wheel(overrides: Partial<Parameters<typeof resolveWheelNavigation>[0]> = {}) {
  return resolveWheelNavigation({
    viewport,
    pointer,
    canvasSize,
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    interactionKind: "idle",
    ...overrides
  });
}

function worldAt(screen: { x: number; y: number }, value: ViewportState) {
  return {
    x: (screen.x - value.x) / value.scale,
    y: (screen.y - value.y) / value.scale
  };
}

describe("canvas viewport navigation", () => {
  it("zooms around the pointer from discrete mouse wheel deltas", () => {
    const before = worldAt(pointer, viewport);
    const result = wheel({ deltaY: -120 });

    expect(result.kind).toBe("zoom");
    if (result.kind !== "zoom") return;

    expect(result.viewport.scale).toBeGreaterThan(viewport.scale);
    expect(worldAt(pointer, result.viewport).x).toBeCloseTo(before.x);
    expect(worldAt(pointer, result.viewport).y).toBeCloseTo(before.y);
  });

  it("pans vertically from precision trackpad pixel deltas", () => {
    const result = wheel({ deltaY: 24 });

    expect(result).toEqual({
      kind: "pan",
      viewport: { x: 100, y: 56, scale: 1 }
    });
  });

  it("pans in two dimensions from precision trackpad pixel deltas", () => {
    const result = wheel({ deltaX: 8, deltaY: -12 });

    expect(result).toEqual({
      kind: "pan",
      viewport: { x: 92, y: 92, scale: 1 }
    });
  });

  it("preserves tiny fractional pixel deltas from precision trackpads as panning", () => {
    const result = wheel({ deltaX: 0.004, deltaY: 0.006 });

    expect(result).toEqual({
      kind: "pan",
      viewport: { x: 99.996, y: 79.994, scale: 1 }
    });
  });

  it("pans horizontally from horizontal-only wheel deltas", () => {
    const result = wheel({ deltaX: 24 });

    expect(result).toEqual({
      kind: "pan",
      viewport: { x: 76, y: 80, scale: 1 }
    });
  });

  it("maps shift vertical wheel deltas to horizontal panning", () => {
    const result = wheel({ deltaY: 32, shiftKey: true });

    expect(result).toEqual({
      kind: "pan",
      viewport: { x: 68, y: 80, scale: 1 }
    });
  });

  it("zooms around the pointer with command or control wheel", () => {
    const before = worldAt(pointer, viewport);
    const result = wheel({ deltaY: -120, metaKey: true });

    expect(result.kind).toBe("zoom");
    if (result.kind !== "zoom") return;

    expect(result.viewport.scale).toBeGreaterThan(viewport.scale);
    expect(worldAt(pointer, result.viewport).x).toBeCloseTo(before.x);
    expect(worldAt(pointer, result.viewport).y).toBeCloseTo(before.y);
  });

  it("normalizes line and page wheel delta modes", () => {
    const lineWheel = wheel({ deltaY: 2, deltaMode: 1 });
    expect(lineWheel.kind).toBe("zoom");
    if (lineWheel.kind === "zoom") expect(lineWheel.viewport.scale).toBeLessThan(viewport.scale);

    expect(wheel({ deltaX: 1, deltaMode: 2 })).toEqual({
      kind: "pan",
      viewport: { x: -900, y: 80, scale: 1 }
    });
  });

  it("classifies obvious precision and discrete wheel inputs", () => {
    expect(classifyWheelInput({ deltaX: 0, deltaY: 24, deltaMode: 0 })).toBe("precision");
    expect(classifyWheelInput({ deltaX: 4, deltaY: 120, deltaMode: 0 })).toBe("precision");
    expect(classifyWheelInput({ deltaX: 0, deltaY: 120, deltaMode: 0 })).toBe("discrete");
    expect(classifyWheelInput({ deltaX: 0, deltaY: 2, deltaMode: 1 })).toBe("discrete");
  });

  it("locks wheel intent within a transaction", () => {
    const intentTracker = createWheelIntentTracker();

    expect(wheel({ deltaY: 24, timestamp: 100, intentTracker }).kind).toBe("pan");
    expect(wheel({ deltaY: 120, timestamp: 150, intentTracker }).kind).toBe("pan");
    expect(wheel({ deltaY: 120, timestamp: 400, intentTracker }).kind).toBe("zoom");
  });

  it("clamps zoom scale to supported bounds", () => {
    expect(zoomViewportAtPoint({ ...viewport, scale: 2.3 }, pointer, 100).scale).toBe(CANVAS_MAX_SCALE);
    expect(zoomViewportAtPoint({ ...viewport, scale: 0.3 }, pointer, 0.01).scale).toBe(CANVAS_MIN_SCALE);
  });

  it("ignores wheel navigation during transient canvas interactions", () => {
    expect(wheel({ deltaY: 24, interactionKind: "draggingNodes" })).toEqual({ kind: "ignored" });
    expect(wheel({ deltaY: -24, metaKey: true, interactionKind: "connectingEdge" })).toEqual({ kind: "ignored" });
  });
});
