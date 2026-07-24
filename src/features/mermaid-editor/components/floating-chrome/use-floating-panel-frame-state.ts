import { useEffect, useRef, useState } from "react";

import {
  fitFloatingPanelFrameToViewport,
  fullscreenFloatingPanelFrame,
  restoreFloatingPanelFrame,
  type FloatingPanelFrame,
  type FloatingPanelPlacement,
  type FloatingPanelSize,
  type FloatingPanelViewport,
  type FloatingPanelWindowState
} from "@/features/mermaid-editor/lib/floating-chrome";

import {
  currentFloatingPanelViewport,
  initialFloatingPanelFrame
} from "./floating-panel-frame";

export function useFloatingPanelFrameState({
  placement,
  resolvedDefaultSize,
  initialFrameSize,
  resolvedMinSize,
  framePanel,
  open,
  resetFrameOnOpen,
  windowState
}: {
  placement: FloatingPanelPlacement;
  resolvedDefaultSize: FloatingPanelSize;
  initialFrameSize?: FloatingPanelSize;
  resolvedMinSize: FloatingPanelSize;
  framePanel: boolean;
  open: boolean;
  resetFrameOnOpen: boolean;
  windowState: FloatingPanelWindowState;
}) {
  const [viewport, setViewport] = useState<FloatingPanelViewport>(() => currentFloatingPanelViewport());
  const [panelFrame, setPanelFrame] = useState<FloatingPanelFrame>(() =>
    centeredInitialFrame(placement, initialFrameSize ?? resolvedDefaultSize, resolvedMinSize, currentFloatingPanelViewport())
  );
  const didApplyInitialFrameSizeRef = useRef(Boolean(initialFrameSize));
  const normalFrameRef = useRef<FloatingPanelFrame | null>(null);
  const previousWindowStateRef = useRef<FloatingPanelWindowState>(windowState);
  const fullscreen = framePanel && windowState === "fullscreen";
  const renderedFrame = fullscreen ? fullscreenFloatingPanelFrame({ viewport }) : panelFrame;

  useEffect(() => {
    if (!framePanel || !open || !resetFrameOnOpen) return;
    setPanelFrame(
      initialFloatingPanelFrame({
        placement,
        size: resolvedDefaultSize,
        minSize: resolvedMinSize,
        viewport: currentFloatingPanelViewport()
      })
    );
  }, [framePanel, open, placement, resetFrameOnOpen, resolvedDefaultSize, resolvedMinSize]);

  useEffect(() => {
    function updateViewport() {
      const nextViewport = currentFloatingPanelViewport();
      setViewport(nextViewport);
      if (!framePanel) return;
      setPanelFrame((current) =>
        restoreFloatingPanelFrame({
          frame: current,
          viewport: nextViewport,
          minSize: resolvedMinSize
        })
      );
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [framePanel, resolvedMinSize]);

  useEffect(() => {
    if (!framePanel || !open) {
      previousWindowStateRef.current = windowState;
      return;
    }
    const previousWindowState = previousWindowStateRef.current;
    if (windowState === "fullscreen" && previousWindowState !== "fullscreen") {
      normalFrameRef.current = panelFrame;
    }
    if (windowState === "normal" && previousWindowState === "fullscreen" && normalFrameRef.current) {
      setPanelFrame(
        restoreFloatingPanelFrame({
          frame: normalFrameRef.current,
          viewport,
          minSize: resolvedMinSize
        })
      );
      normalFrameRef.current = null;
    }
    previousWindowStateRef.current = windowState;
  }, [framePanel, open, panelFrame, resolvedMinSize, viewport, windowState]);

  useEffect(() => {
    if (didApplyInitialFrameSizeRef.current || !framePanel || !open || !initialFrameSize) return;
    const nextFrame = centeredInitialFrame(placement, initialFrameSize, resolvedMinSize, currentFloatingPanelViewport());
    didApplyInitialFrameSizeRef.current = true;
    setPanelFrame(nextFrame);
    if (fullscreen && normalFrameRef.current) normalFrameRef.current = nextFrame;
  }, [framePanel, fullscreen, initialFrameSize, open, placement, resolvedMinSize]);

  return {
    viewport,
    panelFrame,
    setPanelFrame,
    renderedFrame,
    fullscreen
  };
}

function centeredInitialFrame(placement: FloatingPanelPlacement, size: FloatingPanelSize, minSize: FloatingPanelSize, viewport: FloatingPanelViewport) {
  const frame = initialFloatingPanelFrame({ placement, size, minSize, viewport });
  if (placement !== "center-panel") return frame;
  return fitFloatingPanelFrameToViewport({
    frame: { ...frame, x: (viewport.width - frame.width) / 2, y: (viewport.height - frame.height) / 2 },
    viewport,
    minSize
  });
}
