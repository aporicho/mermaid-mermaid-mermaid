import { useEffect, useMemo, useRef } from "react";

import { CanvasNodeTextureCacheController } from "@/features/mermaid-editor/components/konva-canvas/canvas-node-texture-cache";
import { canvasPixelRatio } from "@/features/mermaid-editor/lib/canvas-render-quality";
import type { InteractionState } from "@/features/mermaid-editor/lib/canvas-interaction";

export function useCanvasNodeTextureCache({
  panningRequested,
  interactionKind,
  inlineEditing
}: {
  panningRequested: boolean;
  interactionKind: InteractionState["kind"];
  inlineEditing: boolean;
}) {
  const controller = useMemo(() => new CanvasNodeTextureCacheController(), []);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (destroyTimerRef.current !== null) clearTimeout(destroyTimerRef.current);
    destroyTimerRef.current = null;
    controller.activate();
    controller.configureCanvasPixelRatio(canvasPixelRatio(globalThis.devicePixelRatio));
    return () => {
      destroyTimerRef.current = setTimeout(() => {
        destroyTimerRef.current = null;
        controller.destroy();
      }, 0);
    };
  }, [controller]);

  useEffect(() => {
    controller.setInteractionActive(panningRequested || interactionKind !== "idle" || inlineEditing);
  }, [controller, inlineEditing, interactionKind, panningRequested]);

  return controller;
}
