import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import {
  fitFloatingPanelFrameToViewport,
  type FloatingPanelFrame,
  type FloatingPanelPlacement,
  type FloatingPanelSize,
  type FloatingPanelViewport
} from "@/features/mermaid-editor/lib/floating-chrome";

import { currentFloatingPanelViewport, initialFloatingPanelFrame } from "./floating-panel-frame";

export function useFloatingPanelInitialFrameRequests({
  placement, resolvedDefaultSize, initialFrame, initialFrameKey, initialFrameSize, initialFrameSizeKey,
  resolvedMinSize, framePanel, open, resetFrameOnOpen, panelFrame, setPanelFrame, fullscreen, normalFrameRef
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
  panelFrame: FloatingPanelFrame;
  setPanelFrame: Dispatch<SetStateAction<FloatingPanelFrame>>;
  fullscreen: boolean;
  normalFrameRef: MutableRefObject<FloatingPanelFrame | null>;
}) {
  const preserveExplicitPositionRef = useRef(Boolean(initialFrame));
  const latestPanelPositionRef = useRef({ x: panelFrame.x, y: panelFrame.y });
  const appliedInitialFrameKeyRef = useRef<string | null>(initialFrame ? initialFrameKey ?? "initial" : null);
  const appliedInitialFrameSizeKeyRef = useRef<string | null>(initialFrameSize ? initialFrameSizeKey ?? "initial" : null);
  latestPanelPositionRef.current = { x: panelFrame.x, y: panelFrame.y };

  useEffect(() => {
    if (!framePanel || !open || !resetFrameOnOpen || initialFrame) return;
    const nextFrame = initialFloatingPanelFrame({
      placement, size: resolvedDefaultSize, minSize: resolvedMinSize, viewport: currentFloatingPanelViewport()
    });
    preserveExplicitPositionRef.current = false;
    latestPanelPositionRef.current = { x: nextFrame.x, y: nextFrame.y };
    setPanelFrame(nextFrame);
  }, [framePanel, initialFrame, open, placement, resetFrameOnOpen, resolvedDefaultSize, resolvedMinSize, setPanelFrame]);

  useEffect(() => {
    const requestKey = initialFrameKey ?? "initial";
    if (appliedInitialFrameKeyRef.current === requestKey || !framePanel || !open || !initialFrame) return;
    const nextFrame = fitFloatingPanelFrameToViewport({ frame: initialFrame, viewport: currentFloatingPanelViewport(), minSize: resolvedMinSize });
    appliedInitialFrameKeyRef.current = requestKey;
    preserveExplicitPositionRef.current = true;
    latestPanelPositionRef.current = { x: nextFrame.x, y: nextFrame.y };
    setPanelFrame(nextFrame);
    if (fullscreen && normalFrameRef.current) normalFrameRef.current = nextFrame;
  }, [framePanel, fullscreen, initialFrame, initialFrameKey, normalFrameRef, open, resolvedMinSize, setPanelFrame]);

  useEffect(() => {
    const requestKey = initialFrameSizeKey ?? "initial";
    if (appliedInitialFrameSizeKeyRef.current === requestKey || !framePanel || !open || !initialFrameSize) return;
    const nextFrame = preserveExplicitPositionRef.current
      ? fitFloatingPanelFrameToViewport({
          frame: { ...latestPanelPositionRef.current, ...initialFrameSize },
          viewport: currentFloatingPanelViewport(),
          minSize: resolvedMinSize
        })
      : centeredInitialFloatingPanelFrame(placement, initialFrameSize, resolvedMinSize, currentFloatingPanelViewport());
    appliedInitialFrameSizeKeyRef.current = requestKey;
    latestPanelPositionRef.current = { x: nextFrame.x, y: nextFrame.y };
    setPanelFrame(nextFrame);
    if (fullscreen && normalFrameRef.current) normalFrameRef.current = nextFrame;
  }, [framePanel, fullscreen, initialFrameSize, initialFrameSizeKey, normalFrameRef, open, placement, resolvedMinSize, setPanelFrame]);
}

export function centeredInitialFloatingPanelFrame(
  placement: FloatingPanelPlacement,
  size: FloatingPanelSize,
  minSize: FloatingPanelSize,
  viewport: FloatingPanelViewport
) {
  const frame = initialFloatingPanelFrame({ placement, size, minSize, viewport });
  if (placement !== "center-panel") return frame;
  return fitFloatingPanelFrameToViewport({
    frame: { ...frame, x: (viewport.width - frame.width) / 2, y: (viewport.height - frame.height) / 2 },
    viewport,
    minSize
  });
}
