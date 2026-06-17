import { describe, expect, it } from "vitest";

import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_VIEW_FILTERS } from "@/features/mermaid-editor/lib/view-filters";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { commandFromInteractionIntent } from "@/features/mermaid-editor/lib/interaction/commands";
import { createStandardGestureInput, createStandardWheelInput } from "@/features/mermaid-editor/lib/interaction/input";
import { resolveInteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";

const graph: MermaidGraph = {
  direction: "LR",
  nodes: [{ id: "A", label: "A", x: 100, y: 100, fill: "#fff" }],
  edges: [],
  subgraphs: []
};
const viewport = { x: 100, y: 80, scale: 1 };
const pointer = { x: 300, y: 220 };
const canvasSize = { width: 1000, height: 700 };
const context = buildInteractionContext({
  graph,
  selection: { nodeIds: [], edgeIds: [], subgraphIds: [] },
  viewport,
  viewFilters: DEFAULT_VIEW_FILTERS,
  canvasSize
});

function wheel(overrides: Partial<Parameters<typeof createStandardWheelInput>[0]> = {}) {
  return createStandardWheelInput({
    pointer,
    canvasSize,
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    interactionKind: "idle",
    ...overrides
  });
}

function gesture(overrides: Partial<Parameters<typeof createStandardGestureInput>[0]> = {}) {
  return createStandardGestureInput({
    phase: "change",
    pointer,
    canvasSize,
    scale: 1.25,
    interactionKind: "idle",
    ...overrides
  });
}

describe("interaction intent", () => {
  it("turns precision wheel input into a pan view command", () => {
    const intent = resolveInteractionIntent(wheel({ deltaY: 24 }), context);
    const command = commandFromInteractionIntent(intent);

    expect(intent).toMatchObject({ kind: "view", action: "pan", inputSource: "precision" });
    expect(command).toEqual({ type: "viewport.set", viewport: { x: 100, y: 56, scale: 1 }, source: "wheel" });
  });

  it("turns discrete wheel input into a zoom view command", () => {
    const intent = resolveInteractionIntent(wheel({ deltaY: -120 }), context);
    const command = commandFromInteractionIntent(intent);

    expect(intent).toMatchObject({ kind: "view", action: "zoom", inputSource: "discrete" });
    expect(command?.type).toBe("viewport.set");
    if (command?.type === "viewport.set") expect(command.viewport.scale).toBeGreaterThan(1);
  });

  it("ignores wheel input during active gestures", () => {
    const intent = resolveInteractionIntent(wheel({ deltaY: 24, interactionKind: "draggingNodes" }), context);

    expect(intent).toEqual({ kind: "view", action: "ignored", reason: "active-gesture", source: "wheel" });
    expect(commandFromInteractionIntent(intent)).toBeNull();
  });

  it("turns Safari gesture changes into zoom view commands", () => {
    const intent = resolveInteractionIntent(gesture(), context);
    const command = commandFromInteractionIntent(intent);

    expect(intent).toMatchObject({ kind: "view", action: "zoom", source: "gesture" });
    expect(command?.type).toBe("viewport.set");
    if (command?.type === "viewport.set") {
      expect(command.source).toBe("gesture");
      expect(command.viewport.scale).toBe(1.25);
      expect(command.viewport.x).toBe(50);
      expect(command.viewport.y).toBe(45);
    }
  });

  it("ignores gesture zoom during active canvas interactions", () => {
    const intent = resolveInteractionIntent(gesture({ interactionKind: "connectingEdge" }), context);

    expect(intent).toEqual({ kind: "view", action: "ignored", reason: "active-gesture", source: "gesture" });
    expect(commandFromInteractionIntent(intent)).toBeNull();
  });
});
