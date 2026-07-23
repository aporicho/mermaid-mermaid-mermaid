export type EmbeddedBrowserRectInput = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius?: number;
};

export type EmbeddedBrowserLogicalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
};

export function embeddedBrowserLogicalRect(rect: EmbeddedBrowserRectInput): EmbeddedBrowserLogicalRect {
  return {
    x: Math.floor(rect.left),
    y: Math.floor(rect.top),
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height)),
    ...(Number.isFinite(rect.borderRadius) ? { borderRadius: Math.max(0, rect.borderRadius || 0) } : {})
  };
}

export function embeddedBrowserRectKey(rect: EmbeddedBrowserLogicalRect) {
  const bounds = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  return rect.borderRadius === undefined ? bounds : `${bounds}:r${rect.borderRadius}`;
}
