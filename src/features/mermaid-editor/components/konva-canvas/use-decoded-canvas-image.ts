import { useEffect, useState } from "react";

import { decodedCanvasImageCache } from "@/features/mermaid-editor/components/konva-canvas/decoded-canvas-image-cache";

export type DecodedCanvasImageState = {
  image: HTMLImageElement | null;
  status: "idle" | "loading" | "loaded" | "error";
};

const IDLE_STATE: DecodedCanvasImageState = { image: null, status: "idle" };
type SourceImageState = DecodedCanvasImageState & { src: string };

export function useDecodedCanvasImage(src: string): DecodedCanvasImageState {
  const cachedImage = src ? decodedCanvasImageCache.peek(src) : null;
  const [state, setState] = useState<SourceImageState>(() => sourceImageState(cachedImage, src));

  useEffect(() => {
    if (!src) {
      setState({ ...IDLE_STATE, src: "" });
      return;
    }

    let active = true;
    const retained = decodedCanvasImageCache.retain(src);
    const readyImage = decodedCanvasImageCache.peek(src);
    setState(sourceImageState(readyImage, src));
    if (!readyImage) {
      void retained.promise.then((image) => {
        if (!active) return;
        setState(image ? { src, image, status: "loaded" } : { src, image: null, status: "error" });
      });
    }

    return () => {
      active = false;
      retained.release();
    };
  }, [src]);

  return state.src === src ? state : sourceImageState(cachedImage, src);
}

function sourceImageState(image: HTMLImageElement | null, src: string): SourceImageState {
  if (image) return { src, image, status: "loaded" };
  return src ? { src, image: null, status: "loading" } : { ...IDLE_STATE, src: "" };
}
