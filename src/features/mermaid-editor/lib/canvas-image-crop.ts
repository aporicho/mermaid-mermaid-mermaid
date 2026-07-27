export type CanvasImageSourceCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function coverCanvasImageSourceCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): CanvasImageSourceCrop {
  const safeSourceWidth = positiveOrOne(sourceWidth);
  const safeSourceHeight = positiveOrOne(sourceHeight);
  const safeTargetWidth = positiveOrOne(targetWidth);
  const safeTargetHeight = positiveOrOne(targetHeight);
  const sourceAspect = safeSourceWidth / safeSourceHeight;
  const targetAspect = safeTargetWidth / safeTargetHeight;

  if (sourceAspect > targetAspect) {
    const width = safeSourceHeight * targetAspect;
    return { x: (safeSourceWidth - width) / 2, y: 0, width, height: safeSourceHeight };
  }

  const height = safeSourceWidth / targetAspect;
  return { x: 0, y: (safeSourceHeight - height) / 2, width: safeSourceWidth, height };
}

function positiveOrOne(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}
