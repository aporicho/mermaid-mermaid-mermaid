import { describe, expect, it } from "vitest";

import {
  beginCanvasPointer,
  dispatchCanvasClick,
  dispatchCanvasDoubleClick,
  dispatchCanvasPointerDown,
  dispatchCanvasPointerMove,
  dispatchCanvasPointerUp,
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

  it("uses right mouse drag as temporary panning", () => {
    const result = pointerDown({ button: 2, hit: { kind: "node", id: "a" } });

    expect(result.state.kind).toBe("panning");
    expect(result.clearBlankClickIntent).toBe(true);
  });

  it("uses panning buttons before target-specific node behavior in unified dispatch", () => {
    const result = dispatchCanvasPointerDown({
      state: idleInteraction,
      tool: "select",
      hit: { kind: "node", id: "a" },
      button: 1,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(result.state.kind).toBe("panning");
    expect(result.commands).toEqual([{ type: "invalidateBlankClick" }]);
  });

  it("starts connections from node anchors in select mode and node bodies in connect mode", () => {
    const selectResult = dispatchCanvasPointerDown({
      state: idleInteraction,
      tool: "select",
      hit: { kind: "nodeAnchor", nodeId: "a", anchor: "right" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });
    const connectResult = dispatchCanvasPointerDown({
      state: idleInteraction,
      tool: "connect",
      hit: { kind: "node", id: "a" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(selectResult.state).toMatchObject({ kind: "connectingEdge", fromNodeId: "a", startWorld: { x: 80, y: 80 } });
    expect(connectResult.state).toMatchObject({ kind: "connectingEdge", fromNodeId: "a", startWorld: { x: 80, y: 80 } });
  });

  it("starts edge endpoint retargeting from selected edge endpoint handles", () => {
    const result = dispatchCanvasPointerDown({
      state: idleInteraction,
      tool: "select",
      hit: { kind: "edgeEndpoint", edgeId: "a-->b", side: "to" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(result.state).toEqual({
      kind: "retargetingEdge",
      pointerId: 0,
      edgeId: "a-->b",
      side: "to",
      currentWorld: { x: 80, y: 80 }
    });
  });

  it("updates edge endpoint retargeting coordinates while dragging", () => {
    const result = updateCanvasPointer({
      state: { kind: "retargetingEdge", pointerId: 0, edgeId: "a-->b", side: "from", currentWorld: { x: 80, y: 80 } },
      screen: { x: 140, y: 150 },
      world: { x: 120, y: 110 }
    });

    expect(result.state).toEqual({
      kind: "retargetingEdge",
      pointerId: 0,
      edgeId: "a-->b",
      side: "from",
      currentWorld: { x: 120, y: 110 }
    });
  });

  it("keeps select mode node body interactions as pending selection or drag", () => {
    const result = dispatchCanvasPointerDown({
      state: idleInteraction,
      tool: "select",
      hit: { kind: "node", id: "a" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(result.state).toMatchObject({ kind: "pendingNodePointer", nodeId: "a" });
  });

  it("emits a start node drag command when pointer movement crosses the threshold", () => {
    const start = pointerDown({ hit: { kind: "node", id: "a" } }).state;
    const result = dispatchCanvasPointerMove({ state: start, screen: { x: 108, y: 120 }, world: { x: 88, y: 80 } });

    expect(result.state.kind).toBe("draggingNodes");
    expect(result.commands).toEqual([{ type: "invalidateBlankClick" }, { type: "startNodeDrag", nodeId: "a" }]);
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

  it("resolves pending blank pointer up into clear selection or add node commands", () => {
    const state = pointerDown().state as Extract<InteractionState, { kind: "pendingBlankPointer" }>;
    const clear = dispatchCanvasPointerUp({
      state,
      tool: "select",
      hit: { kind: "blank" },
      hasSelection: true,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      previousBlankClick: null,
      selectionVersion: 1,
      interactionGeneration: 1
    });
    const add = dispatchCanvasPointerUp({
      state,
      tool: "select",
      hit: { kind: "blank" },
      hasSelection: false,
      screen: { x: 104, y: 123 },
      world: { x: 84, y: 83 },
      now: 1200,
      previousBlankClick: {
        target: "blank",
        pointerId: 0,
        screen: { x: 100, y: 120 },
        world: { x: 80, y: 80 },
        time: 1000,
        selectionVersion: 1,
        interactionGeneration: 1
      },
      selectionVersion: 1,
      interactionGeneration: 1
    });

    expect(clear.commands).toEqual([{ type: "clearSelection" }, { type: "resetInteraction" }]);
    expect(add.commands).toEqual([{ type: "addNodeAt", point: { x: 84, y: 83 } }, { type: "invalidateBlankClick" }, { type: "resetInteraction" }]);
  });

  it("does not treat a blank pointer released over a node as a blank double-click", () => {
    const state = pointerDown().state as Extract<InteractionState, { kind: "pendingBlankPointer" }>;
    const result = dispatchCanvasPointerUp({
      state,
      tool: "select",
      hit: { kind: "node", id: "a" },
      hasSelection: false,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      previousBlankClick: null,
      selectionVersion: 1,
      interactionGeneration: 1
    });

    expect(result.commands).toEqual([{ type: "resetInteraction" }]);
  });

  it("commits edge retargeting from the pointer-up world position", () => {
    const result = dispatchCanvasPointerUp({
      state: { kind: "retargetingEdge", pointerId: 0, edgeId: "a-->b", side: "to", currentWorld: { x: 120, y: 110 } },
      tool: "select",
      hit: { kind: "node", id: "c" },
      hasSelection: true,
      screen: { x: 145, y: 150 },
      world: { x: 125, y: 110 },
      now: 1200,
      previousBlankClick: null,
      selectionVersion: 1,
      interactionGeneration: 1
    });

    expect(result.commands).toEqual([
      { type: "retargetEdge", edgeId: "a-->b", side: "to", point: { x: 125, y: 110 } },
      { type: "invalidateBlankClick" },
      { type: "resetInteraction" }
    ]);
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
    expect(interactionCursor("select", idleInteraction, false, { kind: "nodeAnchor", nodeId: "a", anchor: "right" })).toBe("cursor-crosshair");
    expect(interactionCursor("select", idleInteraction, false, { kind: "edgeEndpoint", edgeId: "a-->b", side: "to" })).toBe("cursor-crosshair");
    expect(interactionCursor("select", { kind: "editingNodeText", nodeId: "a" }, false)).toBe("cursor-text");
    expect(interactionCursor("select", { kind: "panning", pointerId: 0, startScreen: { x: 0, y: 0 }, originViewport: viewport }, false)).toBe(
      "cursor-grabbing"
    );
  });

  it("emits selection commands from click dispatch", () => {
    expect(dispatchCanvasClick({ tool: "select", hit: { kind: "node", id: "a" }, shiftKey: false })).toEqual([
      { type: "invalidateBlankClick" },
      { type: "selectNode", id: "a", additive: false }
    ]);
    expect(dispatchCanvasClick({ tool: "select", hit: { kind: "edgeLabel", id: "a-->b" }, shiftKey: true })).toEqual([
      { type: "invalidateBlankClick" },
      { type: "selectEdge", id: "a-->b", additive: true }
    ]);
  });

  it("emits edit commands from double-click dispatch", () => {
    expect(dispatchCanvasDoubleClick({ tool: "select", hit: { kind: "nodeAnchor", nodeId: "a", anchor: "right" } })).toEqual([
      { type: "invalidateBlankClick" },
      { type: "selectNode", id: "a", additive: false },
      { type: "startInlineEdit", target: { type: "node", id: "a" } }
    ]);
    expect(dispatchCanvasDoubleClick({ tool: "select", hit: { kind: "edge", id: "a-->b" } })).toEqual([
      { type: "invalidateBlankClick" },
      { type: "selectEdge", id: "a-->b", additive: false },
      { type: "startInlineEdit", target: { type: "edge", id: "a-->b" } }
    ]);
  });
});
