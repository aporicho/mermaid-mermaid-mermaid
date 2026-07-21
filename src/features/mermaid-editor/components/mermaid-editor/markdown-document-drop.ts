import type { DragEvent, RefObject } from "react";

import type { FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileDropRequest } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import {
  canvasWorldPointFromClient,
  currentMarkdownDocumentDrag,
  endMarkdownDocumentDrag,
  MARKDOWN_DOCUMENT_DRAG_TYPE,
  markdownDocumentProjectFileForRuntimeFile,
  parseMarkdownDocumentDragPayload
} from "@/features/mermaid-editor/lib/markdown-document";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

type DragHandler = (event: DragEvent<HTMLElement>) => void;

export function createMarkdownDocumentDropHandlers({
  isCanvasEditable,
  workspaceView,
  viewport,
  workspaceSurfaceRef,
  addProjectMarkdownFile,
  setStatus,
  setFileDropFeedback,
  usesRuntimeFileDrops,
  projectWorkspace,
  external
}: {
  isCanvasEditable: boolean;
  workspaceView: WorkspaceView;
  viewport: ViewportState;
  workspaceSurfaceRef: RefObject<HTMLDivElement | null>;
  addProjectMarkdownFile: (file: ProjectFileEntry, point?: { x: number; y: number }, source?: "pointer") => void;
  setStatus: (message: string) => void;
  setFileDropFeedback: (feedback: FileDropFeedback | null) => void;
  usesRuntimeFileDrops: boolean;
  projectWorkspace: ProjectWorkspace | null;
  external: {
    enter: DragHandler;
    over: DragHandler;
    leave: DragHandler;
    drop: DragHandler;
    runtime: (request: RuntimeFileDropRequest) => void;
  };
}) {
  function isMarkdownDrag(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes(MARKDOWN_DOCUMENT_DRAG_TYPE) || Boolean(currentMarkdownDocumentDrag());
  }

  function isRuntimeMarkdownFileDrop(event: DragEvent<HTMLElement>) {
    return usesRuntimeFileDrops && Array.from(event.dataTransfer.files).some((file) => isSupportedMarkdownFilePath(file.name));
  }

  function showMarkdownDropFeedback(point: { x: number; y: number }) {
    const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
    setFileDropFeedback({
      message: isCanvasEditable && workspaceView === "canvas" ? "释放以添加 Markdown 文档卡片" : "请切换到可编辑 Mermaid 画布",
      tone: isCanvasEditable && workspaceView === "canvas" ? "ready" : "blocked",
      position: bounds ? { x: point.x - bounds.left, y: point.y - bounds.top } : undefined
    });
  }

  function isPointOnWorkspaceSurface(point: { x: number; y: number }) {
    const surface = workspaceSurfaceRef.current;
    if (!surface) return false;
    const bounds = surface.getBoundingClientRect();
    if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) return false;
    const hitTarget = document.elementFromPoint(point.x, point.y);
    return hitTarget === surface || (hitTarget !== null && surface.contains(hitTarget));
  }

  return {
    enter(event: DragEvent<HTMLElement>) {
      if (!isMarkdownDrag(event)) return external.enter(event);
      event.preventDefault();
      showMarkdownDropFeedback({ x: event.clientX, y: event.clientY });
    },
    over(event: DragEvent<HTMLElement>) {
      if (!isMarkdownDrag(event)) return external.over(event);
      event.preventDefault();
      event.dataTransfer.dropEffect = isCanvasEditable && workspaceView === "canvas" ? "link" : "none";
      showMarkdownDropFeedback({ x: event.clientX, y: event.clientY });
    },
    leave(event: DragEvent<HTMLElement>) {
      if (!isMarkdownDrag(event)) return external.leave(event);
      setFileDropFeedback(null);
    },
    drop(event: DragEvent<HTMLElement>) {
      if (!isMarkdownDrag(event)) {
        if (isCanvasEditable && workspaceView === "canvas" && isRuntimeMarkdownFileDrop(event)) {
          event.preventDefault();
          return;
        }
        return external.drop(event);
      }
      event.preventDefault();
      event.stopPropagation();
      const payload = parseMarkdownDocumentDragPayload(event.dataTransfer.getData(MARKDOWN_DOCUMENT_DRAG_TYPE))
        ?? currentMarkdownDocumentDrag();
      endMarkdownDocumentDrag();
      setFileDropFeedback(null);
      if (!isCanvasEditable || workspaceView !== "canvas") {
        setStatus("请切换到可编辑 Mermaid 画布后再添加 Markdown 文档。");
        return;
      }
      const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
      if (!payload || !bounds) return;
      const point = canvasWorldPointFromClient({ x: event.clientX, y: event.clientY }, bounds, viewport);
      addProjectMarkdownFile(payload, point, "pointer");
    },
    runtime(request: RuntimeFileDropRequest) {
      const file = request.files.find((candidate) => isSupportedMarkdownFilePath(candidate.path || candidate.name));
      if (!usesRuntimeFileDrops || !isCanvasEditable || workspaceView !== "canvas" || !file) {
        external.runtime(request);
        return;
      }

      if (request.type === "leave") {
        setFileDropFeedback(null);
        return;
      }

      const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
      const localPoint = request.position && bounds
        ? { x: request.position.x - bounds.left, y: request.position.y - bounds.top }
        : undefined;
      if (request.type !== "drop") {
        setFileDropFeedback({ message: "释放以添加 Markdown 文档卡片", tone: "ready", position: localPoint });
        return;
      }

      setFileDropFeedback(null);
      const worldPoint = request.position && bounds
        ? canvasWorldPointFromClient(request.position, bounds, viewport)
        : undefined;
      addProjectMarkdownFile(markdownDocumentProjectFileForRuntimeFile(file, projectWorkspace), worldPoint, "pointer");
    },
    pointer(file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") {
      if (phase === "cancel") {
        setFileDropFeedback(null);
        return;
      }
      if (phase === "move") {
        if (!isPointOnWorkspaceSurface(point)) {
          setFileDropFeedback(null);
          return;
        }
        showMarkdownDropFeedback(point);
        return;
      }

      setFileDropFeedback(null);
      if (!isPointOnWorkspaceSurface(point)) return;
      if (!isCanvasEditable || workspaceView !== "canvas") {
        setStatus("请切换到可编辑 Mermaid 画布后再添加 Markdown 文档。");
        return;
      }
      const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
      if (!bounds) return;
      addProjectMarkdownFile(file, canvasWorldPointFromClient(point, bounds, viewport), "pointer");
    }
  };
}
