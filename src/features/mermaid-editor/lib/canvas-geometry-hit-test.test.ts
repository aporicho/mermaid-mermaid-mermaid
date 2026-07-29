import { describe, expect, it } from "vitest";

import { createCanvasGeometryHitTester, type CanvasGeometryHitTesterInput } from "@/features/mermaid-editor/lib/canvas-geometry-hit-test";
import { idleInteraction } from "@/features/mermaid-editor/lib/canvas-interaction";
import { CANVAS_VISUAL_TOKENS } from "@/features/mermaid-editor/lib/canvas-visual-state";
import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";
import type { CanvasEdge, CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { buildNodeGeometry, DEFAULT_NODE_GEOMETRY_TOKENS, themedNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { buildSubgraphGeometries } from "@/features/mermaid-editor/lib/subgraph-geometry";

const geometrySpec = themedNodeGeometrySpec(
  DEFAULT_NODE_GEOMETRY_TOKENS,
  DEFAULT_EDITOR_THEME.specialNode,
  DEFAULT_EDITOR_THEME.typography.tableNode.cell
);
const context = {
  viewportScale: 1,
  mode: "select" as const,
  selection: { nodeIds: [], edgeIds: [], subgraphIds: [] },
  interactionState: idleInteraction,
  inlineEditing: false,
  hoveredNodeId: null,
  hoveredSubgraphId: null
};

function tester(options: Partial<CanvasGeometryHitTesterInput> = {}) {
  const nodes = options.nodes || [];
  const geometries = nodes.map((node) => buildNodeGeometry(node, geometrySpec));
  return createCanvasGeometryHitTester({
    nodes,
    nodeGeometryById: new Map(geometries.map((geometry) => [geometry.id, geometry])),
    subgraphs: [], edges: [], edgeGeometry: () => null,
    edgeLabelSpec: { minChars: 2, maxChars: 20, paddingX: 8, height: 24, measureText: (value) => value.length * 8 },
    visualTokens: CANVAS_VISUAL_TOKENS,
    specialNodeTokens: DEFAULT_EDITOR_THEME.specialNode,
    viewNodes: true, viewEdges: true, viewEdgeLabels: true, viewSubgraphs: true,
    ...options
  });
}

describe("canvas geometry hit testing", () => {
  it("resolves overlapping nodes in visual order without a Konva hit canvas", () => {
    const nodes: CanvasNode[] = [
      { id: "lower", label: "lower", x: 20, y: 20, fill: "#fff" },
      { id: "upper", label: "upper", x: 20, y: 20, fill: "#fff" }
    ];
    expect(tester({ nodes }).resolve({ x: 50, y: 40 }, context)).toEqual({ kind: "node", id: "upper" });
  });

  it("treats the former action-badge area as ordinary node content", () => {
    const node: CanvasNode = {
      id: "link",
      label: "Link",
      x: 20,
      y: 20,
      fill: "#fff",
      action: { kind: "url", url: "https://example.com", openMode: "app-browser" }
    };
    const geometry = buildNodeGeometry(node, geometrySpec);
    const point = {
      x: geometry.frame.x + geometry.frame.width - 11,
      y: geometry.frame.y + 11
    };

    expect(tester({ nodes: [node] }).resolve(point, context)).toEqual({ kind: "node", id: node.id });
  });

  it("resolves a single node anchor directly without requiring prior hover or selection", () => {
    const node: CanvasNode = { id: "node", label: "Node", x: 40, y: 60, fill: "#fff" };
    const geometry = buildNodeGeometry(node, geometrySpec);
    const anchor = geometry.anchorsWorld[1];
    expect(tester({ nodes: [node] }).resolve(anchor, context)).toEqual({ kind: "nodeAnchor", nodeId: node.id, anchor: anchor.key });
  });

  it("uses the real polygon instead of the bounding box for shaped nodes", () => {
    const node: CanvasNode = { id: "diamond", label: "decision", x: 20, y: 20, fill: "#fff", shape: "diam" };
    const geometry = buildNodeGeometry(node, geometrySpec);
    expect(tester({ nodes: [node] }).resolve({ x: geometry.frame.x + 1, y: geometry.frame.y + 1 }, context)).toEqual({ kind: "blank" });
  });

  it("prioritizes edge labels and selected endpoints over edge segments", () => {
    const edge: CanvasEdge = { id: "edge", from: "a", to: "b", label: "label", style: "solid" };
    const geometry = {
      points: [0, 200, 300, 200], labelPoint: { x: 150, y: 200 },
      start: { x: 0, y: 200 }, end: { x: 300, y: 200 },
      startTangent: { x: 1, y: 0 }, endTangent: { x: 1, y: 0 }
    };
    const target = tester({ edges: [edge], edgeGeometry: () => geometry });
    expect(target.resolve({ x: 150, y: 200 }, context)).toEqual({ kind: "edgeLabel", id: "edge" });
    expect(target.resolve({ x: 0, y: 200 }, { ...context, selection: { nodeIds: [], edgeIds: ["edge"] } })).toEqual({ kind: "edgeEndpoint", edgeId: "edge", side: "from" });
  });

  it("keeps group content transparent while resolving its title and border", () => {
    const graph = { direction: "TD" as const, nodes: [], edges: [], subgraphs: [{ id: "group", title: "Group", nodeIds: [] }] };
    const [group] = buildSubgraphGeometries(graph, []);
    const target = tester({ subgraphs: [group] });
    expect(target.resolve({ x: group.titleBox.x + 2, y: group.titleBox.y + 2 }, context)).toEqual({ kind: "subgraphTitle", id: "group" });
    expect(target.resolve({ x: group.frame.x, y: group.frame.y + group.frame.height / 4 }, context)).toEqual({ kind: "subgraph", id: "group" });
    expect(target.resolve({ x: group.contentBox.x + 10, y: group.contentBox.y + 10 }, context)).toEqual({ kind: "blank" });
  });

  it("resolves group anchors directly and disables all connection anchors outside idle select mode", () => {
    const graph = { direction: "TD" as const, nodes: [], edges: [], subgraphs: [{ id: "group", title: "Group", nodeIds: [] }] };
    const [group] = buildSubgraphGeometries(graph, []);
    const anchor = group.anchorsWorld[1];
    const target = tester({ subgraphs: [group] });

    expect(target.resolve(anchor, context)).toEqual({ kind: "subgraphAnchor", subgraphId: group.id, anchor: anchor.key });
    expect(target.resolve(anchor, { ...context, mode: "connect" })).not.toMatchObject({ kind: "subgraphAnchor" });
    expect(target.resolve(anchor, { ...context, inlineEditing: true })).not.toMatchObject({ kind: "subgraphAnchor" });
    expect(target.resolve(anchor, { ...context, interactionState: { kind: "panning", pointerId: 1, startScreen: anchor, originViewport: { x: 0, y: 0, scale: 1 } } })).not.toMatchObject({ kind: "subgraphAnchor" });
  });

  it("resolves table cells and column resize handles from layout geometry", () => {
    const node: CanvasNode = { id: "table", label: "Table", x: 400, y: 40, fill: "#fff", content: createDefaultCanvasTableContent(2, 2) };
    const geometry = buildNodeGeometry(node, geometrySpec);
    const target = tester({ nodes: [node], nodeGeometryById: new Map([[node.id, geometry]]) });
    const cell = geometry.table!.cells[0];
    expect(target.resolve({ x: node.x + cell.frame.x + 2, y: node.y + cell.frame.y + 2 }, context)).toMatchObject({ kind: "tableCell", nodeId: "table" });
    expect(target.resolve({ x: node.x + geometry.table!.columnBoundaries[0], y: node.y + 4 }, context)).toMatchObject({ kind: "tableColumnResize", nodeId: "table" });
  });
});
