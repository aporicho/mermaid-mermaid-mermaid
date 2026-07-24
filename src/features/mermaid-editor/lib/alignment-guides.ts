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
  slot: "start" | "center" | "end";
  value: number;
};

type AxisSnap = {
  delta: number;
  guide: AlignmentGuide;
  distance: number;
};

export type AlignmentSnapIndex = {
  x: AlignmentIndexCandidate[];
  y: AlignmentIndexCandidate[];
};

type AlignmentIndexCandidate = AlignmentCandidate & {
  rect: AlignmentRect;
  rectIndex: number;
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
  return computeAlignmentSnapWithIndex(movingRect, createAlignmentSnapIndex(staticRects), viewportScale);
}

export function createAlignmentSnapIndex(staticRects: AlignmentRect[]): AlignmentSnapIndex {
  return {
    x: buildAxisIndex("x", staticRects),
    y: buildAxisIndex("y", staticRects)
  };
}

export function computeAlignmentSnapWithIndex(movingRect: AlignmentRect, index: AlignmentSnapIndex, viewportScale: number): AlignmentSnapResult {
  const thresholdWorld = ALIGNMENT_THRESHOLD_PX / Math.max(viewportScale, 0.01);
  const xSnap = bestIndexedAxisSnap("x", movingRect, index.x, thresholdWorld);
  const ySnap = bestIndexedAxisSnap("y", movingRect, index.y, thresholdWorld);

  return {
    dx: xSnap?.delta ?? 0,
    dy: ySnap?.delta ?? 0,
    guides: [xSnap?.guide, ySnap?.guide].filter(Boolean) as AlignmentGuide[]
  };
}

function bestIndexedAxisSnap(axis: "x" | "y", movingRect: AlignmentRect, index: AlignmentIndexCandidate[], thresholdWorld: number): AxisSnap | null {
  let best: AxisSnap | null = null;
  const movingCandidates = axisCandidates(axis, movingRect);
  const nearby: { moving: AlignmentCandidate; target: AlignmentIndexCandidate }[] = [];

  for (const moving of movingCandidates) {
    const start = lowerBound(index, moving.value - thresholdWorld);
    for (let candidateIndex = start; candidateIndex < index.length; candidateIndex += 1) {
      const target = index[candidateIndex];
      if (target.value > moving.value + thresholdWorld) break;
      if (moving.slot === target.slot) nearby.push({ moving, target });
    }
  }

  nearby.sort((left, right) => left.target.rectIndex - right.target.rectIndex || slotOrder(left.moving.slot) - slotOrder(right.moving.slot));

  for (const { moving, target } of nearby) {
    const delta = target.value - moving.value;
    const distance = Math.abs(delta);
    if (best && !isBetterSnap(distance, target.kind, best)) continue;

    best = {
      delta,
      distance,
      guide: buildGuide(axis, target.value, movingRect, target.rect, target.kind)
    };
  }

  return best;
}

function buildAxisIndex(axis: "x" | "y", rects: AlignmentRect[]) {
  return rects
    .flatMap((rect, rectIndex) => axisCandidates(axis, rect).map((candidate) => ({ ...candidate, rect, rectIndex })))
    .sort((left, right) => left.value - right.value || left.rectIndex - right.rectIndex || slotOrder(left.slot) - slotOrder(right.slot));
}

function lowerBound(index: AlignmentIndexCandidate[], value: number) {
  let low = 0;
  let high = index.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (index[middle].value < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function slotOrder(slot: AlignmentCandidate["slot"]) {
  return slot === "start" ? 0 : slot === "center" ? 1 : 2;
}

function isBetterSnap(distance: number, kind: "edge" | "center", best: AxisSnap) {
  if (distance < best.distance) return true;
  if (distance > best.distance) return false;
  return snapPriority(kind) > snapPriority(best.guide.kind);
}

function snapPriority(kind: "edge" | "center") {
  return kind === "center" ? 2 : 1;
}

function axisCandidates(axis: "x" | "y", rect: AlignmentRect): AlignmentCandidate[] {
  if (axis === "x") {
    return [
      { kind: "edge", slot: "start", value: rect.x },
      { kind: "center", slot: "center", value: rect.x + rect.width / 2 },
      { kind: "edge", slot: "end", value: rect.x + rect.width }
    ];
  }

  return [
    { kind: "edge", slot: "start", value: rect.y },
    { kind: "center", slot: "center", value: rect.y + rect.height / 2 },
    { kind: "edge", slot: "end", value: rect.y + rect.height }
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
