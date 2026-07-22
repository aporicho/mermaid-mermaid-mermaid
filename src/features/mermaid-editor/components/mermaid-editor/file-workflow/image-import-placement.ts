import { layoutBatchImageCenters } from "@/features/mermaid-editor/lib/batch-image-layout";
import {
  createCanvasImageElement,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import type { RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DropPoint } from "@/features/mermaid-editor/lib/file-drop";
import { createImageAsset } from "@/features/mermaid-editor/lib/node-assets";

import { imageLabelFromSrc } from "./utils";

type ReadyImageAsset = Extract<RuntimeImageAssetResult, { status: "ready" }>;

export type ImportedImagePlacement = {
  asset: ReadyImageAsset;
  dimensions: { width: number; height: number };
};

export function appendImportedCanvasImages(
  document: CanvasDocument,
  imported: readonly ImportedImagePlacement[],
  dropCenter: DropPoint
): CanvasDocument {
  const elements = [...document.elements];
  const centers = layoutBatchImageCenters(imported.map((item) => item.dimensions), dropCenter);
  imported.forEach((item, index) => {
    const center = centers[index];
    elements.push(createCanvasImageElement(
      elements,
      center.x - item.dimensions.width / 2,
      center.y - item.dimensions.height / 2,
      item.asset.src,
      item.dimensions.width,
      item.dimensions.height
    ));
  });
  return { ...document, elements };
}

export function importedGraphImageNodes(
  imported: readonly ImportedImagePlacement[],
  dropCenter: DropPoint
) {
  const centers = layoutBatchImageCenters(imported.map((item) => item.dimensions), dropCenter);
  return imported.map((item, index) => ({
    point: centers[index],
    asset: createImageAsset({
      src: item.asset.src,
      width: item.dimensions.width,
      height: item.dimensions.height,
      preserveAspectRatio: true,
      labelPosition: "bottom"
    }),
    label: imageLabelFromSrc(item.asset.src)
  }));
}

export function imageBatchImportStatus(
  imported: readonly ImportedImagePlacement[],
  failedCount: number,
  targetLabel: "图片" | "图片节点"
) {
  const copied = imported.some((item) => item.asset.copied);
  const added = imported.length === 1
    ? `${copied ? "已复制并添加拖入的" : "已添加拖入的"}${targetLabel}。`
    : `${copied ? "已复制并添加" : "已添加"} ${imported.length} 张${targetLabel}。`;
  return failedCount ? `${added.slice(0, -1)}，${failedCount} 张导入失败。` : added;
}
