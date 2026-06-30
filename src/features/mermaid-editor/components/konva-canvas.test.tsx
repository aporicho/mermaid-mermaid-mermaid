// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-konva", () => {
  const MockKonvaComponent = () => null;

  return {
    Arrow: MockKonvaComponent,
    Circle: MockKonvaComponent,
    Ellipse: MockKonvaComponent,
    Group: MockKonvaComponent,
    Image: MockKonvaComponent,
    Layer: MockKonvaComponent,
    Line: MockKonvaComponent,
    Path: MockKonvaComponent,
    Rect: MockKonvaComponent,
    Shape: MockKonvaComponent,
    Stage: MockKonvaComponent,
    Text: MockKonvaComponent
  };
});

import { NodeContextMenu } from "@/features/mermaid-editor/components/konva-canvas";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

const node: CanvasNode = {
  id: "A",
  label: "Alpha",
  x: 0,
  y: 0,
  fill: "#ffffff",
  action: {
    kind: "url",
    url: "https://example.com",
    openMode: "app-browser"
  }
};

function dispatchPointerDown(target: EventTarget) {
  target.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
}

describe("NodeContextMenu", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    container?.remove();
    container = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function renderMenu(onClose = vi.fn()) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(createElement(NodeContextMenu, {
        menu: { nodeId: node.id, x: 120, y: 80 },
        node,
        onClose
      }));
    });

    return onClose;
  }

  it("closes when pointer interaction starts outside the menu", () => {
    const onClose = renderMenu();

    act(() => dispatchPointerDown(document.body));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the menu open when interacting inside the menu", () => {
    const onClose = renderMenu();
    const menuButton = document.body.querySelector("button");
    if (!menuButton) throw new Error("Expected node context menu button.");

    act(() => dispatchPointerDown(menuButton));

    expect(onClose).not.toHaveBeenCalled();
  });
});
