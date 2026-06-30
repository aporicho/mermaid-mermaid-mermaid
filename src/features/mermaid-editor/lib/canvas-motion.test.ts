import { describe, expect, it } from "vitest";

import { DEFAULT_EDITOR_MOTION } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveRuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import {
  centerScaleTransform,
  mergeCanvasNodePreviewPositions,
  proximityScaleAtDistance,
  resolveCanvasProximityEdgeIds,
  resolveCanvasMotionChanges,
  resolveCanvasProximityScales,
  resolveNextCanvasProximityScales,
  scaleRectFromCenter,
  shouldRunCanvasProximity,
  snapshotCanvasNodes
} from "@/features/mermaid-editor/lib/canvas-motion";
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

  it("does not stack selection highlight on an auto-selected created node", () => {
    const previous = graph([]);
    const current = graph([{ id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" }]);
    const selection: Selection = { nodeIds: ["A"], edgeIds: [], subgraphIds: [] };

    const changes = resolveCanvasMotionChanges({
      previousNodes: snapshotCanvasNodes(previous),
      graph: current,
      previousSelection: emptySelection,
      selection,
      motion: resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION),
      interactionKind: "idle"
    });

    expect(changes.createdNodeIds).toEqual(["A"]);
    expect(changes.highlightedNodeIds).toEqual([]);
  });

  it("keeps normal existing node selection highlights", () => {
    const previous = graph([{ id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" }]);
    const selection: Selection = { nodeIds: ["A"], edgeIds: [], subgraphIds: [] };

    const changes = resolveCanvasMotionChanges({
      previousNodes: snapshotCanvasNodes(previous),
      graph: previous,
      previousSelection: emptySelection,
      selection,
      motion: resolveRuntimeEditorMotion(DEFAULT_EDITOR_MOTION),
      interactionKind: "idle"
    });

    expect(changes.createdNodeIds).toEqual([]);
    expect(changes.highlightedNodeIds).toEqual(["A"]);
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

  it("derives a centered visual transform for node scaling", () => {
    expect(centerScaleTransform({ width: 120, height: 48 })).toEqual({
      x: 60,
      y: 24,
      offsetX: 60,
      offsetY: 24
    });
  });

  it("merges drag preview positions without mutating source nodes", () => {
    const nodes = [
      { id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" },
      { id: "B", label: "B", x: 100, y: 0, fill: "#ffffff" }
    ];
    const merged = mergeCanvasNodePreviewPositions(nodes, { A: { x: 24, y: 12 } });

    expect(merged).toEqual([
      { id: "A", label: "A", x: 24, y: 12, fill: "#ffffff" },
      { id: "B", label: "B", x: 100, y: 0, fill: "#ffffff" }
    ]);
    expect(nodes[0]).toEqual({ id: "A", label: "A", x: 0, y: 0, fill: "#ffffff" });
  });

  it("maps pointer proximity to an eased scale", () => {
    expect(proximityScaleAtDistance(0, 200, 1.4)).toBeCloseTo(1.4);
    expect(proximityScaleAtDistance(100, 200, 1.4)).toBeCloseTo(1.3);
    expect(proximityScaleAtDistance(200, 200, 1.4)).toBe(1);
    expect(proximityScaleAtDistance(260, 200, 1.4)).toBe(1);
  });

  it("resolves proximity scales in screen space", () => {
    const scales = resolveCanvasProximityScales({
      frames: [
        { id: "A", x: 0, y: 0, width: 100, height: 50 },
        { id: "B", x: 300, y: 0, width: 100, height: 50 }
      ],
      pointerScreen: { x: 200, y: 100 },
      viewport: { x: 100, y: 50, scale: 2 },
      radiusPx: 180,
      maxScale: 1.2
    });

    expect(scales.A).toBeCloseTo(1.2);
    expect(scales.B).toBeUndefined();
  });

  it("scales routed rectangles from their center without mutating the source", () => {
    const rect = { id: "A", x: 10, y: 20, width: 100, height: 40, shape: "rect" as const };
    const scaled = scaleRectFromCenter(rect, 1.2);

    expect(scaled).toEqual({ id: "A", x: 0, y: 16, width: 120, height: 48, shape: "rect" });
    expect(rect).toEqual({ id: "A", x: 10, y: 20, width: 100, height: 40, shape: "rect" });
  });

  it("starts proximity tracking on the first frame instead of waiting for the full duration", () => {
    const next = resolveNextCanvasProximityScales({
      current: {},
      target: { A: 2.5 },
      deltaMs: 16,
      durationMs: 350
    });

    expect(next.A).toBeGreaterThan(1.2);
    expect(next.A).toBeLessThan(2.5);
  });

  it("tracks changed proximity targets continuously without restarting from one", () => {
    const first = resolveNextCanvasProximityScales({
      current: { A: 1.6 },
      target: { A: 2.5 },
      deltaMs: 16,
      durationMs: 350
    });
    const second = resolveNextCanvasProximityScales({
      current: first,
      target: { A: 1.2 },
      deltaMs: 16,
      durationMs: 350
    });

    expect(first.A).toBeGreaterThan(1.6);
    expect(second.A).toBeGreaterThan(1.2);
    expect(second.A).toBeLessThan(first.A);
  });

  it("resolves only edges connected to active proximity nodes", () => {
    const edgeIds = resolveCanvasProximityEdgeIds(
      [
        { id: "ab", from: "A", to: "B" },
        { id: "bc", from: "B", to: "C" },
        { id: "cd", from: "C", to: "D" }
      ],
      { B: 1.2 }
    );

    expect(edgeIds).toEqual(new Set(["ab", "bc"]));
  });

  it("allows proximity scaling in select and connect modes", () => {
    const input = {
      reduced: false,
      viewNodes: true,
      panningRequested: false,
      inlineEditing: false,
      interactionKind: "idle",
      radiusPx: 220,
      maxScale: 1.16
    };

    expect(shouldRunCanvasProximity({ ...input, mode: "select" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...input, mode: "connect" })).toBe(true);
  });

  it("pauses proximity scaling only for active canvas operations", () => {
    const base = {
      reduced: false,
      viewNodes: true,
      panningRequested: false,
      inlineEditing: false,
      interactionKind: "idle",
      radiusPx: 220,
      maxScale: 1.16
    };

    expect(shouldRunCanvasProximity({ ...base, interactionKind: "pendingBlankPointer" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "pendingNodePointer" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "pendingSubgraphPointer" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "editingNodeText" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "editingEdgeLabel" })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, inlineEditing: true })).toBe(true);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "draggingNodes" })).toBe(false);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "panning" })).toBe(false);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "connectingEdge" })).toBe(false);
    expect(shouldRunCanvasProximity({ ...base, interactionKind: "retargetingEdge" })).toBe(false);
    expect(shouldRunCanvasProximity({ ...base, maxScale: 1 })).toBe(false);
  });
});
