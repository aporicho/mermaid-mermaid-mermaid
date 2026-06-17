import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasGridSpec = {
  origin: { x: number; y: number };
  minorStep: number;
  majorEvery: number;
  minorAlpha: number;
  majorAlpha: number;
  superAlpha: number;
  minorRadiusPx: number;
  majorRadiusPx: number;
  superRadiusPx: number;
  maxDots: number;
  minorVisibleScale: number;
  majorVisibleScale: number;
};

export type CanvasGridBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type CanvasGridRenderLevel = {
  kind: "minor" | "major" | "super";
  step: number;
  radiusPx: number;
  alpha: number;
  skipStep?: number;
};

export type CanvasGridRenderPlan = {
  bounds: CanvasGridBounds;
  levels: CanvasGridRenderLevel[];
  estimatedDotCount: number;
};

export const DEFAULT_CANVAS_GRID: CanvasGridSpec = {
  origin: { x: 0, y: 0 },
  minorStep: 24,
  majorEvery: 5,
  minorAlpha: 0.18,
  majorAlpha: 0.3,
  superAlpha: 0.28,
  minorRadiusPx: 0.85,
  majorRadiusPx: 1.25,
  superRadiusPx: 1.3,
  maxDots: 5200,
  minorVisibleScale: 0.72,
  majorVisibleScale: 0.24
};

type Dimensions = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

export function getCanvasGridRenderPlan(dimensions: Dimensions, viewport: ViewportState, spec = DEFAULT_CANVAS_GRID): CanvasGridRenderPlan {
  const rawBounds = visibleWorldBounds(dimensions, viewport);
  const majorStep = gridMajorStep(spec);
  const minorCandidate: CanvasGridRenderLevel = {
    kind: "minor",
    step: spec.minorStep,
    radiusPx: spec.minorRadiusPx,
    alpha: spec.minorAlpha,
    skipStep: majorStep
  };
  const majorCandidate: CanvasGridRenderLevel = {
    kind: "major",
    step: majorStep,
    radiusPx: spec.majorRadiusPx,
    alpha: spec.majorAlpha
  };

  let levels: CanvasGridRenderLevel[];
  if (viewport.scale >= spec.minorVisibleScale) {
    levels = [minorCandidate, majorCandidate];
  } else if (viewport.scale >= spec.majorVisibleScale) {
    levels = [majorCandidate];
  } else {
    levels = [{ kind: "super", step: majorStep * 2, radiusPx: spec.superRadiusPx, alpha: spec.superAlpha }];
  }

  let bounds = padBounds(rawBounds, Math.max(...levels.map((level) => level.step)));
  while (estimatedDotCount(bounds, levels, spec) > spec.maxDots && levels.some((level) => level.kind === "minor")) {
    levels = levels.filter((level) => level.kind !== "minor");
    bounds = padBounds(rawBounds, Math.max(...levels.map((level) => level.step)));
  }

  while (estimatedDotCount(bounds, levels, spec) > spec.maxDots) {
    levels = levels.map((level) => ({ ...level, step: level.step * 2, skipStep: level.skipStep ? level.skipStep * 2 : undefined }));
    bounds = padBounds(rawBounds, Math.max(...levels.map((level) => level.step)));
  }

  return {
    bounds,
    levels,
    estimatedDotCount: estimatedDotCount(bounds, levels, spec)
  };
}

export function firstGridCoordinateAtOrAfter(value: number, step: number, origin = 0) {
  return Math.ceil((value - origin) / step) * step + origin;
}

export function isGridCoordinate(value: number, step: number, origin = 0) {
  return Math.abs((value - origin) / step - Math.round((value - origin) / step)) < 0.0001;
}

export function gridMajorStep(spec = DEFAULT_CANVAS_GRID) {
  return spec.minorStep * spec.majorEvery;
}

function visibleWorldBounds(dimensions: Dimensions, viewport: ViewportState): CanvasGridBounds {
  const left = -viewport.x / viewport.scale;
  const top = -viewport.y / viewport.scale;
  const right = (dimensions.width - viewport.x) / viewport.scale;
  const bottom = (dimensions.height - viewport.y) / viewport.scale;

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function padBounds(bounds: CanvasGridBounds, padding: number): CanvasGridBounds {
  const left = Math.floor((bounds.left - padding) / padding) * padding;
  const top = Math.floor((bounds.top - padding) / padding) * padding;
  const right = Math.ceil((bounds.right + padding) / padding) * padding;
  const bottom = Math.ceil((bounds.bottom + padding) / padding) * padding;

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function estimatedDotCount(bounds: CanvasGridBounds, levels: CanvasGridRenderLevel[], spec: CanvasGridSpec) {
  return levels.reduce((total, level) => total + countGridPoints(bounds, level.step, spec.origin), 0);
}

function countGridPoints(bounds: CanvasGridBounds, step: number, origin: Point) {
  const firstX = firstGridCoordinateAtOrAfter(bounds.left, step, origin.x);
  const firstY = firstGridCoordinateAtOrAfter(bounds.top, step, origin.y);
  const columns = Math.max(0, Math.floor((bounds.right - firstX) / step) + 1);
  const rows = Math.max(0, Math.floor((bounds.bottom - firstY) / step) + 1);

  return columns * rows;
}
