import { isAbsoluteRuntimePath, joinRuntimePath, parentDirectoryPath } from "@/features/mermaid-editor/lib/runtime-paths";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type ImageViewerMode = "fit" | "actual";
export type ImageViewerViewMode = ImageViewerMode | "auto" | "manual";

export const IMAGE_VIEWER_MIN_ZOOM = 0.05;
export const IMAGE_VIEWER_MAX_ZOOM = 16;

export function clampImageViewerZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(IMAGE_VIEWER_MAX_ZOOM, Math.max(IMAGE_VIEWER_MIN_ZOOM, value));
}

export function imageViewerZoomBounds(scale: number) {
  const current = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    min: Math.min(IMAGE_VIEWER_MIN_ZOOM, current / 100),
    max: Math.max(IMAGE_VIEWER_MAX_ZOOM, current * 100)
  };
}

export function normalizeImageViewerRotation(value: number) {
  const normalized = Math.round(value / 90) * 90 % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function imageViewerLayout({
  naturalWidth,
  naturalHeight,
  viewportWidth,
  viewportHeight,
  rotation,
  mode,
  zoom,
  padding = 0
}: {
  naturalWidth: number;
  naturalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  rotation: number;
  mode: ImageViewerMode;
  zoom: number;
  padding?: number;
}) {
  const quarterTurn = normalizeImageViewerRotation(rotation) % 180 !== 0;
  const rotatedWidth = quarterTurn ? naturalHeight : naturalWidth;
  const rotatedHeight = quarterTurn ? naturalWidth : naturalHeight;
  const availableWidth = Math.max(1, viewportWidth - padding);
  const availableHeight = Math.max(1, viewportHeight - padding);
  const fitScale = rotatedWidth > 0 && rotatedHeight > 0
    ? Math.min(availableWidth / rotatedWidth, availableHeight / rotatedHeight)
    : 1;
  const requestedScale = (mode === "fit" ? fitScale : 1) * zoom;
  const scale = mode === "fit"
    ? (Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1)
    : clampImageViewerZoom(requestedScale);
  return {
    scale,
    stageWidth: Math.max(1, rotatedWidth * scale),
    stageHeight: Math.max(1, rotatedHeight * scale)
  };
}

export function imageViewerNavigationDirectionForKey(key: string): -1 | 1 | null {
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  return null;
}

export function imageViewerPresetViewport(input: {
  naturalWidth: number;
  naturalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  rotation: number;
  mode: ImageViewerMode;
  padding?: number;
}): ViewportState {
  const layout = imageViewerLayout({ ...input, zoom: 1 });
  return {
    x: input.viewportWidth / 2,
    y: input.viewportHeight / 2,
    scale: layout.scale
  };
}

export function imageViewerInitialViewport(input: Omit<Parameters<typeof imageViewerPresetViewport>[0], "mode">): ViewportState {
  const fitted = imageViewerPresetViewport({ ...input, mode: "fit" });
  return { ...fitted, scale: Math.min(1, fitted.scale) };
}

export function imageViewerInitialWindowSize(input: {
  naturalWidth: number;
  naturalHeight: number;
  applicationWidth: number;
  applicationHeight: number;
  chromeWidth: number;
  chromeHeight: number;
  margin: number;
}) {
  const maxOuterWidth = Math.max(1, input.applicationWidth - input.margin * 2);
  const maxOuterHeight = Math.max(1, input.applicationHeight - input.margin * 2);
  const chromeWidth = Math.max(0, input.chromeWidth);
  const chromeHeight = Math.max(0, input.chromeHeight);
  const naturalWidth = Math.max(1, input.naturalWidth);
  const naturalHeight = Math.max(1, input.naturalHeight);
  const scale = Math.min(
    1,
    Math.max(1, maxOuterWidth - chromeWidth) / naturalWidth,
    Math.max(1, maxOuterHeight - chromeHeight) / naturalHeight
  );
  return {
    width: Math.min(maxOuterWidth, naturalWidth * scale + chromeWidth),
    height: Math.min(maxOuterHeight, naturalHeight * scale + chromeHeight)
  };
}

export function revisionedImageViewerSrc(src: string, revision = 0) {
  if (!src || revision <= 0 || /^(?:data|blob):/i.test(src)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}viewerRevision=${revision}`;
}

export function imageViewerWatchPath(source: string, documentPath?: string) {
  const value = source.trim();
  if (!value || /^(?:https?:|data:|blob:|mmm-asset:|file:)/i.test(value)) return "";
  if (isAbsoluteRuntimePath(value)) return value;
  const directory = parentDirectoryPath(documentPath);
  return directory ? joinRuntimePath(directory, value) : "";
}
