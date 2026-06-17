import { describe, expect, it } from "vitest";

import { edgeRoutingFromLayout, layoutModeFromLayout } from "@/features/mermaid-editor/lib/canvas-layout";
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
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "orthogonal" })).toBe("orthogonal");
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "mermaid" })).toBe("mermaid");
  });

  it("normalizes removed routing values to bezier", () => {
    expect(edgeRoutingFromLayout({ ...baseLayout, edgeRouting: "smooth-step" } as unknown as CanvasLayout)).toBe("bezier");
  });

  it("normalizes legacy per-edge paths to supported routing values", () => {
    expect(edgeRoutingFromLayout({ ...baseLayout, edges: { a: { path: "straight" } } })).toBe("straight");
    expect(edgeRoutingFromLayout({ ...baseLayout, edges: { a: { path: "orthogonal" } } })).toBe("orthogonal");
    expect(edgeRoutingFromLayout({ ...baseLayout, edges: { a: { path: "curved" }, b: { path: "orthogonal" } } })).toBe("bezier");
  });
});

describe("layoutModeFromLayout", () => {
  it("keeps supported layout modes", () => {
    expect(layoutModeFromLayout({ ...baseLayout, layoutMode: "manual" })).toBe("manual");
    expect(layoutModeFromLayout({ ...baseLayout, layoutMode: "auto" })).toBe("auto");
  });

  it("defaults missing or invalid layout modes to manual", () => {
    expect(layoutModeFromLayout(baseLayout)).toBe("manual");
    expect(layoutModeFromLayout({ ...baseLayout, layoutMode: "locked" } as unknown as CanvasLayout)).toBe("manual");
  });
});
