import { selectionBounds, type AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";

export const NODE_ALIGNMENT_OPERATIONS = [
  "align-left",
  "align-horizontal-center",
  "align-right",
  "align-top",
  "align-vertical-center",
  "align-bottom"
] as const;

export const NODE_SPACING_OPERATIONS = [
  "distribute-horizontal-spacing",
  "distribute-vertical-spacing"
] as const;

export type NodeAlignmentOperation = (typeof NODE_ALIGNMENT_OPERATIONS)[number];
export type NodeSpacingOperation = (typeof NODE_SPACING_OPERATIONS)[number];
export type NodeArrangementOperation = NodeAlignmentOperation | NodeSpacingOperation;
export type NodePositions = Record<string, { x: number; y: number }>;

const OPERATION_LABELS: Record<NodeArrangementOperation, string> = {
  "align-left": "左对齐",
  "align-horizontal-center": "水平居中对齐",
  "align-right": "右对齐",
  "align-top": "顶部对齐",
  "align-vertical-center": "垂直居中对齐",
  "align-bottom": "底部对齐",
  "distribute-horizontal-spacing": "横向等间距",
  "distribute-vertical-spacing": "纵向等间距"
};

type SpacingAxis = "x" | "y";

export function arrangeNodeRects(rects: AlignmentRect[], operation: NodeArrangementOperation): NodePositions {
  if (!rects.length) return {};
  if (isNodeSpacingOperation(operation)) return spaceNodeRects(rects, operation);

  const bounds = selectionBounds(rects);
  if (!bounds) return currentPositions(rects);

  return Object.fromEntries(
    rects.map((rect) => {
      if (operation === "align-left") return [rect.id, { x: bounds.x, y: rect.y }];
      if (operation === "align-horizontal-center") {
        return [rect.id, { x: bounds.x + bounds.width / 2 - rect.width / 2, y: rect.y }];
      }
      if (operation === "align-right") {
        return [rect.id, { x: bounds.x + bounds.width - rect.width, y: rect.y }];
      }
      if (operation === "align-top") return [rect.id, { x: rect.x, y: bounds.y }];
      if (operation === "align-vertical-center") {
        return [rect.id, { x: rect.x, y: bounds.y + bounds.height / 2 - rect.height / 2 }];
      }
      return [rect.id, { x: rect.x, y: bounds.y + bounds.height - rect.height }];
    })
  );
}

export function isNodeSpacingOperation(operation: NodeArrangementOperation): operation is NodeSpacingOperation {
  return operation.endsWith("-spacing");
}

export function nodeArrangementLabel(operation: NodeArrangementOperation) {
  return OPERATION_LABELS[operation];
}

function spaceNodeRects(rects: AlignmentRect[], operation: NodeSpacingOperation): NodePositions {
  if (rects.length < 3) return currentPositions(rects);

  const axis: SpacingAxis = operation === "distribute-horizontal-spacing" ? "x" : "y";
  const indexed = rects.map((rect, index) => ({ rect, index }));
  indexed.sort((left, right) => {
    const delta = centerValue(left.rect, axis) - centerValue(right.rect, axis);
    return delta || left.index - right.index;
  });

  const firstStart = startValue(indexed[0].rect, axis);
  const lastEnd = endValue(indexed[indexed.length - 1].rect, axis);
  const occupied = indexed.reduce((total, item) => total + sizeValue(item.rect, axis), 0);
  const gap = (lastEnd - firstStart - occupied) / (indexed.length - 1);
  const positions = currentPositions(rects);
  let cursor = firstStart;

  indexed.forEach(({ rect }, index) => {
    const target = index === 0 || index === indexed.length - 1 ? startValue(rect, axis) : cursor;
    positions[rect.id] = axis === "x"
      ? { x: target, y: rect.y }
      : { x: rect.x, y: target };
    cursor = target + sizeValue(rect, axis) + gap;
  });

  return positions;
}

function startValue(rect: AlignmentRect, axis: SpacingAxis) {
  return axis === "x" ? rect.x : rect.y;
}

function sizeValue(rect: AlignmentRect, axis: SpacingAxis) {
  return axis === "x" ? rect.width : rect.height;
}

function centerValue(rect: AlignmentRect, axis: SpacingAxis) {
  return startValue(rect, axis) + sizeValue(rect, axis) / 2;
}

function endValue(rect: AlignmentRect, axis: SpacingAxis) {
  return startValue(rect, axis) + sizeValue(rect, axis);
}

function currentPositions(rects: AlignmentRect[]): NodePositions {
  return Object.fromEntries(rects.map((rect) => [rect.id, { x: rect.x, y: rect.y }]));
}
