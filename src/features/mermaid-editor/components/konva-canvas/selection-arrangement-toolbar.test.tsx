// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  resolveSelectionToolbarPosition,
  SelectionArrangementToolbar,
  shouldShowSelectionArrangementToolbar
} from "@/features/mermaid-editor/components/konva-canvas/selection-arrangement-toolbar";
import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";

const rects: AlignmentRect[] = [
  { id: "A", x: 100, y: 100, width: 80, height: 40 },
  { id: "B", x: 300, y: 180, width: 100, height: 60 },
  { id: "C", x: 500, y: 260, width: 120, height: 80 }
];

describe("selection arrangement toolbar", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  function renderToolbar(selectedRects: AlignmentRect[], onArrange = vi.fn()) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TooltipProvider delayDuration={0}>
          <SelectionArrangementToolbar
            rects={selectedRects}
            viewport={{ x: 0, y: 0, scale: 1 }}
            canvasSize={{ width: 960, height: 640 }}
            onArrange={onArrange}
          />
        </TooltipProvider>
      );
    });

    return onArrange;
  }

  it("renders all actions and disables spacing for two selected nodes", () => {
    const onArrange = renderToolbar(rects.slice(0, 2));
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"));

    expect(buttons).toHaveLength(8);
    expect(buttons.slice(0, 6).every((button) => !button.disabled)).toBe(true);
    expect(buttons.slice(6).every((button) => button.disabled)).toBe(true);

    act(() => buttons[0].click());
    expect(onArrange).toHaveBeenCalledWith("align-left");
  });

  it("enables both spacing actions for three selected nodes", () => {
    renderToolbar(rects);
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"));

    expect(buttons.every((button) => !button.disabled)).toBe(true);
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toContain("纵向等间距");
  });

  it("places the toolbar above the selection and flips below near the top edge", () => {
    expect(
      resolveSelectionToolbarPosition({
        selection: { id: "selection", x: 100, y: 100, width: 200, height: 100 },
        viewport: { x: 10, y: 20, scale: 2 },
        canvasSize: { width: 800, height: 600 },
        toolbarSize: { width: 400, height: 40 }
      })
    ).toEqual({ left: 210, top: 170, placement: "above" });

    expect(
      resolveSelectionToolbarPosition({
        selection: { id: "selection", x: 100, y: 2, width: 200, height: 40 },
        viewport: { x: 0, y: 0, scale: 1 },
        canvasSize: { width: 800, height: 600 },
        toolbarSize: { width: 400, height: 40 }
      })
    ).toEqual({ left: 8, top: 52, placement: "below" });
  });

  it("clamps toolbar placement to the canvas edges", () => {
    const position = resolveSelectionToolbarPosition({
      selection: { id: "selection", x: -300, y: 300, width: 50, height: 50 },
      viewport: { x: 0, y: 0, scale: 1 },
      canvasSize: { width: 800, height: 600 },
      toolbarSize: { width: 400, height: 40 }
    });

    expect(position.left).toBe(8);
    expect(position.top).toBe(250);
  });

  it("shows only for idle multi-node selection in manual select mode", () => {
    const visible = {
      selectedNodeCount: 2,
      mode: "select" as const,
      manualLayout: true,
      interactionKind: "idle",
      inlineEditing: false,
      contextMenuOpen: false
    };

    expect(shouldShowSelectionArrangementToolbar(visible)).toBe(true);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, selectedNodeCount: 1 })).toBe(false);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, mode: "connect" })).toBe(false);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, manualLayout: false })).toBe(false);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, interactionKind: "draggingNodes" })).toBe(false);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, inlineEditing: true })).toBe(false);
    expect(shouldShowSelectionArrangementToolbar({ ...visible, contextMenuOpen: true })).toBe(false);
  });
});
