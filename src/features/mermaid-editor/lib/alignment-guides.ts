export type AlignmentRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AlignmentGuide = {
  axis: "x" | "y";
  value: number;
  from: number;
  to: number;
  kind: "edge" | "center";
};

export type AlignmentSnapResult = {
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
};

type AlignmentCandidate = {
  kind: "edge" | "center";
  value: number;
};

type AxisSnap = {
  delta: number;
  guide: AlignmentGuide;
  distance: number;
};

const ALIGNMENT_THRESHOLD_PX = 6;

export function selectionBounds(rects: AlignmentRect[]): AlignmentRect | null {
  if (!rects.length) return null;

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    id: "selection",
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

export function computeAlignmentSnap(movingRect: AlignmentRect, staticRects: AlignmentRect[], viewportScale: number): AlignmentSnapResult {
  const thresholdWorld = ALIGNMENT_THRESHOLD_PX / Math.max(viewportScale, 0.01);
  const xSnap = bestAxisSnap("x", movingRect, staticRects, thresholdWorld);
  const ySnap = bestAxisSnap("y", movingRect, staticRects, thresholdWorld);

  return {
    dx: xSnap?.delta ?? 0,
    dy: ySnap?.delta ?? 0,
    guides: [xSnap?.guide, ySnap?.guide].filter(Boolean) as AlignmentGuide[]
  };
}

function bestAxisSnap(axis: "x" | "y", movingRect: AlignmentRect, staticRects: AlignmentRect[], thresholdWorld: number): AxisSnap | null {
  let best: AxisSnap | null = null;
  const movingCandidates = axisCandidates(axis, movingRect);

  for (const staticRect of staticRects) {
    const staticCandidates = axisCandidates(axis, staticRect);
    for (const moving of movingCandidates) {
      for (const target of staticCandidates) {
        const delta = target.value - moving.value;
        const distance = Math.abs(delta);
        if (distance > thresholdWorld) continue;
        if (best && distance >= best.distance) continue;

        best = {
          delta,
          distance,
          guide: buildGuide(axis, target.value, movingRect, staticRect, target.kind === "center" || moving.kind === "center" ? "center" : "edge")
        };
      }
    }
  }

  return best;
}

function axisCandidates(axis: "x" | "y", rect: AlignmentRect): AlignmentCandidate[] {
  if (axis === "x") {
    return [
      { kind: "edge", value: rect.x },
      { kind: "center", value: rect.x + rect.width / 2 },
      { kind: "edge", value: rect.x + rect.width }
    ];
  }

  return [
    { kind: "edge", value: rect.y },
    { kind: "center", value: rect.y + rect.height / 2 },
    { kind: "edge", value: rect.y + rect.height }
  ];
}

function buildGuide(axis: "x" | "y", value: number, movingRect: AlignmentRect, staticRect: AlignmentRect, kind: "edge" | "center"): AlignmentGuide {
  if (axis === "x") {
    const from = Math.min(movingRect.y, staticRect.y);
    const to = Math.max(movingRect.y + movingRect.height, staticRect.y + staticRect.height);
    return { axis, value, from, to, kind };
  }

  const from = Math.min(movingRect.x, staticRect.x);
  const to = Math.max(movingRect.x + movingRect.width, staticRect.x + staticRect.width);
  return { axis, value, from, to, kind };
}
