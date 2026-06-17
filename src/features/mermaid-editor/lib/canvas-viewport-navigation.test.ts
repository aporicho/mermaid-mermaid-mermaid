import { describe, expect, it } from "vitest";

import {
  CANVAS_MAX_SCALE,
  CANVAS_MIN_SCALE,
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
  it("zooms around the pointer from unmodified vertical wheel deltas", () => {
    const before = worldAt(pointer, viewport);
    const result = wheel({ deltaY: -120 });

    expect(result.kind).toBe("zoom");
    if (result.kind !== "zoom") return;

    expect(result.viewport.scale).toBeGreaterThan(viewport.scale);
    expect(worldAt(pointer, result.viewport).x).toBeCloseTo(before.x);
    expect(worldAt(pointer, result.viewport).y).toBeCloseTo(before.y);
  });

  it("preserves tiny vertical pixel deltas from precision trackpads as zoom", () => {
    const before = worldAt(pointer, viewport);
    const result = wheel({ deltaX: 0.004, deltaY: 0.006 });

    expect(result.kind).toBe("zoom");
    if (result.kind !== "zoom") return;

    expect(result.viewport.scale).toBeLessThan(viewport.scale);
    expect(worldAt(pointer, result.viewport).x).toBeCloseTo(before.x);
    expect(worldAt(pointer, result.viewport).y).toBeCloseTo(before.y);
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

  it("clamps zoom scale to supported bounds", () => {
    expect(zoomViewportAtPoint({ ...viewport, scale: 2.3 }, pointer, 100).scale).toBe(CANVAS_MAX_SCALE);
    expect(zoomViewportAtPoint({ ...viewport, scale: 0.3 }, pointer, 0.01).scale).toBe(CANVAS_MIN_SCALE);
  });

  it("ignores wheel navigation during transient canvas interactions", () => {
    expect(wheel({ deltaY: 24, interactionKind: "draggingNodes" })).toEqual({ kind: "ignored" });
    expect(wheel({ deltaY: -24, metaKey: true, interactionKind: "connectingEdge" })).toEqual({ kind: "ignored" });
  });
});
