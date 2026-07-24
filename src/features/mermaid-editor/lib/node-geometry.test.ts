import { describe, expect, it } from "vitest";

import { buildNodeGeometry, DEFAULT_NODE_GEOMETRY_TOKENS, nodeIntersectsRect, pointInsideNodeFrame, TABLE_LOADING_NODE_HEIGHT, TABLE_LOADING_NODE_WIDTH, themedNodeGeometrySpec, type NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDITOR_THEME } from "@/features/mermaid-editor/lib/editor-theme";
import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";

const spec: NodeGeometrySpec = {
  minChars: 4,
  maxChars: 12,
  paddingX: 10,
  paddingY: 8,
  lineHeight: 20,
  maxLines: 3,
  measureText: (value) => value.length * 10
};

const node: CanvasNode = {
  id: "node-a",
  label: "Hello",
  x: 100,
  y: 80,
  fill: "#ffffff"
};

function expectPointClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 4);
  expect(actual.y).toBeCloseTo(expected.y, 4);
}

describe("node geometry", () => {
  it("uses stable table placeholder geometry while a CSV reference is loading", () => {
    const geometry = buildNodeGeometry({
      ...node,
      action: { kind: "file", path: "data/report.csv", openMode: "app-window" }
    }, spec);

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: TABLE_LOADING_NODE_WIDTH, height: TABLE_LOADING_NODE_HEIGHT });
    expect(geometry.table).toBeUndefined();
    expect(geometry.anchorsWorld.find((anchor) => anchor.key === "right")).toMatchObject({ x: 100 + TABLE_LOADING_NODE_WIDTH });
  });

  it("switches a CSV reference from placeholder geometry to injected table content", () => {
    const content = createDefaultCanvasTableContent(2, 2);
    const activeSpec = themedNodeGeometrySpec(DEFAULT_NODE_GEOMETRY_TOKENS, DEFAULT_EDITOR_THEME.specialNode, DEFAULT_EDITOR_THEME.typography.tableNode.cell);
    const geometry = buildNodeGeometry({
      ...node,
      action: { kind: "file", path: "data/report.csv", openMode: "app-window" },
      content
    }, activeSpec);

    expect(geometry.table).toBeDefined();
    expect(geometry.frame.width).toBe(content.columns.reduce((total, column) => total + column.width, 0));
    expect(geometry.frame.height).toBeGreaterThan(0);
  });

  it("keeps legacy content-backed table geometry compatible during migration", () => {
    const activeSpec = themedNodeGeometrySpec(DEFAULT_NODE_GEOMETRY_TOKENS, DEFAULT_EDITOR_THEME.specialNode, DEFAULT_EDITOR_THEME.typography.tableNode.cell);
    const geometry = buildNodeGeometry({ ...node, content: createDefaultCanvasTableContent(2, 2) }, activeSpec);
    expect(geometry.table).toBeDefined();
  });

  it("builds frame and text box from the same measured text width", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 70, height: 36 });
    expect(geometry.textBox).toEqual({ x: 10, y: 8, width: 50, height: 20 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 70, height: 36, shape: "rect" });
  });

  it("uses active special-node tokens for link-card and Markdown geometry", () => {
    const specialNode = {
      ...DEFAULT_EDITOR_THEME.specialNode,
      linkCard: {
        ...DEFAULT_EDITOR_THEME.specialNode.linkCard,
        width: 360,
        inset: 20,
        coverFallbackHeight: 240,
        providerGap: 30,
        titleGap: 10,
        titleHeight: 60,
        contentPaddingX: 18
      },
      markdownDocument: {
        ...DEFAULT_EDITOR_THEME.specialNode.markdownDocument,
        width: 410,
        height: 260,
        contentPaddingTop: 18,
        contentPaddingRight: 24,
        contentPaddingBottom: 26,
        contentPaddingLeft: 20,
        titleGap: 12
      }
    };
    const activeSpec = themedNodeGeometrySpec(DEFAULT_NODE_GEOMETRY_TOKENS, specialNode, DEFAULT_EDITOR_THEME.typography.tableNode.cell);
    const link = buildNodeGeometry({
      ...node,
      preview: { kind: "link-card", pluginId: "test", provider: "Provider", sourceUrl: "https://example.com", title: "Card", status: "ready" }
    }, activeSpec);
    const markdown = buildNodeGeometry({
      ...node,
      action: { kind: "file", path: "notes/theme.md", openMode: "app-window" }
    }, activeSpec);

    expect(link.frame).toEqual({ x: 100, y: 80, width: 360, height: 398 });
    expect(link.textBox).toEqual({ x: 18, y: 316, width: 324, height: 60 });
    expect(markdown.frame).toEqual({ x: 100, y: 80, width: 410, height: 260 });
    expect(markdown.textBox).toEqual({ x: 20, y: 18, width: 366, height: 22 });
  });

  it("never creates negative text boxes from extreme special-node spacing", () => {
    const specialNode = {
      ...DEFAULT_EDITOR_THEME.specialNode,
      linkCard: {
        ...DEFAULT_EDITOR_THEME.specialNode.linkCard,
        width: 120,
        contentPaddingX: 64
      },
      markdownDocument: {
        ...DEFAULT_EDITOR_THEME.specialNode.markdownDocument,
        width: 160,
        contentPaddingRight: 80,
        contentPaddingLeft: 80,
        titleGap: 64
      }
    };
    const activeSpec = themedNodeGeometrySpec(DEFAULT_NODE_GEOMETRY_TOKENS, specialNode, DEFAULT_EDITOR_THEME.typography.tableNode.cell);
    const link = buildNodeGeometry({
      ...node,
      preview: { kind: "link-card", pluginId: "test", provider: "Provider", sourceUrl: "https://example.com", title: "Card", status: "ready" }
    }, activeSpec);
    const markdown = buildNodeGeometry({
      ...node,
      action: { kind: "file", path: "notes/theme.md", openMode: "app-window" }
    }, activeSpec);

    expect(link.textBox.width).toBe(0);
    expect(markdown.textBox.width).toBe(0);
  });

  it("uses stable Markdown card geometry for drawing, anchors, and edge routing", () => {
    const geometry = buildNodeGeometry({
      ...node,
      action: { kind: "file", path: "docs/spec.md", openMode: "app-window" }
    }, spec);

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 280, height: 396 });
    expect(geometry.textBox).toEqual({ x: 12, y: 12, width: 256, height: 22 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 280, height: 396, shape: "rect" });
    expect(geometry.anchorsWorld.find((anchor) => anchor.key === "right")).toEqual({ key: "right", kind: "edge-midpoint", x: 380, y: 278 });
  });

  it("keeps anchor points in local node coordinates", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsLocal).toEqual([
      { key: "top", kind: "edge-midpoint", x: 35, y: 0 },
      { key: "top-right", kind: "corner", x: 70, y: 0 },
      { key: "right", kind: "edge-midpoint", x: 70, y: 18 },
      { key: "bottom-right", kind: "corner", x: 70, y: 36 },
      { key: "bottom", kind: "edge-midpoint", x: 35, y: 36 },
      { key: "bottom-left", kind: "corner", x: 0, y: 36 },
      { key: "left", kind: "edge-midpoint", x: 0, y: 18 },
      { key: "top-left", kind: "corner", x: 0, y: 0 }
    ]);
  });

  it("derives world anchors from frame position plus local anchors", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.anchorsWorld).toEqual([
      { key: "top", kind: "edge-midpoint", x: 135, y: 80 },
      { key: "top-right", kind: "corner", x: 170, y: 80 },
      { key: "right", kind: "edge-midpoint", x: 170, y: 98 },
      { key: "bottom-right", kind: "corner", x: 170, y: 116 },
      { key: "bottom", kind: "edge-midpoint", x: 135, y: 116 },
      { key: "bottom-left", kind: "corner", x: 100, y: 116 },
      { key: "left", kind: "edge-midpoint", x: 100, y: 98 },
      { key: "top-left", kind: "corner", x: 100, y: 80 }
    ]);
  });

  it("uses the node frame as the alignment rect without anchor radius", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(geometry.alignmentRect).toEqual({ id: "node-a", x: 100, y: 80, width: 70, height: 36 });
  });

  it("uses the same frame for hit testing and marquee intersection", () => {
    const geometry = buildNodeGeometry(node, spec);

    expect(pointInsideNodeFrame({ x: 120, y: 90 }, geometry)).toBe(true);
    expect(pointInsideNodeFrame({ x: 99, y: 90 }, geometry)).toBe(false);
    expect(nodeIntersectsRect(geometry, { x: 70, y: 50, width: 20, height: 20 })).toBe(false);
    expect(nodeIntersectsRect(geometry, { x: 90, y: 70, width: 30, height: 30 })).toBe(true);
  });

  it("builds image node geometry from only the image size", () => {
    const geometry = buildNodeGeometry(
      {
        ...node,
        label: "Logo",
        asset: {
          kind: "image",
          src: "assets/logo.png",
          width: 120,
          height: 80,
          preserveAspectRatio: true,
          labelPosition: "bottom"
        }
      },
      spec
    );

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 120, height: 80 });
    expect(geometry.imageBox).toEqual({ x: 0, y: 0, width: 120, height: 80 });
    expect(geometry.textBox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 120, height: 80, shape: "rect" });
    expect(geometry.anchorsWorld).toEqual([
      { key: "top", kind: "edge-midpoint", x: 160, y: 80 },
      { key: "top-right", kind: "corner", x: 220, y: 80 },
      { key: "right", kind: "edge-midpoint", x: 220, y: 120 },
      { key: "bottom-right", kind: "corner", x: 220, y: 160 },
      { key: "bottom", kind: "edge-midpoint", x: 160, y: 160 },
      { key: "bottom-left", kind: "corner", x: 100, y: 160 },
      { key: "left", kind: "edge-midpoint", x: 100, y: 120 },
      { key: "top-left", kind: "corner", x: 100, y: 80 }
    ]);
  });

  it("builds link card preview geometry from stable card dimensions", () => {
    const geometry = buildNodeGeometry(
      {
        ...node,
        preview: {
          kind: "link-card",
          pluginId: "xiaohongshu",
          provider: "小红书",
          sourceUrl: "https://xhslink.com/a",
          title: "小红书笔记",
          status: "fallback"
        }
      },
      spec
    );

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 220, height: 292 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 220, height: 292, shape: "rect" });
    expect(geometry.textBox).toEqual({ x: 12, y: 216, width: 196, height: 48 });
  });

  it("builds taller link card preview geometry from cover dimensions", () => {
    const geometry = buildNodeGeometry(
      {
        ...node,
        preview: {
          kind: "link-card",
          pluginId: "xiaohongshu",
          provider: "小红书",
          sourceUrl: "https://xhslink.com/a",
          title: "小红书视频笔记",
          cover: { src: "assets/xhs-video.jpg", width: 1080, height: 1920, persistent: true },
          status: "ready"
        }
      },
      spec
    );

    expect(geometry.frame).toEqual({ x: 100, y: 80, width: 220, height: 467 });
    expect(geometry.routedRect).toEqual({ id: "node-a", x: 100, y: 80, width: 220, height: 467, shape: "rect" });
    expect(geometry.textBox).toEqual({ x: 12, y: 391, width: 196, height: 48 });
  });

  it("caps wrapped text height at the configured maximum line count", () => {
    const geometry = buildNodeGeometry({ ...node, label: "abcdefghijklmnopqrstuvwxyz" }, spec);

    expect(geometry.textBox.height).toBe(60);
    expect(geometry.frame.height).toBe(76);
  });

  it("keeps circle-like nodes in an equal aspect frame", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "circle" }, spec);

    expect(geometry.frame.width).toBe(74);
    expect(geometry.frame.height).toBe(74);
    expect(geometry.textBox).toEqual({ x: 12, y: 27, width: 50, height: 20 });
    expect(geometry.anchorsLocal.map((anchor) => anchor.key)).toEqual(["right", "bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right"]);
    expectPointClose(geometry.anchorsLocal[1], { x: 63.163, y: 63.163 });
    expectPointClose(geometry.anchorsLocal[5], { x: 10.837, y: 10.837 });
  });

  it("sizes diamond nodes as a square with enough room for centered text", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "diam" }, spec);

    expect(geometry.frame.width).toBe(106);
    expect(geometry.frame.height).toBe(106);
    expect(geometry.textBox).toEqual({ x: 28, y: 43, width: 50, height: 20 });
  });

  it("optically balances regular polygon nodes in an equal aspect frame", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "hex" }, spec);

    expect(geometry.frame.width).toBe(77);
    expect(geometry.frame.height).toBe(77);
    expect(geometry.textBox).toEqual({ x: 13.5, y: 28.5, width: 50, height: 20 });
  });

  it("gives equilateral triangles extra optical weight", () => {
    const geometry = buildNodeGeometry({ ...node, shape: "tri" }, spec);

    expect(geometry.frame.width).toBe(95);
    expect(geometry.frame.height).toBe(95);
    expect(geometry.textBox).toEqual({ x: 22.5, y: 37.5, width: 50, height: 20 });
  });
});
