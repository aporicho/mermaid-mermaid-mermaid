import type { EditorCanvasSize } from "@/features/mermaid-editor/lib/editor-interaction-state";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { isRuntimeAbortError } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  DEFAULT_IMAGE_ASSET_HEIGHT,
  DEFAULT_IMAGE_ASSET_WIDTH
} from "@/features/mermaid-editor/lib/node-assets";

export function isAbortError(error: unknown) {
  return isRuntimeAbortError(error);
}

export function imageLabelFromSrc(src: string) {
  return src.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || "图片";
}

export function viewportCenterPoint(viewport: ViewportState, canvasSize?: EditorCanvasSize) {
  const width = canvasSize?.width || 840;
  const height = canvasSize?.height || 520;
  return {
    x: (width / 2 - viewport.x) / viewport.scale,
    y: (height / 2 - viewport.y) / viewport.scale
  };
}

export async function loadImageDimensions(src: string) {
  if (typeof window === "undefined" || !src) return { width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT };

  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_ASSET_WIDTH;
      const height = image.naturalHeight || DEFAULT_IMAGE_ASSET_HEIGHT;
      const maxSide = Math.max(width, height, 1);
      const scale = maxSide > 360 ? 360 / maxSide : 1;
      resolve({
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
      });
    };
    image.onerror = () => resolve({ width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT });
    image.src = src;
  });
}
