import { describe, expect, it } from "vitest";

import {
  beginStandardCanvasPointer,
  dispatchStandardCanvasClick,
  dispatchStandardCanvasDoubleClick,
  dispatchStandardCanvasPointerMove,
  dispatchStandardCanvasPointerUp,
  resolveStandardBlankClick,
  standardHasSelection,
  standardSelectionVersionKey,
  type StandardCanvasInteractionState
} from "@/features/mermaid-editor/lib/canvas-interaction-standard";

const viewport = { x: 20, y: 40, scale: 1 };

describe("standard canvas interaction", () => {
  it("uses generic item targets for pending drag state", () => {
    const start = beginStandardCanvasPointer({
      state: { kind: "idle" },
      tool: "select",
      hit: { kind: "item", id: "A" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(start.state).toMatchObject({ kind: "pendingItemPointer", itemId: "A" });
  });

  it("promotes item movement after the shared drag threshold", () => {
    const state: StandardCanvasInteractionState = {
      kind: "pendingItemPointer",
      itemId: "A",
      pointerId: 0,
      startScreen: { x: 100, y: 120 },
      startWorld: { x: 80, y: 80 },
      startedAt: 1000,
      selectionVersion: 1
    };
    const result = dispatchStandardCanvasPointerMove({ state, screen: { x: 108, y: 120 }, world: { x: 88, y: 80 } });

    expect(result.state).toMatchObject({ kind: "draggingItems", itemId: "A" });
    expect(result.commands).toEqual([{ type: "blankClick.invalidate" }, { type: "item.dragStart", itemId: "A" }]);
  });

  it("supports standard resize handles", () => {
    const result = beginStandardCanvasPointer({
      state: { kind: "idle" },
      tool: "select",
      hit: { kind: "resizeHandle", itemId: "A" },
      button: 0,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      viewport
    });

    expect(result.state).toMatchObject({ kind: "resizingItem", itemId: "A", currentWorld: { x: 80, y: 80 } });
  });

  it("uses generic connection targets for selection and editing", () => {
    expect(dispatchStandardCanvasClick({ tool: "select", hit: { kind: "connection", id: "A_B" }, shiftKey: false })).toEqual([
      { type: "blankClick.invalidate" },
      { type: "selection.selectConnection", id: "A_B", additive: false }
    ]);
    expect(dispatchStandardCanvasDoubleClick({ tool: "select", hit: { kind: "connection", id: "A_B" } })).toEqual([
      { type: "blankClick.invalidate" },
      { type: "selection.selectConnection", id: "A_B", additive: false },
      { type: "text.editStart", target: { type: "connection", id: "A_B" } }
    ]);
  });

  it("keeps blank double-click add behavior in the standard layer", () => {
    const state: StandardCanvasInteractionState = {
      kind: "pendingBlankPointer",
      pointerId: 0,
      startScreen: { x: 100, y: 120 },
      startWorld: { x: 80, y: 80 },
      startedAt: 1000,
      selectionVersion: 1
    };
    const first = resolveStandardBlankClick({
      previous: null,
      tool: "select",
      state,
      hasSelection: false,
      screen: { x: 100, y: 120 },
      world: { x: 80, y: 80 },
      now: 1000,
      selectionVersion: 1,
      interactionGeneration: 1
    });

    expect(first.action).toBe("record");
    const second = dispatchStandardCanvasPointerUp({
      state,
      tool: "select",
      hit: { kind: "blank" },
      hasSelection: false,
      screen: { x: 104, y: 123 },
      world: { x: 84, y: 83 },
      now: 1200,
      previousBlankClick: first.action === "record" ? first.intent : null,
      selectionVersion: 1,
      interactionGeneration: 1
    });

    expect(second.commands).toEqual([
      { type: "item.addAt", point: { x: 84, y: 83 } },
      { type: "blankClick.invalidate" },
      { type: "interaction.reset" }
    ]);
  });

  it("normalizes selection version keys across item, connection, and group ids", () => {
    const selection = { itemIds: ["A"], connectionIds: ["A_B"], groupIds: ["G"], primaryId: "A" };

    expect(standardHasSelection(selection)).toBe(true);
    expect(standardSelectionVersionKey(selection)).toBe("A,|,A_B,|,G");
  });
});
