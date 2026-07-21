import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-konva", () => ({
  Ellipse: () => null,
  Line: () => null,
  Path: () => null,
  Rect: () => null
}));

import { CanvasNodeShape } from "@/features/mermaid-editor/components/konva-canvas/node-shapes";
import {
  CANVAS_VISUAL_TOKENS,
  getNodeVisualState
} from "@/features/mermaid-editor/lib/canvas-visual-state";
import { idleInteraction } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

const visualTokens = {
  ...CANVAS_VISUAL_TOKENS,
  ordinaryNode: {
    ...CANVAS_VISUAL_TOKENS.ordinaryNode,
    radius: 3,
    roundedRadius: 17,
    polygonRadius: 9,
    forkRadius: 1,
    borderStyle: "custom" as const,
    customDash: [5, 2],
    shadow: { color: "#123456", blur: 13, opacity: 0.37, offsetX: 2, offsetY: 6 }
  }
};

const visualState = getNodeVisualState({
  nodeId: "node-a",
  selection: { nodeIds: [], edgeIds: [] },
  hoveredNodeId: null,
  interactionState: idleInteraction,
  visualTokens
});

function renderShape(shape: CanvasNode["shape"]) {
  return CanvasNodeShape({
    node: { id: "node-a", label: "A", x: 0, y: 0, fill: "#ffffff", shape },
    width: 120,
    height: 60,
    strokeWidth: visualState.strokeWidth,
    visualState,
    visualTokens
  }) as ReactElement<Record<string, unknown>>;
}

describe("CanvasNodeShape appearance tokens", () => {
  it("uses independent radii for ordinary, rounded, polygon, and fork shapes", () => {
    expect(renderShape("rect").props.cornerRadius).toBe(3);
    expect(renderShape("rounded").props.cornerRadius).toBe(17);
    expect(renderShape("diam").props.radius).toBe(9);
    expect(renderShape("fork").props.cornerRadius).toBe(1);
  });

  it("forwards border style and complete shadow geometry to the Konva shape", () => {
    expect(renderShape("rect").props).toMatchObject({
      dash: [5, 2],
      strokeEnabled: true,
      shadowColor: "#123456",
      shadowBlur: 13,
      shadowOpacity: 0.37,
      shadowOffsetX: 2,
      shadowOffsetY: 6,
      shadowEnabled: true
    });
  });
});
