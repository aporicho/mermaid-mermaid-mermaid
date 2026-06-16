import { describe, expect, it } from "vitest";

import { resolveConnectionPreview, resolveRetargetPreview } from "@/features/mermaid-editor/lib/connection-preview";
import type { CanvasEdge, CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { buildNodeGeometry, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

const spec: NodeGeometrySpec = {
  minChars: 4,
  maxChars: 12,
  paddingX: 10,
  paddingY: 8,
  lineHeight: 20,
  maxLines: 3,
  measureText: (value) => value.length * 10
};

const nodes: CanvasNode[] = [
  { id: "a", label: "Alpha", x: 0, y: 0, fill: "#fff" },
  { id: "b", label: "Beta", x: 160, y: 0, fill: "#fff" },
  { id: "c", label: "Gamma", x: 320, y: 0, fill: "#fff" }
];

const geometries = nodes.map((node) => buildNodeGeometry(node, spec));

const edge: CanvasEdge = {
  id: "edge-a-b",
  from: "a",
  to: "b",
  label: "",
  style: "solid"
};

describe("connection preview", () => {
  it("treats a non-source node as a valid connection target", () => {
    const preview = resolveConnectionPreview({ fromNodeId: "a", currentWorld: { x: 180, y: 20 }, nodes: geometries });

    expect(preview.valid).toBe(true);
    expect(preview.targetNodeId).toBe("b");
    expect(preview.invalidNodeId).toBeNull();
    expect(preview.geometryTarget).toEqual({ kind: "node", rect: geometries[1].routedRect });
  });

  it("treats the source node and blank space as invalid connection targets", () => {
    const source = resolveConnectionPreview({ fromNodeId: "a", currentWorld: { x: 20, y: 20 }, nodes: geometries });
    const blank = resolveConnectionPreview({ fromNodeId: "a", currentWorld: { x: 120, y: 120 }, nodes: geometries });

    expect(source).toMatchObject({ valid: false, targetNodeId: null, invalidNodeId: "a", reason: "source-node" });
    expect(source.geometryTarget).toEqual({ kind: "point", point: { x: 20, y: 20 } });
    expect(blank).toMatchObject({ valid: false, targetNodeId: null, invalidNodeId: null, reason: "blank" });
  });

  it("treats a new node as a valid retarget endpoint", () => {
    const preview = resolveRetargetPreview({ edge, side: "to", currentWorld: { x: 340, y: 20 }, nodes: geometries });

    expect(preview.valid).toBe(true);
    expect(preview.targetNodeId).toBe("c");
    expect(preview.geometryTarget).toEqual({ kind: "node", rect: geometries[2].routedRect });
  });

  it("allows retargeting onto the opposite endpoint node for self-loops", () => {
    const preview = resolveRetargetPreview({ edge, side: "to", currentWorld: { x: 20, y: 20 }, nodes: geometries });

    expect(preview.valid).toBe(true);
    expect(preview.targetNodeId).toBe("a");
  });

  it("treats the current same-side endpoint and blank space as invalid retarget targets", () => {
    const sameEndpoint = resolveRetargetPreview({ edge, side: "to", currentWorld: { x: 180, y: 20 }, nodes: geometries });
    const blank = resolveRetargetPreview({ edge, side: "from", currentWorld: { x: 120, y: 120 }, nodes: geometries });

    expect(sameEndpoint).toMatchObject({ valid: false, targetNodeId: null, invalidNodeId: "b", reason: "same-endpoint" });
    expect(sameEndpoint.geometryTarget).toEqual({ kind: "point", point: { x: 180, y: 20 } });
    expect(blank).toMatchObject({ valid: false, targetNodeId: null, invalidNodeId: null, reason: "blank" });
  });
});
