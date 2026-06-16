import { describe, expect, it } from "vitest";

import {
  beginCanvasPointer,
  idleInteraction,
  interactionCursor,
  resolveBlankClick,
  updateCanvasPointer,
  type BlankClickIntent,
  type InteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

const viewport: ViewportState = { x: 20, y: 40, scale: 1 };

function pointerDown(overrides: Partial<Parameters<typeof beginCanvasPointer>[0]> = {}) {
  return beginCanvasPointer({
    state: idleInteraction,
    tool: "select",
    hit: { kind: "blank" },
    button: 0,
    screen: { x: 100, y: 120 },
    world: { x: 80, y: 80 },
    now: 1000,
    selectionVersion: 1,
    viewport,
    ...overrides
  });
}

function blankClick(overrides: Partial<Parameters<typeof resolveBlankClick>[0]> = {}) {
  const state: InteractionState = {
    kind: "pendingBlankPointer",
    pointerId: 0,
    startScreen: { x: 100, y: 120 },
    startWorld: { x: 80, y: 80 },
    startedAt: 1000,
    selectionVersion: 1
  };

  return resolveBlankClick({
    previous: null,
    tool: "select",
    state,
    hasSelection: false,
    screen: { x: 100, y: 120 },
    world: { x: 80, y: 80 },
    now: 1000,
    selectionVersion: 1,
    interactionGeneration: 1,
    ...overrides
  });
}

describe("canvas interaction state", () => {
  it("starts pending blank interaction before deciding between click and marquee selection", () => {
    const result = pointerDown();

    expect(result.state.kind).toBe("pendingBlankPointer");
    expect(result.clearBlankClickIntent).toBe(false);
  });

  it("promotes a pending blank pointer to marquee selection only after the drag threshold", () => {
    const start = pointerDown().state;
    const smallMove = updateCanvasPointer({ state: start, screen: { x: 102, y: 122 }, world: { x: 82, y: 82 } });
    const largeMove = updateCanvasPointer({ state: start, screen: { x: 110, y: 130 }, world: { x: 90, y: 90 } });

    expect(smallMove.state.kind).toBe("pendingBlankPointer");
    expect(largeMove.state.kind).toBe("marqueeSelecting");
    expect(largeMove.clearBlankClickIntent).toBe(true);
  });

  it("starts pending node interaction before deciding between click and node drag", () => {
    const start = pointerDown({ hit: { kind: "node", id: "a" } }).state;
    const move = updateCanvasPointer({ state: start, screen: { x: 108, y: 120 }, world: { x: 88, y: 80 } });

    expect(start.kind).toBe("pendingNodePointer");
    expect(move.state.kind).toBe("draggingNodes");
  });

  it("uses temporary panning instead of a persistent pan tool", () => {
    const result = pointerDown({ panningRequested: true });

    expect(result.state).toEqual({
      kind: "panning",
      pointerId: 0,
      startScreen: { x: 100, y: 120 },
      originViewport: viewport
    });
    expect(result.clearBlankClickIntent).toBe(true);
  });

  it("records the first valid blank click and creates on the second valid blank click", () => {
    const first = blankClick();
    expect(first.action).toBe("record");

    const second = blankClick({
      previous: first.action === "record" ? first.intent : null,
      now: 1200,
      screen: { x: 104, y: 123 },
      world: { x: 84, y: 83 }
    });

    expect(second).toEqual({ action: "addNode", intent: null, point: { x: 84, y: 83 } });
  });

  it("consumes a blank click that only clears the current selection", () => {
    const result = blankClick({ hasSelection: true });

    expect(result).toEqual({ action: "clearSelection", intent: null });
  });

  it("invalidates blank double-click intent after selection changes", () => {
    const previous: BlankClickIntent = {
      target: "blank",
      pointerId: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      time: 1000,
      selectionVersion: 1,
      interactionGeneration: 1
    };

    const result = blankClick({ previous, now: 1120, selectionVersion: 2 });

    expect(result.action).toBe("record");
  });

  it("does not add a node from blank clicks split by another interaction generation", () => {
    const previous: BlankClickIntent = {
      target: "blank",
      pointerId: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      time: 1000,
      selectionVersion: 1,
      interactionGeneration: 1
    };

    const result = blankClick({ previous, now: 1120, interactionGeneration: 2 });

    expect(result.action).toBe("record");
  });

  it("derives cursor from tool and transient state", () => {
    expect(interactionCursor("select", idleInteraction, false)).toBe("cursor-default");
    expect(interactionCursor("select", idleInteraction, true)).toBe("cursor-grab");
    expect(interactionCursor("connect", idleInteraction, false)).toBe("cursor-crosshair");
    expect(interactionCursor("select", { kind: "editingNodeText", nodeId: "a" }, false)).toBe("cursor-text");
    expect(interactionCursor("select", { kind: "panning", pointerId: 0, startScreen: { x: 0, y: 0 }, originViewport: viewport }, false)).toBe(
      "cursor-grabbing"
    );
  });
});
