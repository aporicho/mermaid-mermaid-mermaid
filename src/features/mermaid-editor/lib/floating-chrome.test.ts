import { describe, expect, it } from "vitest";

import {
  FLOATING_CHROME_HIDE_DELAY_MS,
  FLOATING_PANEL_EDGE_MARGIN_PX,
  FLOATING_PANEL_HEADER_HOT_ZONE_PX,
  FLOATING_PANEL_MIN_VISIBLE_TITLE_PX,
  FLOATING_POPOVER_PANEL_Z_INDEX,
  FLOATING_WORKSPACE_PANEL_BASE_Z_INDEX,
  bringFloatingPanelToFront,
  constrainFloatingPanelFrame,
  constrainFloatingPanelOffset,
  defaultFloatingPanelDismissMode,
  floatingPanelStackIndex,
  floatingPanelHiddenOffset,
  floatingPanelZIndex,
  fitFloatingPanelFrameToViewport,
  fullscreenFloatingPanelFrame,
  resizeFloatingPanelFrame,
  restoreFloatingPanelFrame,
  shouldDragFloatingPanel,
  shouldRevealFloatingGroup
} from "@/features/mermaid-editor/lib/floating-chrome";

describe("floating chrome", () => {
  it("reveals a group while hovered, focused, or pinned", () => {
    expect(shouldRevealFloatingGroup({ hovered: true })).toBe(true);
    expect(shouldRevealFloatingGroup({ focusWithin: true })).toBe(true);
    expect(shouldRevealFloatingGroup({ pinned: true })).toBe(true);
    expect(shouldRevealFloatingGroup({})).toBe(false);
  });

  it("uses a short delayed hide interval", () => {
    expect(FLOATING_CHROME_HIDE_DELAY_MS).toBe(500);
  });

  it("defines directional entrance offsets for floating panels", () => {
    expect(floatingPanelHiddenOffset("top-left")).toEqual({ x: 0, y: -10 });
    expect(floatingPanelHiddenOffset("left-panel").x).toBeLessThan(0);
    expect(floatingPanelHiddenOffset("right-panel").x).toBeGreaterThan(0);
    expect(floatingPanelHiddenOffset("bottom-panel").y).toBeGreaterThan(0);
  });

  it("separates popover and workspace panel behavior defaults", () => {
    expect(defaultFloatingPanelDismissMode("popover")).toBe("outside");
    expect(defaultFloatingPanelDismissMode("workspace")).toBe("explicit");
    expect(shouldDragFloatingPanel("popover")).toBe(false);
    expect(shouldDragFloatingPanel("workspace")).toBe(true);
    expect(shouldDragFloatingPanel("workspace", false)).toBe(false);
  });

  it("brings a workspace panel to the front of the focus stack", () => {
    const stack = ["explorer", "inspector", "terminal"] as const;

    expect(bringFloatingPanelToFront(stack, "inspector")).toEqual(["explorer", "terminal", "inspector"]);
    expect(bringFloatingPanelToFront(stack, "terminal")).toEqual(["explorer", "inspector", "terminal"]);
  });

  it("maps workspace stack position and popovers to local isolated z-indexes", () => {
    const stack = ["explorer", "terminal", "inspector"] as const;

    expect(floatingPanelStackIndex(stack, "terminal")).toBe(1);
    expect(floatingPanelZIndex("workspace", 0)).toBe(FLOATING_WORKSPACE_PANEL_BASE_Z_INDEX);
    expect(floatingPanelZIndex("workspace", 2)).toBe(FLOATING_WORKSPACE_PANEL_BASE_Z_INDEX + 2);
    expect(floatingPanelZIndex("popover", 99)).toBe(FLOATING_POPOVER_PANEL_Z_INDEX);
    expect(floatingPanelZIndex("popover", 99)).toBe(1);
  });

  it("keeps a recoverable titlebar strip when dragging offset panels beyond the viewport", () => {
    const constrained = constrainFloatingPanelOffset({
      desired: { x: 900, y: -120 },
      startOffset: { x: 0, y: 0 },
      startRect: { left: 100, top: 80, right: 420, bottom: 360 },
      viewport: { width: 800, height: 600 }
    });

    expect(constrained).toEqual({
      x: 800 - FLOATING_PANEL_EDGE_MARGIN_PX - FLOATING_PANEL_MIN_VISIBLE_TITLE_PX - 100,
      y: FLOATING_PANEL_EDGE_MARGIN_PX - 80
    });
  });

  it("keeps panel frames recoverable while preserving their minimum size", () => {
    const constrained = constrainFloatingPanelFrame({
      frame: { x: -40, y: 590, width: 920, height: 80 },
      viewport: { width: 800, height: 600 },
      minSize: { width: 320, height: 220 }
    });

    expect(constrained).toEqual({
      x: -40,
      y: 600 - FLOATING_PANEL_EDGE_MARGIN_PX - FLOATING_PANEL_HEADER_HOT_ZONE_PX,
      width: 920,
      height: 220
    });
  });

  it("keeps at least 48px of either horizontal titlebar edge reachable", () => {
    const viewport = { width: 800, height: 600 };
    const minSize = { width: 320, height: 220 };

    expect(constrainFloatingPanelFrame({
      frame: { x: -900, y: 12, width: 640, height: 480 },
      viewport,
      minSize
    }).x).toBe(FLOATING_PANEL_EDGE_MARGIN_PX + FLOATING_PANEL_MIN_VISIBLE_TITLE_PX - 640);
    expect(constrainFloatingPanelFrame({
      frame: { x: 900, y: 12, width: 640, height: 480 },
      viewport,
      minSize
    }).x).toBe(800 - FLOATING_PANEL_EDGE_MARGIN_PX - FLOATING_PANEL_MIN_VISIBLE_TITLE_PX);
  });

  it("fits newly opened panel frames inside the viewport margin", () => {
    const fitted = fitFloatingPanelFrameToViewport({
      frame: { x: -40, y: 590, width: 920, height: 80 },
      viewport: { width: 800, height: 600 },
      minSize: { width: 320, height: 220 }
    });

    expect(fitted).toEqual({
      x: FLOATING_PANEL_EDGE_MARGIN_PX,
      y: 600 - FLOATING_PANEL_EDGE_MARGIN_PX - 220,
      width: 800 - FLOATING_PANEL_EDGE_MARGIN_PX * 2,
      height: 220
    });
  });

  it("resizes panel frames from edges while preserving minimum size", () => {
    const startFrame = { x: 200, y: 120, width: 360, height: 260 };

    expect(
      resizeFloatingPanelFrame({
        startFrame,
        handle: "se",
        delta: { x: 80, y: 60 },
        viewport: { width: 900, height: 700 },
        minSize: { width: 320, height: 220 }
      })
    ).toEqual({ x: 200, y: 120, width: 440, height: 320 });

    expect(
      resizeFloatingPanelFrame({
        startFrame,
        handle: "nw",
        delta: { x: 120, y: 90 },
        viewport: { width: 900, height: 700 },
        minSize: { width: 320, height: 220 }
      })
    ).toEqual({ x: 240, y: 160, width: 320, height: 220 });
  });

  it("builds a true fullscreen panel frame", () => {
    expect(fullscreenFloatingPanelFrame({ viewport: { width: 1000, height: 720 } })).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 720
    });
  });

  it("restores saved panel frames through the normal constraints", () => {
    expect(
      restoreFloatingPanelFrame({
        frame: { x: 120, y: 90, width: 420, height: 300 },
        viewport: { width: 900, height: 700 },
        minSize: { width: 320, height: 220 }
      })
    ).toEqual({ x: 120, y: 90, width: 420, height: 300 });
  });

  it("fits saved panel frames after the viewport becomes smaller", () => {
    expect(
      restoreFloatingPanelFrame({
        frame: { x: 640, y: 420, width: 900, height: 760 },
        viewport: { width: 800, height: 600 },
        minSize: { width: 320, height: 220 }
      })
    ).toEqual({
      x: FLOATING_PANEL_EDGE_MARGIN_PX,
      y: FLOATING_PANEL_EDGE_MARGIN_PX,
      width: 800 - FLOATING_PANEL_EDGE_MARGIN_PX * 2,
      height: 600 - FLOATING_PANEL_EDGE_MARGIN_PX * 2
    });
  });
});
