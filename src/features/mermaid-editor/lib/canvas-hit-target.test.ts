import { describe, expect, it } from "vitest";

import { nodeVisualId, subgraphVisualId } from "@/features/mermaid-editor/lib/canvas-hit-target";

describe("canvas visual identifiers", () => {
  it("keeps arbitrary business identifiers safe for Konva selectors", () => {
    expect(nodeVisualId("Web:UI")).toBe("node-visual:Web%3AUI");
    expect(subgraphVisualId("Group/UI")).toBe("subgraph-visual:Group%2FUI");
  });
});
