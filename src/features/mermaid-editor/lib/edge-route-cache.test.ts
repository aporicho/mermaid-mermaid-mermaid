import { describe, expect, it } from "vitest";

import { pruneEdgeGeometryCache, resolveCachedEdgeGeometries, type EdgeGeometryCache } from "@/features/mermaid-editor/lib/edge-route-cache";
import type { RoutedNodeRect } from "@/features/mermaid-editor/lib/edge-geometry";
import type { CanvasEdge } from "@/features/mermaid-editor/lib/editor-types";

const edges: CanvasEdge[] = [
  { id: "AB", from: "A", to: "B", label: "", style: "solid" },
  { id: "CD", from: "C", to: "D", label: "", style: "solid" }
];
const rects: RoutedNodeRect[] = [
  { id: "A", x: 0, y: 0, width: 100, height: 60 },
  { id: "B", x: 200, y: 0, width: 100, height: 60 },
  { id: "C", x: 0, y: 200, width: 100, height: 60 },
  { id: "D", x: 200, y: 200, width: 100, height: 60 }
];

function resolve(cache: EdgeGeometryCache, activeRects = rects) {
  return resolveCachedEdgeGeometries({
    cache,
    edges,
    rectById: new Map(activeRects.map((rect) => [rect.id, rect])),
    routing: "bezier",
    lanes: new Map(),
    curveSegments: 120
  });
}

describe("edge route cache", () => {
  it("reuses unchanged routes and only invalidates edges touching a moved endpoint", () => {
    const cache: EdgeGeometryCache = new Map();
    const initial = resolve(cache);
    const stable = resolve(cache);
    const moved = resolve(cache, rects.map((rect) => rect.id === "A" ? { ...rect, x: 20 } : rect));

    expect(stable.get("AB")).toBe(initial.get("AB"));
    expect(stable.get("CD")).toBe(initial.get("CD"));
    expect(moved.get("AB")).not.toBe(initial.get("AB"));
    expect(moved.get("CD")).toBe(initial.get("CD"));
  });

  it("removes entries for deleted edges", () => {
    const cache: EdgeGeometryCache = new Map();
    resolve(cache);
    pruneEdgeGeometryCache(cache, edges.slice(0, 1));

    expect([...cache.keys()]).toEqual(["AB"]);
  });
});
