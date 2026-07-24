import type { CanvasNodeAsset, ImageLabelPosition } from "@/features/mermaid-editor/lib/editor-types";

export const DEFAULT_IMAGE_ASSET_WIDTH = 160;
export const DEFAULT_IMAGE_ASSET_HEIGHT = 120;
export const DEFAULT_IMAGE_LABEL_POSITION: ImageLabelPosition = "bottom";
export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".ico"] as const;

export function createImageAsset(input: Partial<CanvasNodeAsset> & { src: string }): CanvasNodeAsset {
  return {
    kind: "image",
    src: input.src.trim(),
    width: normalizePositiveNumber(input.width, DEFAULT_IMAGE_ASSET_WIDTH),
    height: normalizePositiveNumber(input.height, DEFAULT_IMAGE_ASSET_HEIGHT),
    preserveAspectRatio: input.preserveAspectRatio ?? true,
    labelPosition: normalizeImageLabelPosition(input.labelPosition)
  };
}

export function normalizeImageAsset(asset: CanvasNodeAsset | undefined): CanvasNodeAsset | undefined {
  if (!asset || asset.kind !== "image" || !asset.src.trim()) return undefined;

  return {
    kind: "image",
    src: asset.src.trim(),
    width: normalizePositiveNumber(asset.width, DEFAULT_IMAGE_ASSET_WIDTH),
    height: normalizePositiveNumber(asset.height, DEFAULT_IMAGE_ASSET_HEIGHT),
    preserveAspectRatio: asset.preserveAspectRatio ?? true,
    labelPosition: normalizeImageLabelPosition(asset.labelPosition)
  };
}

export function normalizeImageLabelPosition(value: unknown): ImageLabelPosition {
  return value === "top" || value === "t" ? "top" : DEFAULT_IMAGE_LABEL_POSITION;
}

export function mermaidImagePosition(value: ImageLabelPosition | undefined) {
  return value === "top" ? "t" : "b";
}

export function imageLabelPositionFromMermaid(value: unknown): ImageLabelPosition {
  return value === "t" || value === "top" ? "top" : DEFAULT_IMAGE_LABEL_POSITION;
}

export function isSupportedImagePath(path: string | undefined | null) {
  const lower = (path || "").toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}
