import { describe, expect, it } from "vitest";

import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import { resolveCanvasMotionChanges, snapshotCanvasNodes } from "@/features/mermaid-editor/lib/canvas-motion";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";

const emptySelection: Selection = { nodeIds: [], edgeIds: [], subgraphIds: [] };

function graph(nodes: MermaidGraph["nodes"]): MermaidGraph {
  return {
    direction: "LR",
    nodes,
    edges: []
  };
}

describe("canvas motion", () => {
  it("detects created, moved, removed and newly selected items", () => {
    const previous = graph([
      { id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" },
      { id: "B", label: "B", x: 100, y: 0, fill: "#ffffff" }
    ]);
    const current = graph([
      { id: "A", label: "A", x: 24, y: 0, fill: "#ffffff" },
      { id: "C", label: "C", x: 200, y: 0, fill: "#ffffff" }
    ]);
    const selection: Selection = { nodeIds: ["A"], edgeIds: ["A_C"], subgraphIds: [] };

    const changes = resolveCanvasMotionChanges({
      previousNodes: snapshotCanvasNodes(previous),
      graph: current,
      previousSelection: emptySelection,
      selection,
      motion: resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION),
      interactionKind: "idle"
    });

    expect(changes.createdNodeIds).toEqual(["C"]);
    expect(changes.movedNodeIds).toEqual(["A"]);
    expect(changes.removedNodeIds).toEqual(["B"]);
    expect(changes.highlightedNodeIds).toEqual(["A"]);
    expect(changes.highlightedEdgeIds).toEqual(["A_C"]);
    expect(changes.animateLayout).toBe(true);
  });

  it("skips layout animation while dragging", () => {
    const previous = graph([{ id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" }]);
    const current = graph([{ id: "A", label: "A", x: 80, y: 0, fill: "#ffffff" }]);

    const changes = resolveCanvasMotionChanges({
      previousNodes: snapshotCanvasNodes(previous),
      graph: current,
      previousSelection: emptySelection,
      selection: emptySelection,
      motion: resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION),
      interactionKind: "draggingNodes"
    });

    expect(changes.movedNodeIds).toEqual(["A"]);
    expect(changes.animateLayout).toBe(false);
  });

  it("skips layout animation when the change exceeds the motion budget", () => {
    const previous = graph([]);
    const current = graph([
      { id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" },
      { id: "B", label: "B", x: 80, y: 0, fill: "#ffffff" }
    ]);
    const motion = resolveRuntimeEditorMotion({
      ...DEFAULT_EDITOR_MOTION,
      canvas: { ...DEFAULT_EDITOR_MOTION.canvas, maxAnimatedItems: 1 }
    });

    const changes = resolveCanvasMotionChanges({
      previousNodes: snapshotCanvasNodes(previous),
      graph: current,
      previousSelection: emptySelection,
      selection: emptySelection,
      motion,
      interactionKind: "idle"
    });

    expect(changes.createdNodeIds).toEqual(["A", "B"]);
    expect(changes.animateLayout).toBe(false);
  });
});
