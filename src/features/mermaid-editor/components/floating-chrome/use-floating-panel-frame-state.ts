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

import { currentFloatingPanelViewport } from "./floating-panel-frame";
import {
  centeredInitialFloatingPanelFrame,
  useFloatingPanelInitialFrameRequests
} from "./use-floating-panel-initial-frame-requests";

export function useFloatingPanelFrameState({
  placement,
  resolvedDefaultSize,
  initialFrame,
  initialFrameKey,
  initialFrameSize,
  initialFrameSizeKey,
  resolvedMinSize,
  framePanel,
  open,
  resetFrameOnOpen,
  windowState
}: {
  placement: FloatingPanelPlacement;
  resolvedDefaultSize: FloatingPanelSize;
  initialFrame?: FloatingPanelFrame;
  initialFrameKey?: string;
  initialFrameSize?: FloatingPanelSize;
  initialFrameSizeKey?: string;
  resolvedMinSize: FloatingPanelSize;
  framePanel: boolean;
  open: boolean;
  resetFrameOnOpen: boolean;
  windowState: FloatingPanelWindowState;
}) {
  const [viewport, setViewport] = useState<FloatingPanelViewport>(() => currentFloatingPanelViewport());
  const [panelFrame, setPanelFrame] = useState<FloatingPanelFrame>(() => {
    const initialViewport = currentFloatingPanelViewport();
    return initialFrame
      ? fitFloatingPanelFrameToViewport({ frame: initialFrame, viewport: initialViewport, minSize: resolvedMinSize })
      : centeredInitialFloatingPanelFrame(placement, initialFrameSize ?? resolvedDefaultSize, resolvedMinSize, initialViewport);
  });
  const normalFrameRef = useRef<FloatingPanelFrame | null>(null);
  const previousWindowStateRef = useRef<FloatingPanelWindowState>(windowState);
  const fullscreen = framePanel && windowState === "fullscreen";
  const renderedFrame = fullscreen ? fullscreenFloatingPanelFrame({ viewport }) : panelFrame;

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

  useFloatingPanelInitialFrameRequests({
    placement, resolvedDefaultSize, initialFrame, initialFrameKey, initialFrameSize, initialFrameSizeKey,
    resolvedMinSize, framePanel, open, resetFrameOnOpen, panelFrame, setPanelFrame, fullscreen, normalFrameRef
  });

  return {
    viewport,
    panelFrame,
    setPanelFrame,
    renderedFrame,
    fullscreen
  };
}
