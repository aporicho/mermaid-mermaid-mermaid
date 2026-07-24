import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

export const FLOATING_CHROME_HIDE_DELAY_MS = 500;
export const FLOATING_PANEL_EDGE_MARGIN_PX = 12;
export const FLOATING_PANEL_MIN_VISIBLE_TITLE_PX = 48;
export const FLOATING_PANEL_MIN_VISIBLE_TOP_EDGE_PX = 8;
export const FLOATING_WORKSPACE_PANEL_BASE_Z_INDEX = OVERLAY_Z_INDEX.workspaceBase;
export const FLOATING_POPOVER_PANEL_Z_INDEX = OVERLAY_Z_INDEX.floatingPopover;

export type FloatingPanelPlacement =
  | "top-left"
  | "right"
  | "bottom-left"
  | "left-panel"
  | "right-panel"
  | "center-panel"
  | "bottom-panel";

export type FloatingPanelOffset = {
  x: number;
  y: number;
};

export type FloatingPanelSize = {
  width: number;
  height: number;
};

export type FloatingPanelFrame = FloatingPanelOffset & FloatingPanelSize;

export type FloatingPanelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type FloatingPanelViewport = {
  width: number;
  height: number;
  margin?: number;
};

export type FloatingPanelKind = "popover" | "workspace";
export type FloatingPanelDismissMode = "outside" | "explicit";
export type FloatingPanelWindowState = "normal" | "fullscreen";
export type FloatingPanelResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const FLOATING_PANEL_HIDDEN_OFFSETS: Record<FloatingPanelPlacement, FloatingPanelOffset> = {
  "top-left": { x: 0, y: -10 },
  right: { x: 10, y: -8 },
  "bottom-left": { x: 0, y: 10 },
  "left-panel": { x: -18, y: 0 },
  "right-panel": { x: 18, y: 0 },
  "center-panel": { x: 0, y: 14 },
  "bottom-panel": { x: 0, y: 18 }
};

export type FloatingChromeVisibilityInput = {
  hovered?: boolean;
  focusWithin?: boolean;
  pinned?: boolean;
};

export function shouldRevealFloatingGroup(input: FloatingChromeVisibilityInput) {
  return Boolean(input.hovered || input.focusWithin || input.pinned);
}

export function floatingPanelHiddenOffset(placement: FloatingPanelPlacement) {
  return FLOATING_PANEL_HIDDEN_OFFSETS[placement];
}

export function defaultFloatingPanelDismissMode(kind: FloatingPanelKind): FloatingPanelDismissMode {
  return kind === "popover" ? "outside" : "explicit";
}

export function shouldDragFloatingPanel(kind: FloatingPanelKind, draggable?: boolean) {
  return draggable ?? (kind === "workspace");
}

export function bringFloatingPanelToFront<T extends string>(stack: readonly T[], panelId: T): T[] {
  return [...stack.filter((item) => item !== panelId), panelId];
}

export function floatingPanelStackIndex<T extends string>(stack: readonly T[], panelId: T) {
  return Math.max(0, stack.indexOf(panelId));
}

export function floatingPanelZIndex(kind: FloatingPanelKind, stackIndex = 0) {
  if (kind === "popover") return FLOATING_POPOVER_PANEL_Z_INDEX;
  return FLOATING_WORKSPACE_PANEL_BASE_Z_INDEX + Math.max(0, stackIndex);
}

export function constrainFloatingPanelOffset({
  desired,
  startOffset,
  startRect,
  viewport
}: {
  desired: FloatingPanelOffset;
  startOffset: FloatingPanelOffset;
  startRect: FloatingPanelRect;
  viewport: FloatingPanelViewport;
}): FloatingPanelOffset {
  const margin = viewport.margin ?? FLOATING_PANEL_EDGE_MARGIN_PX;
  const width = Math.max(1, startRect.right - startRect.left);
  const visibleWidth = Math.min(FLOATING_PANEL_MIN_VISIBLE_TITLE_PX, width, Math.max(1, (viewport.width - margin * 2) / 2));
  const left = startRect.left + desired.x - startOffset.x;
  const top = startRect.top + desired.y - startOffset.y;
  const constrainedLeft = clamp(left, margin + visibleWidth - width, viewport.width - margin - visibleWidth);
  const constrainedTop = clamp(top, margin, viewport.height - margin - FLOATING_PANEL_MIN_VISIBLE_TOP_EDGE_PX);
  return {
    x: desired.x + constrainedLeft - left,
    y: desired.y + constrainedTop - top
  };
}

