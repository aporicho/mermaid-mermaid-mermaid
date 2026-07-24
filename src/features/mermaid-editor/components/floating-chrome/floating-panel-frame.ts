import { EDITOR_CHROME_TOKENS } from "@/features/mermaid-editor/lib/editor-chrome";
import {
  FLOATING_PANEL_EDGE_MARGIN_PX,
  fitFloatingPanelFrameToViewport,
  type FloatingPanelFrame,
  type FloatingPanelPlacement,
  type FloatingPanelSize,
  type FloatingPanelViewport
} from "@/features/mermaid-editor/lib/floating-chrome";

export function currentFloatingPanelViewport(): FloatingPanelViewport {
  if (typeof window === "undefined") return { width: 1024, height: 768 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function initialFloatingPanelFrame({
  placement,
  size,
  minSize,
  viewport
}: {
  placement: FloatingPanelPlacement;
  size: FloatingPanelSize;
  minSize: FloatingPanelSize;
  viewport: FloatingPanelViewport;
}): FloatingPanelFrame {
  const margin = viewport.margin ?? FLOATING_PANEL_EDGE_MARGIN_PX;
  const width = Math.min(Math.max(size.width, minSize.width), Math.max(1, viewport.width - margin * 2));
  const height = Math.min(Math.max(size.height, minSize.height), Math.max(1, viewport.height - margin * 2));
  let x = margin;
  let y = margin;

  if (placement === "left-panel") {
    x = EDITOR_CHROME_TOKENS.sidePanelGapPx;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "right-panel") {
    x = viewport.width - EDITOR_CHROME_TOKENS.sidePanelGapPx - width;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "bottom-panel") {
    x = (viewport.width - width) / 2;
    y = viewport.height - 80 - height;
  } else if (placement === "center-panel") {
    x = (viewport.width - width) / 2;
    y = Math.max(EDITOR_CHROME_TOKENS.sidePanelTopBottomPx, (viewport.height - height) / 2);
  } else if (placement === "right") {
    x = viewport.width - margin - width;
    y = EDITOR_CHROME_TOKENS.sidePanelTopBottomPx;
  } else if (placement === "bottom-left") {
    x = margin;
    y = viewport.height - margin - height;
  }

  return fitFloatingPanelFrameToViewport({
    frame: { x, y, width, height },
    viewport,
    minSize
  });
}

export function isDragExcluded(target: Element) {
  return Boolean(
    target.closest(
      "button,a,input,textarea,select,[contenteditable='true'],[role='button'],[data-floating-panel-drag-exclude],[data-window-titlebar-drag-exclude]"
    )
  );
}
