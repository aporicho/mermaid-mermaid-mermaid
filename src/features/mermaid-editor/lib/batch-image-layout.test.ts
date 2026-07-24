import { describe, expect, it } from "vitest";

import {
  BATCH_IMAGE_LAYOUT_GAP,
  layoutBatchImageCenters
} from "@/features/mermaid-editor/lib/batch-image-layout";

describe("batch image layout", () => {
  it("returns no positions for an empty batch", () => {
    expect(layoutBatchImageCenters([], { x: 100, y: 200 })).toEqual([]);
  });

  it("places one image exactly at the drop point", () => {
    expect(layoutBatchImageCenters([{ width: 240, height: 160 }], { x: 100, y: 200 })).toEqual([
      { x: 100, y: 200 }
    ]);
  });

  it("lays images out in stable row-major order with fixed edge gaps", () => {
    const sizes = [
      { width: 100, height: 80 },
      { width: 160, height: 120 },
      { width: 80, height: 60 },
      { width: 120, height: 100 }
    ];

    const centers = layoutBatchImageCenters(sizes, { x: 500, y: 400 });

    expect(centers).toEqual([
      { x: 404, y: 334 },
      { x: 566, y: 334 },
      { x: 424, y: 476 },
      { x: 556, y: 476 }
    ]);
    expect(leftEdge(centers[1], sizes[1]) - rightEdge(centers[0], sizes[0])).toBe(BATCH_IMAGE_LAYOUT_GAP);
    expect(leftEdge(centers[3], sizes[3]) - rightEdge(centers[2], sizes[2])).toBe(BATCH_IMAGE_LAYOUT_GAP);
  });

  it("centres a partial final row and the complete layout on the drop point", () => {
    const sizes = [
      { width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 100, height: 100 }
    ];
    const dropPoint = { x: 300, y: 250 };
    const centers = layoutBatchImageCenters(sizes, dropPoint);

    expect(centers).toEqual([
      { x: 234, y: 184 },
      { x: 366, y: 184 },
      { x: 300, y: 316 }
    ]);
    expect(boundsCenter(centers, sizes)).toEqual(dropPoint);
  });

  it("does not mutate the supplied sizes or drop point", () => {
    const sizes = [{ width: 100, height: 80 }, { width: 120, height: 90 }];
    const dropPoint = { x: 10, y: 20 };
    const originalSizes = structuredClone(sizes);
    const originalDropPoint = { ...dropPoint };

    layoutBatchImageCenters(sizes, dropPoint);

    expect(sizes).toEqual(originalSizes);
    expect(dropPoint).toEqual(originalDropPoint);
  });
});

function leftEdge(center: { x: number }, size: { width: number }) {
  return center.x - size.width / 2;
}

function rightEdge(center: { x: number }, size: { width: number }) {
  return center.x + size.width / 2;
}

function boundsCenter(
  centers: { x: number; y: number }[],
  sizes: { width: number; height: number }[]
) {
  const left = Math.min(...centers.map((center, index) => center.x - sizes[index].width / 2));
  const right = Math.max(...centers.map((center, index) => center.x + sizes[index].width / 2));
  const top = Math.min(...centers.map((center, index) => center.y - sizes[index].height / 2));
  const bottom = Math.max(...centers.map((center, index) => center.y + sizes[index].height / 2));
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}
