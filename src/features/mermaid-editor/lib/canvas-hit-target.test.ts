import { describe, expect, it } from "vitest";

import {
  edgeEndpointHitId,
  edgeHitId,
  edgeLabelHitId,
  nodeAnchorHitId,
  nodeHitId,
  parseHitTargetId,
  resolveKonvaHitTarget
} from "@/features/mermaid-editor/lib/canvas-hit-target";

type MockNode = {
  value: string;
  parent: MockNode | null;
  id: () => string;
  getParent: () => MockNode | null;
};

function node(value: string, parent: MockNode | null = null): MockNode {
  return {
    value,
    parent,
    id() {
      return value;
    },
    getParent() {
      return parent;
    }
  };
}

describe("canvas hit target", () => {
  it("parses encoded hit target identifiers", () => {
    expect(parseHitTargetId(nodeHitId("Web:UI"))).toEqual({ kind: "node", id: "Web:UI" });
    expect(parseHitTargetId(nodeAnchorHitId("Web:UI", "right"))).toEqual({ kind: "nodeAnchor", nodeId: "Web:UI", anchor: "right" });
    expect(parseHitTargetId(edgeHitId("a-->b"))).toEqual({ kind: "edge", id: "a-->b" });
    expect(parseHitTargetId(edgeLabelHitId("a-->b"))).toEqual({ kind: "edgeLabel", id: "a-->b" });
    expect(parseHitTargetId(edgeEndpointHitId("a-->b", "from"))).toEqual({ kind: "edgeEndpoint", edgeId: "a-->b", side: "from" });
  });

  it("walks from child shapes to the nearest business target", () => {
    const stage = node("");
    const nodeGroup = node(nodeHitId("node-a"), stage);
    const label = node("", nodeGroup);

    expect(resolveKonvaHitTarget(label, stage)).toEqual({ kind: "node", id: "node-a" });
  });

  it("prefers the nearest nested hit target", () => {
    const stage = node("");
    const nodeGroup = node(nodeHitId("node-a"), stage);
    const anchor = node(nodeAnchorHitId("node-a", "bottom"), nodeGroup);

    expect(resolveKonvaHitTarget(anchor, stage)).toEqual({ kind: "nodeAnchor", nodeId: "node-a", anchor: "bottom" });
  });

  it("falls back to blank when no business target exists", () => {
    const stage = node("");
    const grid = node("", stage);

    expect(resolveKonvaHitTarget(stage, stage)).toEqual({ kind: "blank" });
    expect(resolveKonvaHitTarget(grid, stage)).toEqual({ kind: "blank" });
  });
});
