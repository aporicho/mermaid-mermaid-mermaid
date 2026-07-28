import { describe, expect, it } from "vitest";

import { resolveConnectionAnchorOverlay } from "@/features/mermaid-editor/components/konva-canvas/connection-anchor-overlay-state";
import type { ConnectionPreview } from "@/features/mermaid-editor/lib/connection-preview";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";
import { buildNodeGeometry, DEFAULT_NODE_GEOMETRY_TOKENS, themedNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { buildSubgraphGeometries } from "@/features/mermaid-editor/lib/subgraph-geometry";

const geometrySpec = themedNodeGeometrySpec(
  DEFAULT_NODE_GEOMETRY_TOKENS,
  DEFAULT_EDITOR_THEME.specialNode,
  DEFAULT_EDITOR_THEME.typography.tableNode.cell
);
const node = buildNodeGeometry({ id: "node-a", label: "Node A", x: 120, y: 80, fill: "#fff" }, geometrySpec);
const [group] = buildSubgraphGeometries(
  { direction: "TD", nodes: [], edges: [], subgraphs: [{ id: "group-a", title: "Group A", nodeIds: [] }] },
  []
);
const nodeGeometryById = new Map([[node.id, node]]);

function resolve(overrides: Partial<Parameters<typeof resolveConnectionAnchorOverlay>[0]> = {}) {
  return resolveConnectionAnchorOverlay({
    hoveredHitTarget: { kind: "blank" },
    nodeGeometryById,
    subgraphGeometries: [group],
    ...overrides
  });
}

function preview(overrides: Partial<ConnectionPreview> = {}): ConnectionPreview {
  return {
    valid: true,
    targetId: node.id,
    targetKind: "node",
    targetAnchor: node.anchorsLocal[0].key,
    targetNodeId: node.id,
    targetSubgraphId: null,
    invalidId: null,
    invalidKind: null,
    invalidNodeId: null,
    invalidSubgraphId: null,
    reason: "valid",
    geometryTarget: { kind: "node", rect: node.routedRect },
    ...overrides
  };
}

describe("connection anchor overlay", () => {
  it("renders no anchor for node bodies, blank canvas, or inactive selections", () => {
    expect(resolve()).toBeNull();
    expect(resolve({ hoveredHitTarget: { kind: "node", id: node.id } })).toBeNull();
  });

  it("resolves only the node anchor directly under the pointer and follows proximity scale", () => {
    const anchor = node.anchorsLocal[0];
    const result = resolve({
      hoveredHitTarget: { kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key },
      nodeProximityScale: { [node.id]: 1.2 }
    });

    expect(result).toMatchObject({ entityKind: "node", entityId: node.id, anchor: anchor.key, kind: "hovered" });
    expect(result?.point).toEqual({
      x: node.frame.x + node.frame.width / 2 + (anchor.x - node.frame.width / 2) * 1.2,
      y: node.frame.y + node.frame.height / 2 + (anchor.y - node.frame.height / 2) * 1.2
    });
  });

  it("uses the same single-anchor overlay for groups", () => {
    const anchor = group.anchorsWorld[1];
    expect(resolve({ hoveredHitTarget: { kind: "subgraphAnchor", subgraphId: group.id, anchor: anchor.key } })).toEqual({
      entityKind: "subgraph",
      entityId: group.id,
      anchor: anchor.key,
      kind: "hovered",
      point: { x: anchor.x, y: anchor.y }
    });
  });

  it("lets an exact valid connection target override the hovered anchor", () => {
    const target = node.anchorsLocal[2];
    const result = resolve({
      hoveredHitTarget: { kind: "subgraphAnchor", subgraphId: group.id, anchor: group.anchorsWorld[0].key },
      connectionPreview: preview({ targetAnchor: target.key })
    });

    expect(result).toMatchObject({ entityKind: "node", entityId: node.id, anchor: target.key, kind: "target" });
  });

  it("does not invent an anchor for unsnapped or invalid connection previews", () => {
    expect(resolve({ connectionPreview: preview({ targetAnchor: null }) })).toBeNull();
    expect(resolve({ connectionPreview: preview({ valid: false, targetId: null, targetKind: null, targetAnchor: null }) })).toBeNull();
  });
});
