import { useCallback, useEffect, useSyncExternalStore } from "react";

import { decodedCanvasImageCache } from "@/features/mermaid-editor/components/konva-canvas/decoded-canvas-image-cache";

export type DecodedCanvasImageState = {
  image: HTMLImageElement | null;
  status: "idle" | "loading" | "loaded" | "error";
};

const IDLE_STATE: DecodedCanvasImageState = { image: null, status: "idle" };

export function useDecodedCanvasImage(src: string): DecodedCanvasImageState {
  const subscribe = useCallback(
    (listener: () => void) => decodedCanvasImageCache.subscribe(src, listener),
    [src]
  );
  const getSnapshot = useCallback(() => decodedCanvasImageCache.sourceSnapshot(src), [src]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);

  useEffect(() => {
    if (!src) return;
    const retained = decodedCanvasImageCache.retain(src);
    return retained.release;
  }, [src]);

  if (!src) return IDLE_STATE;
  if (snapshot?.state === "ready" && snapshot.image) return { image: snapshot.image, status: "loaded" };
  if (snapshot?.state === "failed") return { image: null, status: "error" };
  return { image: null, status: "loading" };
}
