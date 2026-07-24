export const MIN_CANVAS_PIXEL_RATIO = 2;
export const MAX_CANVAS_PIXEL_RATIO = 3;

export function canvasPixelRatio(devicePixelRatio: number | null | undefined) {
  const ratio = typeof devicePixelRatio === "number" && Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1;
  return Math.min(MAX_CANVAS_PIXEL_RATIO, Math.max(MIN_CANVAS_PIXEL_RATIO, ratio));
}
