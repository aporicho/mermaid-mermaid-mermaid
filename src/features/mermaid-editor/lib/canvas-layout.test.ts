import { describe, expect, it } from "vitest";

import { edgeRoutingFromLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { CanvasLayout } from "@/features/mermaid-editor/lib/editor-types";

const baseLayout: CanvasLayout = {
  version: 1,
  viewport: { x: 0, y: 0, scale: 1 },
  nodes: {}
};

describe("edgeRoutingFromLayout", () => {
  it("keeps supported routing values", () => {
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "straight" })).toBe("straight");
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "bezier" })).toBe("bezier");
  });

  it("normalizes removed routing values to bezier", () => {
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "smooth-step" } as unknown as CanvasLayout)).toBe("bezier");
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "orthogonal" } as unknown as CanvasLayout)).toBe("bezier");
  });

  it("normalizes legacy per-edge paths to the two supported routing values", () => {
    expect(edgeRoutingFromLayout({ ...baseLayout, edges: { a: { path: "straight" } } })).toBe("straight");
    expect(edgeRoutingFromLayout({ ...baseLayout, edges: { a: { path: "curved" }, b: { path: "orthogonal" } } })).toBe("bezier");
  });
});