export function constrainFloatingPanelFrame({
  frame,
  viewport,
  minSize = { width: 320, height: 220 }
}: {
  frame: FloatingPanelFrame;
  viewport: FloatingPanelViewport;
  minSize?: FloatingPanelSize;
}): FloatingPanelFrame {
  const margin = viewport.margin ?? FLOATING_PANEL_EDGE_MARGIN_PX;
  const width = Math.max(minSize.width, frame.width);
  const height = Math.max(minSize.height, frame.height);
  const visibleWidth = Math.min(FLOATING_PANEL_MIN_VISIBLE_TITLE_PX, width, Math.max(1, (viewport.width - margin * 2) / 2));
  return {
    x: clamp(frame.x, margin + visibleWidth - width, viewport.width - margin - visibleWidth),
    y: clamp(frame.y, margin, viewport.height - margin - FLOATING_PANEL_MIN_VISIBLE_TOP_EDGE_PX),
    width,
    height
  };
}

export function fitFloatingPanelFrameToViewport({
  frame,
  viewport,
  minSize = { width: 320, height: 220 }
}: {
  frame: FloatingPanelFrame;
  viewport: FloatingPanelViewport;
  minSize?: FloatingPanelSize;
}): FloatingPanelFrame {
  const margin = viewport.margin ?? FLOATING_PANEL_EDGE_MARGIN_PX;
  const maxWidth = Math.max(1, viewport.width - margin * 2);
  const maxHeight = Math.max(1, viewport.height - margin * 2);
  const minWidth = Math.min(minSize.width, maxWidth);
  const minHeight = Math.min(minSize.height, maxHeight);
  const width = clamp(frame.width, minWidth, maxWidth);
  const height = clamp(frame.height, minHeight, maxHeight);

  return {
    x: clamp(frame.x, margin, viewport.width - margin - width),
    y: clamp(frame.y, margin, viewport.height - margin - height),
    width,
    height
  };
}

export function resizeFloatingPanelFrame({
  startFrame,
  handle,
  delta,
  viewport,
  minSize = { width: 320, height: 220 }
}: {
  startFrame: FloatingPanelFrame;
  handle: FloatingPanelResizeHandle;
  delta: FloatingPanelOffset;
  viewport: FloatingPanelViewport;
  minSize?: FloatingPanelSize;
}): FloatingPanelFrame {
  let x = startFrame.x;
  let y = startFrame.y;
  let width = startFrame.width;
  let height = startFrame.height;

  if (handle.includes("e")) width = startFrame.width + delta.x;
  if (handle.includes("s")) height = startFrame.height + delta.y;
  if (handle.includes("w")) {
    x = startFrame.x + delta.x;
    width = startFrame.width - delta.x;
  }
  if (handle.includes("n")) {
    y = startFrame.y + delta.y;
    height = startFrame.height - delta.y;
  }

  if (width < minSize.width) {
    if (handle.includes("w")) x = startFrame.x + startFrame.width - minSize.width;
    width = minSize.width;
  }
  if (height < minSize.height) {
    if (handle.includes("n")) y = startFrame.y + startFrame.height - minSize.height;
    height = minSize.height;
  }

  return constrainFloatingPanelFrame({
    frame: { x, y, width, height },
    viewport,
    minSize
  });
}

export function fullscreenFloatingPanelFrame({
  viewport
}: {
  viewport: FloatingPanelViewport;
}): FloatingPanelFrame {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, viewport.width),
    height: Math.max(1, viewport.height)
  };
}

export function restoreFloatingPanelFrame({
  frame,
  viewport,
  minSize
}: {
  frame: FloatingPanelFrame;
  viewport: FloatingPanelViewport;
  minSize?: FloatingPanelSize;
}): FloatingPanelFrame {
  return fitFloatingPanelFrameToViewport({ frame, viewport, minSize });
}

function clamp(value: number, min: number, max: number) {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
