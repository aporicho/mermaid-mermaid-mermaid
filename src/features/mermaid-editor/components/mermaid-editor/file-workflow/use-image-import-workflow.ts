import {
  canvasScreenToWorldPoint,
  windowPointToSurfacePoint,
  type DropPoint
} from "@/features/mermaid-editor/lib/file-drop";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { RuntimeFileOpenRequest, RuntimeFileRef, RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";
import { importImageBatch, type ImageImportBatchInput } from "@/features/mermaid-editor/lib/image-import-batch";

import type { BrowserDroppedFile } from "../use-editor-drop-import";
import type {
  ShowFileWorkflowError,
  UseEditorFileWorkflowArgs
} from "./types";
import {
  imageLabelFromSrc,
  loadImageDimensions,
  viewportCenterPoint
} from "./utils";
import {
  appendImportedCanvasImages,
  imageBatchImportStatus,
  importedGraphImageNodes,
  type ImportedImagePlacement
} from "./image-import-placement";

export function useImageImportWorkflow(
  args: UseEditorFileWorkflowArgs,
  {
    saveMermaidFileAsResult,
    showFileWorkflowError
  }: {
    saveMermaidFileAsResult: () => Promise<RuntimeFileRef | null>;
    showFileWorkflowError: ShowFileWorkflowError;
  }
) {
  const {
    runtime,
    workspaceSurfaceRef,
    documentKind,
    canvasDocument,
    viewport,
    workspaceView,
    fileRef,
    canvasLiveState,
    isCanvasEditable,
    setStatus,
    applyCanvasDocument,
    applyEditorCommand
  } = args;

  async function importBrowserDroppedImageAsset(file: BrowserDroppedFile, dropPosition?: DropPoint) {
    await importBrowserDroppedImageAssets([file], dropPosition);
  }

  async function importBrowserDroppedImageAssets(files: BrowserDroppedFile[], dropPosition?: DropPoint) {
    await importImageAssets(
      files.map((file) => ({ identity: file.path || file.name, source: file })),
      (input, targetFile) => input.source.path
        ? runtime.importImageAssetPath(targetFile, input.source.path)
        : runtime.importImageAssetFile(targetFile, input.source.file),
      dropPosition
    );
  }

  async function importImageAssetRequest(file: RuntimeFileOpenRequest, dropPosition?: DropPoint) {
    await importImageAssetRequests([file], dropPosition);
  }

  async function importImageAssetRequests(files: RuntimeFileOpenRequest[], dropPosition?: DropPoint) {
    await importImageAssets(
      files.map((file) => ({ identity: file.path, source: file })),
      (input, targetFile) => runtime.importImageAssetPath(targetFile, input.source.path),
      dropPosition
    );
  }

  async function importImageAssets<TSource>(
    inputs: ImageImportBatchInput<TSource>[],
    importer: (input: ImageImportBatchInput<TSource>, targetFile: RuntimeFileRef) => Promise<RuntimeImageAssetResult>,
    dropPosition?: DropPoint
  ) {
    if (!inputs.length) return;
    if (!canImportImages(inputs.map((input) => input.identity))) return;
    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    const batch = await importImageBatch(inputs, (input) => importer(input, targetFile));
    if (!batch.ready.length) {
      showBatchImportFailure(batch.failures);
      return;
    }

    const imported = await Promise.all(batch.ready.map(async (item) => ({
      ...item,
      dimensions: await loadImageDimensions(item.asset.displaySrc)
    })));
    applyImportedImageAssets(imported, dropPosition, batch.failures.length);
  }

  async function ensureDocumentFileForImageImport(): Promise<RuntimeFileRef | null> {
    if (fileRef?.path) return fileRef;
    const savedFile = await saveMermaidFileAsResult();
    if (savedFile?.path) return savedFile;
    if (savedFile && !savedFile.path) {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "网页版下载保存后没有稳定文件路径，无法复制本地图片资源。请使用桌面版保存到磁盘文件后再拖入图片。"
        },
        "无法导入图片。"
      );
    }
    return null;
  }

  function canImportImages(identities: string[]) {
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: identities[0]
        },
        "无法导入图片。"
      );
      return false;
    }
    const unsupported = identities.find((identity) => !isSupportedImagePath(identity));
    if (unsupported) {
      showFileWorkflowError({ code: "unsupported_type", path: unsupported }, "文件类型不支持。");
      return false;
    }
    return true;
  }

  function applyImportedImageAssets(
    imported: ImportedImagePlacement[],
    dropPosition: DropPoint | undefined,
    failedCount: number
  ) {
    const point = windowPointToCanvasWorldPoint(dropPosition) || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
    const message = imageBatchImportStatus(imported, failedCount, documentKind === "canvas" ? "图片" : "图片节点");
    if (documentKind === "canvas") {
      applyCanvasDocument(appendImportedCanvasImages(canvasDocument, imported, point), message);
      return;
    }
    applyEditorCommand({
      type: "graph.addNodesAt",
      nodes: importedGraphImageNodes(imported, point),
      message,
      source: "api"
    });
  }

  function showBatchImportFailure<TSource>(failures: Awaited<ReturnType<typeof importImageBatch<TSource>>>["failures"]) {
    const first = failures[0];
    if (failures.length === 1 && first?.failure.kind === "error") {
      showFileWorkflowError(first.failure.error, "导入图片失败。");
      return;
    }
    const names = failures.slice(0, 3).map((failure) => imageLabelFromSrc(failure.identity)).join("、");
    showFileWorkflowError(
      { code: "unsupported_type", message: `${failures.length} 张图片导入失败${names ? `：${names}` : ""}。` },
      "导入图片失败。"
    );
  }

  function windowPointToCanvasWorldPoint(point: DropPoint | undefined): DropPoint | undefined {
    const surface = workspaceSurfaceRef.current;
    if (!surface || !point) return undefined;
    return canvasScreenToWorldPoint(windowPointToSurfacePoint(point, surface.getBoundingClientRect()), viewport);
  }

  return {
    importBrowserDroppedImageAsset,
    importBrowserDroppedImageAssets,
    importImageAssetRequest,
    importImageAssetRequests
  };
}
