import type { DropPoint } from "@/features/mermaid-editor/lib/file-drop";

export type BatchImageSize = {
  width: number;
  height: number;
};

export const BATCH_IMAGE_LAYOUT_GAP = 32;

/**
 * Lays image centres out in stable, compact rows around the pointer drop point.
 * Edge-to-edge spacing is constant within a row and at least the configured gap
 * between rows, even when image cards have different dimensions.
 */
export function layoutBatchImageCenters(
  images: readonly BatchImageSize[],
  dropCenter: DropPoint
): DropPoint[] {
  if (!images.length) return [];
  if (images.length === 1) return [{ ...dropCenter }];

  const columnCount = Math.ceil(Math.sqrt(images.length));
  const rows = chunkImages(images, columnCount);
  const rowHeights = rows.map((row) => Math.max(...row.map((image) => image.height)));
  const totalHeight = rowHeights.reduce((height, rowHeight) => height + rowHeight, 0)
    + BATCH_IMAGE_LAYOUT_GAP * (rows.length - 1);
  const centers: DropPoint[] = [];
  let rowTop = dropCenter.y - totalHeight / 2;

  rows.forEach((row, rowIndex) => {
    const rowWidth = row.reduce((width, image) => width + image.width, 0)
      + BATCH_IMAGE_LAYOUT_GAP * (row.length - 1);
    let itemLeft = dropCenter.x - rowWidth / 2;

    row.forEach((image) => {
      centers.push({
        x: itemLeft + image.width / 2,
        y: rowTop + rowHeights[rowIndex] / 2
      });
      itemLeft += image.width + BATCH_IMAGE_LAYOUT_GAP;
    });

    rowTop += rowHeights[rowIndex] + BATCH_IMAGE_LAYOUT_GAP;
  });

  return centers;
}

function chunkImages(images: readonly BatchImageSize[], columnCount: number) {
  const rows: BatchImageSize[][] = [];
  for (let index = 0; index < images.length; index += columnCount) {
    rows.push(images.slice(index, index + columnCount));
  }
  return rows;
}
