import { describe, expect, it } from "vitest";

import {
  pointerInputFromMoveSnapshot,
  sameInteractionState,
  shouldResolvePointerMove
} from "@/features/mermaid-editor/components/konva-canvas/pointer-interaction-runtime";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import { normalizeModifiers } from "@/features/mermaid-editor/lib/interaction/input";

describe("pointer interaction runtime", () => {
  it("only resolves pointer moves for gestures that consume world-position updates", () => {
    expect(shouldResolvePointerMove({ kind: "idle" })).toBe(false);
    expect(shouldResolvePointerMove({ kind: "editingNodeText", nodeId: "A" })).toBe(false);
    expect(shouldResolvePointerMove({
      kind: "marqueeSelecting",
      pointerId: 0,
      startWorld: { x: 0, y: 0 },
      currentWorld: { x: 20, y: 20 }
    })).toBe(true);
  });

  it("treats equal gesture snapshots as the same state but detects visual movement", () => {
    const left: InteractionState = {
      kind: "connectingEdge",
      pointerId: 0,
      fromId: "A",
      startWorld: { x: 10, y: 10 },
      currentWorld: { x: 20, y: 20 }
    };
    expect(sameInteractionState(left, { ...left })).toBe(true);
    expect(sameInteractionState(left, { ...left, currentWorld: { x: 21, y: 20 } })).toBe(false);
  });

  it("converts the last frame snapshot without changing hit or coordinates", () => {
    const input = pointerInputFromMoveSnapshot({
      hit: { kind: "node", id: "A" },
      pointer: { x: 12, y: 18 },
      world: { x: 120, y: 180 },
      button: 0,
      buttons: 1,
      pointerId: 17,
      pointerType: "pen",
      modifiers: normalizeModifiers({ shiftKey: true }),
      timestamp: 42
    });

    expect(input).toMatchObject({
      phase: "move",
      screen: { x: 12, y: 18 },
      world: { x: 120, y: 180 },
      hit: { kind: "node", id: "A" },
      pointerId: 17,
      pointerType: "pen",
      buttons: 1,
      timestamp: 42
    });
  });
});
