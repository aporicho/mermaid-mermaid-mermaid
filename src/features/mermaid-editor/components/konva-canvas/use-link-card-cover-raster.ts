import { useEffect, useMemo, useState } from "react";

import {
  linkCardCoverRasterCache,
  resolveLinkCardCoverRasterRequest,
  type LinkCardCoverRasterInput
} from "@/features/mermaid-editor/components/konva-canvas/link-card-cover-raster";

export type LinkCardCoverRasterState = {
  image: ImageBitmap | null;
  status: "idle" | "loading" | "loaded" | "error";
};

const IDLE_RASTER_STATE: LinkCardCoverRasterState = { image: null, status: "idle" };

export function useLinkCardCoverRaster(input: LinkCardCoverRasterInput | null): LinkCardCoverRasterState {
  const src = input?.src || "";
  const width = input?.width || 0;
  const height = input?.height || 0;
  const radius = input?.radius || 0;
  const devicePixelRatio = input?.devicePixelRatio;
  const request = useMemo(
    () => src ? resolveLinkCardCoverRasterRequest({ src, width, height, radius, devicePixelRatio }) : null,
    [devicePixelRatio, height, radius, src, width]
  );
  const [state, setState] = useState<LinkCardCoverRasterState>(request ? { image: null, status: "loading" } : IDLE_RASTER_STATE);

  useEffect(() => {
    if (!request?.src) {
      setState(IDLE_RASTER_STATE);
      return;
    }

    let active = true;
    const retained = linkCardCoverRasterCache.retain(request);
    setState({ image: null, status: "loading" });
    void retained.promise.then((raster) => {
      if (!active) return;
      setState(raster ? { image: raster.image, status: "loaded" } : { image: null, status: "error" });
    });

    return () => {
      active = false;
      retained.release();
    };
  }, [request]);

  return state;
}
