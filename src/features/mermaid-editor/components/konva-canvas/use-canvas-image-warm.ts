import { useEffect } from "react";

import { decodedCanvasImageCache } from "@/features/mermaid-editor/components/konva-canvas/decoded-canvas-image-cache";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";

export function useCanvasImageWarm(nodes: CanvasNode[], imageDisplaySrcBySrc: Record<string, string>) {
  useEffect(() => {
    const sources = new Set<string>();
    for (const node of nodes) {
      if (node.asset?.kind === "image" && node.asset.src.trim()) sources.add(node.asset.src.trim());
      if (node.preview?.kind === "link-card" && node.preview.cover?.src.trim()) sources.add(node.preview.cover.src.trim());
    }
    for (const source of sources) {
      void decodedCanvasImageCache.warm(imageDisplaySrcBySrc[source] || source);
    }
  }, [imageDisplaySrcBySrc, nodes]);
}
