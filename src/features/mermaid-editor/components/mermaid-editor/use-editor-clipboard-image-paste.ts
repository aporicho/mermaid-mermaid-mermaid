import { useCallback, type Dispatch, type SetStateAction } from "react";

import {
  imageLabelFromSrc,
  loadImageDimensions,
  viewportCenterPoint,
  type CanvasLiveState
} from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { normalizeFileWorkflowError, type FileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { createImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

type UseEditorClipboardImagePasteArgs = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  workspaceView: WorkspaceView;
  isCanvasEditable: boolean;
  fileRef: RuntimeFileRef | null;
  viewport: ViewportState;
  canvasLiveState: CanvasLiveState;
  lastCanvasPointerWorldRef: { current: { x: number; y: number } | null };
  applyEditorCommand: (command: EditorCommand) => void;
  setStatus: Dispatch<SetStateAction<string>>;
  setFileWorkflowError: Dispatch<SetStateAction<FileWorkflowError | null>>;
};

export function useEditorClipboardImagePaste({
  runtime,
  documentKind,
  workspaceView,
  isCanvasEditable,
  fileRef,
  viewport,
  canvasLiveState,
  lastCanvasPointerWorldRef,
  applyEditorCommand,
  setStatus,
  setFileWorkflowError
}: UseEditorClipboardImagePasteArgs) {
  const pasteClipboardImageNode = useCallback(async (file: File) => {
    if (runtime.kind !== "desktop") return;
    if (documentKind !== "mermaid" || workspaceView !== "canvas" || !isCanvasEditable) {
      setStatus("请切换到 Mermaid 无限画布后粘贴图片。");
      return;
    }
    if (!fileRef?.path) {
      setStatus("请先保存 Mermaid 文件，再粘贴图片。");
      return;
    }

    try {
      const result = await runtime.importImageAssetFile(fileRef, file);
      if (result.status === "cancelled") return;
      if (result.status === "needs-document") {
        setStatus("请先保存 Mermaid 文件，再粘贴图片。");
        return;
      }
      if (result.status === "unsupported") {
        setFileWorkflowError(normalizeFileWorkflowError({ code: "unsupported_type", message: result.message }, "粘贴图片失败。"));
        return;
      }

      const dimensions = await loadImageDimensions(result.displaySrc);
      const point = lastCanvasPointerWorldRef.current || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
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
        message: result.copied ? "已复制并粘贴图片节点。" : "已粘贴图片节点。",
        source: "keyboard"
      });
    } catch (error) {
      setFileWorkflowError(normalizeFileWorkflowError(error, "粘贴图片失败。"));
    }
  }, [
    applyEditorCommand,
    canvasLiveState,
    documentKind,
    fileRef,
    isCanvasEditable,
    lastCanvasPointerWorldRef,
    runtime,
    setFileWorkflowError,
    setStatus,
    viewport,
    workspaceView
  ]);

  return { pasteClipboardImageNode };
}
