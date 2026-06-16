import { describe, expect, it } from "vitest";

import {
  CANVAS_VISUAL_TOKENS,
  getAlignmentGuideVisualState,
  getAnchorVisualState,
  getEdgeVisualState,
  getNodeVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import { idleInteraction, type InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasEdge, Selection } from "@/features/mermaid-editor/lib/editor-types";

const emptySelection: Selection = { nodeIds: [], edgeIds: [] };
const edge: CanvasEdge = {
  id: "edge-a",
  from: "node-a",
  to: "node-b",
  label: "",
  style: "solid"
};

function nodeVisual(overrides: Partial<Parameters<typeof getNodeVisualState>[0]> = {}) {
  return getNodeVisualState({
    nodeId: "node-a",
    selection: emptySelection,
    hoveredNodeId: null,
    interactionState: idleInteraction,
    ...overrides
  });
}

function anchorVisual(overrides: Partial<Parameters<typeof getAnchorVisualState>[0]> = {}) {
  return getAnchorVisualState({
    nodeId: "node-a",
    mode: "select",
    selection: emptySelection,
    hoveredNodeId: null,
    interactionState: idleInteraction,
    ...overrides
  });
}

function edgeVisual(overrides: Partial<Parameters<typeof getEdgeVisualState>[0]> = {}) {
  return getEdgeVisualState({
    edge,
    selection: emptySelection,
    hoveredEdgeId: null,
    interactionState: idleInteraction,
    ...overrides
  });
}

describe("canvas visual state", () => {
  it("prioritizes editing and dragging node states over selection and hover", () => {
    expect(
      nodeVisual({
        selection: { nodeIds: ["node-a"], edgeIds: [] },
        hoveredNodeId: "node-a",
        interactionState: { kind: "editingNodeText", nodeId: "node-a" }
      }).kind
    ).toBe("editing");

    expect(
      nodeVisual({
        selection: { nodeIds: ["node-a"], edgeIds: [] },
        hoveredNodeId: "node-a",
        interactionState: { kind: "draggingNodes", pointerId: 0, nodeId: "node-a", startScreen: { x: 0, y: 0 }, startWorld: { x: 0, y: 0 } }
      }).kind
    ).toBe("dragging");
  });

  it("uses connection target state only for the hovered non-source node", () => {
    const connecting: InteractionState = {
      kind: "connectingEdge",
      pointerId: 0,
      fromNodeId: "node-a",
      startWorld: { x: 0, y: 0 },
      currentWorld: { x: 20, y: 0 }
    };

    expect(nodeVisual({ nodeId: "node-a", hoveredNodeId: "node-a", interactionState: connecting }).kind).toBe("hovered");
    expect(nodeVisual({ nodeId: "node-b", hoveredNodeId: "node-b", interactionState: connecting }).kind).toBe("connectionTarget");
  });

  it("shows anchors in select mode for hover and selection", () => {
    expect(anchorVisual().kind).toBe("hidden");
    expect(anchorVisual({ mode: "connect" }).kind).toBe("hidden");
    expect(anchorVisual({ hoveredNodeId: "node-a" }).kind).toBe("available");
    expect(anchorVisual({ selection: { nodeIds: ["node-a"], edgeIds: [] } }).kind).toBe("available");
  });

  it("keeps anchors hidden in connect mode and while connecting", () => {
    expect(anchorVisual({ mode: "connect", hoveredNodeId: "node-a" }).visible).toBe(false);
    expect(
      anchorVisual({
        mode: "select",
        hoveredNodeId: "node-a",
        interactionState: {
          kind: "connectingEdge",
          pointerId: 0,
          fromNodeId: "node-a",
          startWorld: { x: 0, y: 0 },
          currentWorld: { x: 20, y: 0 }
        }
      }).visible
    ).toBe(false);
  });

  it("hides anchors while editing node text", () => {
    expect(anchorVisual({ mode: "connect", interactionState: { kind: "editingNodeText", nodeId: "node-a" } }).visible).toBe(false);
  });

  it("keeps semantic edge style while applying selected and hover states", () => {
    const selectedDotted = edgeVisual({
      edge: { ...edge, style: "dotted" },
      selection: { nodeIds: [], edgeIds: ["edge-a"] },
      hoveredEdgeId: "edge-a"
    });

    expect(selectedDotted.kind).toBe("selected");
    expect(selectedDotted.dash).toEqual([1, 8]);
    expect(selectedDotted.strokeWidth).toBe(3);
    expect(selectedDotted.stroke).toBe(CANVAS_VISUAL_TOKENS.colors.accent);
  });

  it("uses dashed center guides and solid edge guides", () => {
    expect(getAlignmentGuideVisualState("center").dash).toEqual([6, 5]);
    expect(getAlignmentGuideVisualState("edge").dash).toBeUndefined();
  });
});
