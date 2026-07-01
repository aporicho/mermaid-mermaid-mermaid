import type { DragEvent } from "react";

import {
  classifyFileDrop,
  windowPointToSurfacePoint,
  type DropPoint,
  type FileDropCandidate
} from "@/features/mermaid-editor/lib/file-drop";
import { documentKindLabel } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileDropRequest, RuntimeFileOpenRequest, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { isSupportedDocumentFilePath } from "@/features/mermaid-editor/lib/file-workflow";
import type { FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";

import {
  browserDroppedFiles,
  dragEventDropPoint,
  isExternalFileDrag,
  type BrowserDroppedFile
} from "../use-editor-drop-import";
import type {
  ApplyLoadedDocument,
  OpenRuntimeFileRequest,
  PrepareFileSwitch,
  ShowFileWorkflowError,
  UseEditorFileWorkflowArgs
} from "./types";
import { useImageImportWorkflow } from "./use-image-import-workflow";

export function useFileDropWorkflow(
  args: UseEditorFileWorkflowArgs,
  {
    applyLoadedDocument,
    openRuntimeFileRequest,
    prepareFileSwitch,
    saveMermaidFileAsResult,
    showFileWorkflowError
  }: {
    applyLoadedDocument: ApplyLoadedDocument;
    openRuntimeFileRequest: OpenRuntimeFileRequest;
    prepareFileSwitch: PrepareFileSwitch;
    saveMermaidFileAsResult: () => Promise<RuntimeFileRef | null>;
    showFileWorkflowError: ShowFileWorkflowError;
  }
) {
  const {
    workspaceSurfaceRef,
    documentKind,
    workspaceView,
    fileRef,
    isCanvasEditable,
    setStatus,
    setFileDropFeedback
  } = args;
  const {
    importBrowserDroppedImageAsset,
    importImageAssetRequest
  } = useImageImportWorkflow(args, {
    saveMermaidFileAsResult,
    showFileWorkflowError
  });

  function windowPointToWorkspacePoint(point: DropPoint | undefined): DropPoint | undefined {
    const surface = workspaceSurfaceRef.current;
    if (!surface || !point) return undefined;
    return windowPointToSurfacePoint(point, surface.getBoundingClientRect());
  }

  function dropFeedbackForFiles(files: FileDropCandidate[], position?: DropPoint): FileDropFeedback {
    const localPosition = windowPointToWorkspacePoint(position);
    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      return { message: `释放以打开 ${documentKindLabel(classification.documentKind)} 文件`, tone: "ready", position: localPosition };
    }
    if (classification.kind === "image") {
      if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
        return { message: "请切换到无限画布后拖入图片", tone: "blocked", position: localPosition };
      }
      return {
        message: fileRef?.path ? "释放以添加图片节点" : "释放后先保存文档再添加图片",
        tone: "ready",
        position: localPosition
      };
    }
    return { message: "不支持的文件类型", tone: "blocked", position: localPosition };
  }

  function updateBrowserFileDragFeedback(event: DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    if (files.length) {
      setFileDropFeedback(dropFeedbackForFiles(files, position));
      return;
    }
    setFileDropFeedback((current) =>
      current
        ? { ...current, position: windowPointToWorkspacePoint(position) || current.position }
        : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(position) }
    );
  }

  function handleBrowserFileDragLeave(event: DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setFileDropFeedback(null);
  }

  function handleBrowserFileDrop(event: DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    setFileDropFeedback(null);
    void handleBrowserDroppedFiles(files, position);
  }

  async function handleBrowserDroppedFiles(files: BrowserDroppedFile[], dropPosition?: DropPoint) {
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
      await openBrowserDroppedDocumentFile(classification.file);
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      await importBrowserDroppedImageAsset(classification.file, dropPosition);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path || classification.file?.name }, "文件类型不支持。");
  }

  async function openBrowserDroppedDocumentFile(file: BrowserDroppedFile) {
    const identity = file.path || file.name;
    if (!isSupportedDocumentFilePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return;
    }
    if (file.path) {
      await openRuntimeFileRequest({ name: file.name, path: file.path }, "drop");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      applyLoadedDocument(await file.file.text(), file.name, { name: file.name }, "drop");
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  function handleRuntimeFileDropRequest(request: RuntimeFileDropRequest) {
    if (request.type === "leave") {
      setFileDropFeedback(null);
      return;
    }

    if (request.type === "enter" || request.type === "over") {
      if (request.files.length) {
        setFileDropFeedback(dropFeedbackForFiles(request.files, request.position));
        return;
      }
      setFileDropFeedback((current) =>
        current
          ? { ...current, position: windowPointToWorkspacePoint(request.position) || current.position }
          : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(request.position) }
      );
      return;
    }

    setFileDropFeedback(null);
    handleRuntimeDroppedFiles(request.files, request.position);
  }

  function handleRuntimeDroppedFiles(files: RuntimeFileOpenRequest[], dropPosition?: DropPoint) {
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
      void openRuntimeFileRequest(classification.file, "drop");
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      void importImageAssetRequest(classification.file, dropPosition);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path }, "文件类型不支持。");
  }

  return {
    updateBrowserFileDragFeedback,
    handleBrowserFileDragLeave,
    handleBrowserFileDrop,
    importImageAssetRequest,
    handleRuntimeFileDropRequest
  };
}
