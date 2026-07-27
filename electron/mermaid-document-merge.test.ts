import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { mergeText } = require("./document-hub.cjs");
const {
  mergeMermaidDocument,
  normalizeMermaidLayoutDocument,
  parseMermaidDocument
} = require("./mermaid-document-merge.cjs") as {
  mergeMermaidDocument: (
    baseText: string,
    localText: string,
    diskText: string,
    mergeBody: typeof mergeText
  ) => MergeResult | null;
  normalizeMermaidLayoutDocument: (text: string) => string;
  parseMermaidDocument: (text: string) => { layout: CanvasLayout; body: string } | null;
};

type CanvasLayout = {
  version?: number;
  edgeRouting?: string;
  layoutMode?: string;
  viewport: { x: number; y: number; scale: number };
  nodes: Record<string, { x: number; y: number; fill: string }>;
  edges?: Record<string, Record<string, unknown>>;
};

type MergeConflict = {
  base: string;
  local: string;
  disk: string;
  token: string;
  kind?: string;
  label?: string;
};

type MergeResult = {
  text: string;
  conflicts: MergeConflict[];
  resolutionTemplate: string;
};

describe("Mermaid document merge", () => {
  it("merges positions changed on different nodes and retains the active viewport", () => {
    const result = mergeDocuments(
      documentWith({ A: [10, 20], B: [100, 20] }, 160),
      documentWith({ A: [30, 20], B: [100, 20] }, 220),
      documentWith({ A: [10, 20], B: [140, 20] }, 80)
    );

    expect(result.conflicts).toEqual([]);
    expect(layoutFrom(result.text)).toMatchObject({
      viewport: { x: 220, y: 90, scale: 1 },
      nodes: {
        A: { x: 30, y: 20 },
        B: { x: 140, y: 20 }
      }
    });
  });

  it("combines a local node move with a separate disk source edit", () => {
    const base = documentWith({ A: [10, 20], B: [100, 20] }, 160, "  A[Alpha] --> B[Beta]");
    const local = documentWith({ A: [30, 20], B: [100, 20] }, 160, "  A[Alpha] --> B[Beta]");
    const disk = documentWith({ A: [10, 20], B: [100, 20] }, 160, "  A[Alpha] --> B[Renamed]");

    const result = mergeDocuments(base, local, disk);

    expect(result.conflicts).toEqual([]);
    expect(result.text).toContain("B[Renamed]");
    expect(layoutFrom(result.text).nodes.A).toMatchObject({ x: 30, y: 20 });
  });

  it("creates one labeled conflict when the same node moves to different positions", () => {
    const result = mergeDocuments(
      documentWith({ A: [10, 20], B: [100, 20] }),
      documentWith({ A: [30, 24], B: [100, 20] }),
      documentWith({ A: [44, 36], B: [140, 20] })
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({ kind: "canvas-node-position", label: "节点 A 的位置" });

    const localResolution = resolve(result, "local");
    const diskResolution = resolve(result, "disk");
    expect(layoutFrom(localResolution).nodes).toMatchObject({ A: { x: 30, y: 24 }, B: { x: 140, y: 20 } });
    expect(layoutFrom(diskResolution).nodes).toMatchObject({ A: { x: 44, y: 36 }, B: { x: 140, y: 20 } });
  });

  it("merges independent fields on the same node without coupling appearance and position", () => {
    const base = documentWith({ A: [10, 20] });
    const local = replaceNode(base, "A", { x: 30, y: 40, fill: "#fff" });
    const disk = replaceNode(base, "A", { x: 10, y: 20, fill: "#000" });

    const result = mergeDocuments(base, local, disk);

    expect(result.conflicts).toEqual([]);
    expect(layoutFrom(result.text).nodes.A).toEqual({ x: 30, y: 40, fill: "#000" });
  });

  it("merges independent edge metadata and identifies a same-edge conflict", () => {
    const base = withEdges(documentWith({ A: [10, 20], B: [100, 20] }), {
      e1: { from: "A", to: "B", fromAnchor: "right", toAnchor: "left" },
      e2: { from: "B", to: "A", fromAnchor: "left", toAnchor: "right" }
    });
    const local = withEdges(base, {
      e1: { from: "A", to: "B", fromAnchor: "bottom", toAnchor: "left" },
      e2: { from: "B", to: "A", fromAnchor: "left", toAnchor: "right" }
    });
    const disk = withEdges(base, {
      e1: { from: "A", to: "B", fromAnchor: "right", toAnchor: "left" },
      e2: { from: "B", to: "A", fromAnchor: "left", toAnchor: "top" }
    });

    const independent = mergeDocuments(base, local, disk);
    expect(independent.conflicts).toEqual([]);
    expect(layoutFrom(independent.text).edges).toMatchObject({
      e1: { fromAnchor: "bottom", toAnchor: "left" },
      e2: { fromAnchor: "left", toAnchor: "top" }
    });

    const conflicting = mergeDocuments(base, local, withEdges(base, {
      e1: { from: "A", to: "B", fromAnchor: "top", toAnchor: "left" },
      e2: { from: "B", to: "A", fromAnchor: "left", toAnchor: "right" }
    }));
    expect(conflicting.conflicts).toHaveLength(1);
    expect(conflicting.conflicts[0]).toMatchObject({ kind: "canvas-edge-layout", label: "连线 e1 的布局" });
  });

  it("keeps layout and source conflict tokens independent", () => {
    const base = documentWith({ A: [10, 20] }, 160, "  A[Alpha]");
    const local = documentWith({ A: [30, 20] }, 220, "  A[Local]");
    const disk = documentWith({ A: [44, 36] }, 80, "  A[Disk]");

    const result = mergeDocuments(base, local, disk);

    expect(result.conflicts).toHaveLength(2);
    expect(new Set(result.conflicts.map((conflict) => conflict.token)).size).toBe(2);
    const resolved = normalizeMermaidLayoutDocument(result.conflicts.reduce(
      (text, conflict) => text.replace(conflict.token, conflict.kind === "text" ? conflict.disk : conflict.local),
      result.resolutionTemplate
    ));
    expect(resolved).toContain("A[Disk]");
    expect(layoutFrom(resolved).nodes.A).toMatchObject({ x: 30, y: 20 });
  });

  it("supports choosing deletion when deletion overlaps a node layout change", () => {
    const base = documentWith({ A: [10, 20], B: [100, 20] });
    const local = removeLayoutNode(base, "A");
    const disk = replaceNode(base, "A", { x: 44, y: 36, fill: "#fff" });

    const result = mergeDocuments(base, local, disk);

    expect(result.conflicts).toHaveLength(1);
    const resolved = resolve(result, "local");
    expect(layoutFrom(resolved).nodes).not.toHaveProperty("A");
    expect(layoutFrom(resolved).nodes).toHaveProperty("B");
  });

  it("falls back when any layout metadata cannot be parsed", () => {
    const valid = documentWith({ A: [10, 20] });
    expect(mergeMermaidDocument(valid, valid, "flowchart LR\n  A[Alpha]\n", mergeText)).toBeNull();
  });

  it("removes a null layout entry chosen as a deletion", () => {
    const document = documentWith({ A: [10, 20], B: [100, 20] }).replace(
      '"A":{"x":10,"y":20,"fill":"#fff"}',
      '"A":null'
    );

    const normalized = normalizeMermaidLayoutDocument(document);

    expect(layoutFrom(normalized).nodes).not.toHaveProperty("A");
    expect(layoutFrom(normalized).nodes).toHaveProperty("B");
  });
});

function mergeDocuments(base: string, local: string, disk: string) {
  const result = mergeMermaidDocument(base, local, disk, mergeText);
  if (!result) throw new Error("Expected a structured Mermaid merge result.");
  return result;
}

function documentWith(
  nodes: Record<string, [number, number]>,
  viewportX = 160,
  statement = "  A[Alpha]"
) {
  const layout = {
    version: 1,
    edgeRouting: "bezier",
    layoutMode: "manual",
    viewport: { x: viewportX, y: 90, scale: 1 },
    nodes: Object.fromEntries(Object.entries(nodes).map(([id, [x, y]]) => [id, { x, y, fill: "#fff" }]))
  };
  return `%% canvas-layout: ${JSON.stringify(layout)}\nflowchart LR\n${statement}\n`;
}

function replaceNode(document: string, id: string, node: { x: number; y: number; fill: string }) {
  const parsed = parseMermaidDocument(document);
  if (!parsed) throw new Error("Expected a Mermaid document.");
  parsed.layout.nodes[id] = node;
  return `%% canvas-layout: ${JSON.stringify(parsed.layout)}\n${parsed.body}`;
}

function removeLayoutNode(document: string, id: string) {
  const parsed = parseMermaidDocument(document);
  if (!parsed) throw new Error("Expected a Mermaid document.");
  delete parsed.layout.nodes[id];
  return `%% canvas-layout: ${JSON.stringify(parsed.layout)}\n${parsed.body}`;
}

function withEdges(document: string, edges: Record<string, Record<string, unknown>>) {
  const parsed = parseMermaidDocument(document);
  if (!parsed) throw new Error("Expected a Mermaid document.");
  parsed.layout.edges = edges;
  return `%% canvas-layout: ${JSON.stringify(parsed.layout)}\n${parsed.body}`;
}

function resolve(result: MergeResult, choice: "local" | "disk") {
  return normalizeMermaidLayoutDocument(result.conflicts.reduce(
    (text, conflict) => text.replace(conflict.token, conflict[choice]),
    result.resolutionTemplate
  ));
}

function layoutFrom(document: string) {
  const parsed = parseMermaidDocument(document);
  if (!parsed) throw new Error("Expected a Mermaid document.");
  return parsed.layout;
}
