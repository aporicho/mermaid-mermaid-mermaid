export type EmbeddedBrowserRectInput = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type EmbeddedBrowserLogicalRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function embeddedBrowserLogicalRect(rect: EmbeddedBrowserRectInput): EmbeddedBrowserLogicalRect {
  return {
    x: Math.floor(rect.left),
    y: Math.floor(rect.top),
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height))
  };
}

export function embeddedBrowserRectKey(rect: EmbeddedBrowserLogicalRect) {
  return `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
}
