export type EdgeLabelPoint = {
  x: number;
  y: number;
};

export type EdgeLabelRect = EdgeLabelPoint & {
  width: number;
  height: number;
};

export type EdgeLabelGeometrySpec = {
  minChars: number;
  maxChars: number;
  paddingX: number;
  height: number;
  measureText: (value: string) => number;
};

export type EdgeLabelGeometry = {
  frame: EdgeLabelRect;
  textBox: EdgeLabelRect;
};

export function buildEdgeLabelGeometry(label: string, center: EdgeLabelPoint, spec: EdgeLabelGeometrySpec): EdgeLabelGeometry {
  const textWidth = edgeLabelTextWidth(label, spec);
  const width = textWidth + spec.paddingX * 2;
  const frame = {
    x: center.x - width / 2,
    y: center.y - spec.height / 2,
    width,
    height: spec.height
  };

  return {
    frame,
    textBox: {
      x: spec.paddingX,
      y: 0,
      width: textWidth,
      height: spec.height
    }
  };
}

export function edgeLabelTextWidth(label: string, spec: EdgeLabelGeometrySpec) {
  const characterWidth = spec.measureText("中");
  const minWidth = spec.minChars * characterWidth;
  const maxWidth = spec.maxChars * characterWidth;
  const preferredWidth = Math.ceil(spec.measureText(edgeLabelSingleLineText(label)));

  return clamp(preferredWidth, minWidth, maxWidth);
}

export function edgeLabelSingleLineText(label: string) {
  return (label || " ").replace(/\r?\n/g, " ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
