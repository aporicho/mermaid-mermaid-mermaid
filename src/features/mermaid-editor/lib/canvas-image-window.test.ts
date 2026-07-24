import { describe, expect, it } from "vitest";

import { createBlankCanvasDocument, createCanvasImageElement } from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasDocumentImageForDoubleClick,
  canvasDocumentImageNavigation,
  graphImageNodeForDoubleClick,
  mermaidGraphImageNavigation
} from "@/features/mermaid-editor/lib/canvas-image-window";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

describe("canvas image window targets", () => {
  it("recognizes image elements without replacing normal text double-click behavior", () => {
    const document = createBlankCanvasDocument();
    const image = createCanvasImageElement(document.elements, 0, 0, "assets/cover.png");
    document.elements.push(image);

    expect(canvasDocumentImageForDoubleClick(document, { kind: "item", id: image.id })).toBe(image);
    expect(canvasDocumentImageForDoubleClick(document, { kind: "item", id: document.elements[0]!.id })).toBeNull();
  });

  it("recognizes only Mermaid nodes carrying an image asset", () => {
    const graph: MermaidGraph = {
      direction: "LR",
      nodes: [
        { id: "image", label: "封面", x: 0, y: 0, fill: "#fff", asset: { kind: "image", src: "assets/cover.png", width: 100, height: 80, preserveAspectRatio: true, labelPosition: "bottom" } },
        { id: "text", label: "文字", x: 0, y: 0, fill: "#fff" }
      ],
      edges: []
    };

    expect(graphImageNodeForDoubleClick(graph, { kind: "node", id: "image" })?.id).toBe("image");
    expect(graphImageNodeForDoubleClick(graph, { kind: "node", id: "text" })).toBeNull();
  });

  it("orders canvas document images from top to bottom and then left to right", () => {
    const document = createBlankCanvasDocument();
    document.elements = [
      createCanvasImageElement([], 300, 120, "c.png"),
      createCanvasImageElement([{ id: "C1" }], 220, 20, "b.png"),
      createCanvasImageElement([{ id: "C1" }, { id: "C2" }], 20, 20, "a.png")
    ];

    expect(canvasDocumentImageNavigation(document, "board.canvas").items.map((item) => item.title)).toEqual([
      "a.png",
      "b.png",
      "c.png"
    ]);
  });

  it("keeps Mermaid image navigation inside the selected node's direct group", () => {
    const image = (id: string, x: number, y: number) => ({
      id,
      label: id,
      x,
      y,
      fill: "#fff",
      asset: { kind: "image" as const, src: `${id}.png`, width: 100, height: 80, preserveAspectRatio: true, labelPosition: "bottom" as const }
    });
    const graph: MermaidGraph = {
      direction: "LR",
      nodes: [image("root-right", 300, 20), image("group-bottom", 20, 200), image("group-top", 100, 20), image("root-left", 20, 20)],
      edges: [],
      subgraphs: [{ id: "group", title: "分组", nodeIds: ["group-bottom", "group-top"] }]
    };

    expect(mermaidGraphImageNavigation(graph, "group-bottom", "diagram.mmd").items.map((item) => item.title)).toEqual([
      "group-top",
      "group-bottom"
    ]);
    expect(mermaidGraphImageNavigation(graph, "root-right", "diagram.mmd").items.map((item) => item.title)).toEqual([
      "root-left",
      "root-right"
    ]);
  });
});
