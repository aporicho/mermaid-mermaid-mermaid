import { describe, expect, it } from "vitest";

import {
  CANVAS_VISUAL_TOKENS,
  canvasStrokeDash,
  getAlignmentGuideVisualState,
  getAnchorVisualState,
  getConnectionDraftVisualState,
  getEdgeEndpointVisualState,
  getEdgeVisualState,
  getGroupVisualState,
  getNodeVisualState,
  resolveCanvasNodeFill,
  resolveCanvasNodeTextFill
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
      fromId: "node-a",
      startWorld: { x: 0, y: 0 },
      currentWorld: { x: 20, y: 0 }
    };

    expect(nodeVisual({ nodeId: "node-a", hoveredNodeId: "node-a", interactionState: connecting }).kind).toBe("hovered");
    expect(nodeVisual({ nodeId: "node-b", hoveredNodeId: "node-b", interactionState: connecting }).kind).toBe("connectionTarget");
  });

  it("uses explicit connection preview node states before selection and hover", () => {
    expect(
      nodeVisual({
        selection: { nodeIds: ["node-a"], edgeIds: [] },
        hoveredNodeId: "node-a",
        connectionTargetNodeId: "node-a"
      }).kind
    ).toBe("connectionTarget");

    expect(
      nodeVisual({
        selection: { nodeIds: ["node-a"], edgeIds: [] },
        hoveredNodeId: "node-a",
        connectionInvalidNodeId: "node-a"
      }).kind
    ).toBe("connectionInvalid");
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
          fromId: "node-a",
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
    expect(selectedDotted.stroke).toBe(CANVAS_VISUAL_TOKENS.edge.selectedColor);
  });

  it("uses valid and invalid connection preview visual states while preserving edge style", () => {
    expect(getConnectionDraftVisualState({ valid: true }).stroke).toBe(CANVAS_VISUAL_TOKENS.overlay.connectionDraft.validColor);
    expect(getConnectionDraftVisualState({ valid: false }).opacity).toBeLessThan(1);

    const dottedPreview = getConnectionDraftVisualState({ valid: true, edge: { ...edge, style: "dotted" } });
    expect(dottedPreview.dash).toEqual([1, 8]);
    expect(dottedPreview.strokeWidth).toBe(2);
  });

  it("uses separate invalid colors and opacity for new and retargeted connections", () => {
    const visualTokens = {
      ...CANVAS_VISUAL_TOKENS,
      edge: { ...CANVAS_VISUAL_TOKENS.edge, invalidColor: "#111111", invalidPreviewOpacity: 0.23 },
      overlay: {
        ...CANVAS_VISUAL_TOKENS.overlay,
        connectionDraft: { ...CANVAS_VISUAL_TOKENS.overlay.connectionDraft, invalidColor: "#222222", invalidOpacity: 0.41 }
      }
    };

    expect(getConnectionDraftVisualState({ valid: false, visualTokens })).toMatchObject({ stroke: "#222222", opacity: 0.41 });
    expect(getConnectionDraftVisualState({ valid: false, edge, visualTokens })).toMatchObject({ stroke: "#111111", opacity: 0.23 });
  });

  it("derives endpoint handle visual states", () => {
    expect(getEdgeEndpointVisualState().kind).toBe("normal");
    expect(getEdgeEndpointVisualState({ hovered: true }).fill).toBe(CANVAS_VISUAL_TOKENS.overlay.anchor.hoverColor);
    expect(getEdgeEndpointVisualState({ active: true }).fill).toBe(CANVAS_VISUAL_TOKENS.overlay.anchor.targetColor);
  });

  it("uses dashed center guides and solid edge guides", () => {
    expect(getAlignmentGuideVisualState("center").dash).toEqual([8, 6]);
    expect(getAlignmentGuideVisualState("edge").dash).toBeUndefined();
  });

  it("applies the theme saturation to document node fills", () => {
    const grayscaleTokens = {
      ...CANVAS_VISUAL_TOKENS,
      ordinaryNode: { ...CANVAS_VISUAL_TOKENS.ordinaryNode, fillSaturation: 0 }
    };

    expect(resolveCanvasNodeFill("#ff4050", grayscaleTokens)).toBe("#6a6a6a");
    expect(resolveCanvasNodeFill("#abc", grayscaleTokens)).toBe("#b9b9b9");
    expect(resolveCanvasNodeFill("rgb(255, 64, 80)", grayscaleTokens)).toBe("rgb(255, 64, 80)");
    expect(resolveCanvasNodeFill("#ff4050")).toBe("#ff4050");
  });

  it("quantizes node fills to pure black and white with readable text", () => {
    const binaryTokens = {
      ...CANVAS_VISUAL_TOKENS,
      surface: { ...CANVAS_VISUAL_TOKENS.surface, background: "#ffffff" },
      ordinaryNode: { ...CANVAS_VISUAL_TOKENS.ordinaryNode, textColor: "#000000", fillSaturation: 0, fillLuminanceSteps: 2 }
    };

    expect(resolveCanvasNodeFill("#ff4050", binaryTokens)).toBe("#000000");
    expect(resolveCanvasNodeFill("#abc", binaryTokens)).toBe("#ffffff");
    expect(resolveCanvasNodeTextFill("#ff4050", "#000000", binaryTokens)).toBe("#ffffff");
    expect(resolveCanvasNodeTextFill("#abc", "#000000", binaryTokens)).toBe("#000000");
  });

  it("uses independent node borders and drag shadows without hard-coded state values", () => {
    const visualTokens = {
      ...CANVAS_VISUAL_TOKENS,
      ordinaryNode: {
        ...CANVAS_VISUAL_TOKENS.ordinaryNode,
        selectedBorderColor: "#123456",
        emphasizedBorderWidth: 7,
        borderStyle: "custom" as const,
        customDash: [3, 2],
        dragShadow: { color: "#654321", blur: 19, opacity: 0.61, offsetX: 4, offsetY: 8 }
      }
    };
    const dragging = nodeVisual({
      selection: { nodeIds: ["node-a"], edgeIds: [] },
      interactionState: { kind: "draggingNodes", pointerId: 0, nodeId: "node-a", startScreen: { x: 0, y: 0 }, startWorld: { x: 0, y: 0 } },
      visualTokens
    });

    expect(dragging).toMatchObject({ stroke: "#123456", strokeWidth: 7, dash: [3, 2], shadow: visualTokens.ordinaryNode.dragShadow });
  });

  it("keeps group appearance independent from nodes", () => {
    const visualTokens = {
      ...CANVAS_VISUAL_TOKENS,
      group: {
        ...CANVAS_VISUAL_TOKENS.group,
        background: "#102030",
        selectedBorderColor: "#405060",
        emphasizedBorderWidth: 5,
        borderStyle: "dash-dot" as const,
        radius: 27
      }
    };

    expect(getGroupVisualState({ selected: true, visualTokens })).toMatchObject({
      fill: "#102030",
      stroke: "#405060",
      strokeWidth: 5,
      dash: [8, 5, 1, 5]
    });
    expect(visualTokens.group.radius).not.toBe(visualTokens.ordinaryNode.radius);
  });

  it("maps every canvas stroke preset deterministically", () => {
    expect(canvasStrokeDash("solid", [4, 2])).toBeUndefined();
    expect(canvasStrokeDash("dashed", [])).toEqual([8, 6]);
    expect(canvasStrokeDash("dotted", [])).toEqual([1, 6]);
    expect(canvasStrokeDash("dash-dot", [])).toEqual([8, 5, 1, 5]);
    expect(canvasStrokeDash("custom", [4, 2])).toEqual([4, 2]);
  });
});
