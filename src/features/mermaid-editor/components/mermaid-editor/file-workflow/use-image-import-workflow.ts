import {
  createCanvasImageElement
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  canvasScreenToWorldPoint,
  windowPointToSurfacePoint,
  type DropPoint
} from "@/features/mermaid-editor/lib/file-drop";
import { createImageAsset, isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { RuntimeFileOpenRequest, RuntimeFileRef, RuntimeImageAssetResult } from "@/features/mermaid-editor/lib/editor-runtime";

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
    const identity = file.path || file.name;
    if (!canImportImage(identity)) return;

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = file.path ? await runtime.importImageAssetPath(targetFile, file.path) : await runtime.importImageAssetFile(targetFile, file.file);
      await applyImportedImageAssetResult(result, identity, dropPosition);
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
  }

  async function importImageAssetRequest(file: RuntimeFileOpenRequest, dropPosition?: DropPoint) {
    if (!canImportImage(file.path)) return;

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = await runtime.importImageAssetPath(targetFile, file.path);
      await applyImportedImageAssetResult(result, file.path, dropPosition);
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
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

  function canImportImage(identity: string) {
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: identity
        },
        "无法导入图片。"
      );
      return false;
    }
    if (!isSupportedImagePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return false;
    }
    return true;
  }

  async function applyImportedImageAssetResult(result: RuntimeImageAssetResult, sourcePath: string, dropPosition?: DropPoint) {
    if (result.status !== "ready") {
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: sourcePath }, "文件类型不支持。");
      }
      if (result.status === "needs-document") {
        showFileWorkflowError({ code: "unsupported_type", message: "请先保存当前文档，再拖入本地图片。", path: sourcePath }, "无法导入图片。");
      }
      return;
    }

    const dimensions = await loadImageDimensions(result.displaySrc);
    const point = windowPointToCanvasWorldPoint(dropPosition) || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
    if (documentKind === "canvas") {
      const element = createCanvasImageElement(
        canvasDocument.elements,
        point.x - dimensions.width / 2,
        point.y - dimensions.height / 2,
        result.src,
        dimensions.width,
        dimensions.height
      );
      applyCanvasDocument({ ...canvasDocument, elements: [...canvasDocument.elements, element] }, result.copied ? "已复制并添加拖入的图片。" : "已添加拖入的图片。");
      return;
    }
    applyEditorCommand({
      type: "graph.addImageNodeAt",
      point,
      asset: createImageAsset({
        src: result.src,
        width: dimensions.width,
        height: dimensions.height,
        preserveAspectRatio: true,
        labelPosition: "bottom"
      }),
      label: imageLabelFromSrc(result.src),
      message: result.copied ? "已复制并添加拖入的图片节点。" : "已添加拖入的图片节点。",
      source: "api"
    });
  }

  function windowPointToCanvasWorldPoint(point: DropPoint | undefined): DropPoint | undefined {
    const surface = workspaceSurfaceRef.current;
    if (!surface || !point) return undefined;
    return canvasScreenToWorldPoint(windowPointToSurfacePoint(point, surface.getBoundingClientRect()), viewport);
  }

  return {
    importBrowserDroppedImageAsset,
    importImageAssetRequest
  };
}
