import { useEffect, useRef, useState } from "react";

import {
  maximizedFloatingPanelFrame,
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
  resolvedMinSize,
  framePanel,
  open,
  resetFrameOnOpen,
  windowState
}: {
  placement: FloatingPanelPlacement;
  resolvedDefaultSize: FloatingPanelSize;
  resolvedMinSize: FloatingPanelSize;
  framePanel: boolean;
  open: boolean;
  resetFrameOnOpen: boolean;
  windowState: FloatingPanelWindowState;
}) {
  const [viewport, setViewport] = useState<FloatingPanelViewport>(() => currentFloatingPanelViewport());
  const [panelFrame, setPanelFrame] = useState<FloatingPanelFrame>(() =>
    initialFloatingPanelFrame({
      placement,
      size: resolvedDefaultSize,
      minSize: resolvedMinSize,
      viewport: currentFloatingPanelViewport()
    })
  );
  const normalFrameRef = useRef<FloatingPanelFrame | null>(null);
  const previousWindowStateRef = useRef<FloatingPanelWindowState>(windowState);
  const maximized = framePanel && windowState === "maximized";
  const renderedFrame = maximized ? maximizedFloatingPanelFrame({ viewport }) : panelFrame;

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
    if (windowState === "maximized" && previousWindowState !== "maximized") {
      normalFrameRef.current = panelFrame;
    }
    if (windowState === "normal" && previousWindowState === "maximized" && normalFrameRef.current) {
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

  return {
    viewport,
    panelFrame,
    setPanelFrame,
    renderedFrame,
    maximized
  };
}
