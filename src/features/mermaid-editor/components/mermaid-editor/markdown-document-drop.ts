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
import {
  htmlDocumentProjectFileForRuntimeFile,
  isHtmlDocumentFilePath
} from "@/features/mermaid-editor/lib/html-document";
import { isTextDocumentFilePath } from "@/features/mermaid-editor/lib/text-document";
import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";
import type { ExplorerCanvasNodeKind } from "@/features/mermaid-editor/components/explorer-panel";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import {
  markdownImageDropController,
  type MarkdownImageDropController
} from "@/features/mermaid-editor/lib/markdown-image-drop";

type DragHandler = (event: DragEvent<HTMLElement>) => void;

export function createMarkdownDocumentDropHandlers({
  isCanvasEditable,
  workspaceView,
  viewport,
  workspaceSurfaceRef,
  addProjectMarkdownFile,
  addProjectHtmlFile,
  addProjectTextFile,
  addProjectCsvFile,
  importProjectImageFileAtWindowPoint,
  setStatus,
  setFileDropFeedback,
  usesRuntimeFileDrops,
  projectWorkspace,
  imageDropController = markdownImageDropController,
  external
}: {
  isCanvasEditable: boolean;
  workspaceView: WorkspaceView;
  viewport: ViewportState;
  workspaceSurfaceRef: RefObject<HTMLDivElement | null>;
  addProjectMarkdownFile: (file: ProjectFileEntry, point?: { x: number; y: number }, source?: "pointer") => void;
  addProjectHtmlFile: (file: ProjectFileEntry, point?: { x: number; y: number }, source?: "pointer") => void;
  addProjectTextFile: (file: ProjectFileEntry, point?: { x: number; y: number }, source?: "pointer") => void;
  addProjectCsvFile: (file: ProjectFileEntry, point?: { x: number; y: number }, source?: "pointer") => void;
  importProjectImageFileAtWindowPoint: (file: ProjectFileEntry, point: { x: number; y: number }) => void;
  setStatus: (message: string) => void;
  setFileDropFeedback: (feedback: FileDropFeedback | null) => void;
  usesRuntimeFileDrops: boolean;
  projectWorkspace: ProjectWorkspace | null;
  imageDropController?: MarkdownImageDropController;
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

  function isRuntimeLinkedFileDrop(event: DragEvent<HTMLElement>) {
    return usesRuntimeFileDrops && Array.from(event.dataTransfer.files).some((file) => isSupportedMarkdownFilePath(file.name) || isHtmlDocumentFilePath(file.name) || isTextDocumentFilePath(file.name) || isCsvTableFilePath(file.name));
  }

  function isNativeMarkdownImageDrop(event: DragEvent<HTMLElement>) {
    const target = event.target as Element | null;
    const files = Array.from(event.dataTransfer.files);
    return Boolean(target?.closest?.("[data-markdown-image-drop-target]") && files.length && files.every((file) => isSupportedImagePath(file.name)));
  }

  function showMarkdownDropFeedback(point: { x: number; y: number }) {
    const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
    setFileDropFeedback({
      message: isCanvasEditable && workspaceView === "canvas" ? "释放以添加 Markdown 文档卡片" : "请切换到可编辑 Mermaid 画布",
      tone: isCanvasEditable && workspaceView === "canvas" ? "ready" : "blocked",
      position: bounds ? { x: point.x - bounds.left, y: point.y - bounds.top } : undefined
    });
  }

  function showMarkdownImageDropFeedback(point: { x: number; y: number }) {
    const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
    setFileDropFeedback({
      message: "释放以插入 Markdown 图片",
      tone: "ready",
      position: bounds ? { x: point.x - bounds.left, y: point.y - bounds.top } : undefined
    });
  }

  function routeImageDrop(file: ProjectFileEntry, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") {
    const result = imageDropController.route(phase === "cancel" ? { phase } : { imageFile: file, point, phase });
    if (!result.handled) return false;
    if (phase === "move") showMarkdownImageDropFeedback(point);
    else setFileDropFeedback(null);
    return true;
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
      if (isNativeMarkdownImageDrop(event)) return setFileDropFeedback(null);
      if (!isMarkdownDrag(event)) return external.enter(event);
      event.preventDefault();
      showMarkdownDropFeedback({ x: event.clientX, y: event.clientY });
    },
    over(event: DragEvent<HTMLElement>) {
      if (isNativeMarkdownImageDrop(event)) return setFileDropFeedback(null);
      if (!isMarkdownDrag(event)) return external.over(event);
      event.preventDefault();
      event.dataTransfer.dropEffect = isCanvasEditable && workspaceView === "canvas" ? "link" : "none";
      showMarkdownDropFeedback({ x: event.clientX, y: event.clientY });
    },
    leave(event: DragEvent<HTMLElement>) {
      if (isNativeMarkdownImageDrop(event)) return setFileDropFeedback(null);
      if (!isMarkdownDrag(event)) return external.leave(event);
      setFileDropFeedback(null);
    },
    drop(event: DragEvent<HTMLElement>) {
      if (isNativeMarkdownImageDrop(event)) return setFileDropFeedback(null);
      if (!isMarkdownDrag(event)) {
        if (isCanvasEditable && workspaceView === "canvas" && isRuntimeLinkedFileDrop(event)) {
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
      const image = request.files.find((candidate) => isSupportedImagePath(candidate.path || candidate.name));
      if (request.type === "leave" && imageDropController.route({ phase: "cancel" }).handled) {
        setFileDropFeedback(null);
        return;
      }
      if (usesRuntimeFileDrops && request.type !== "leave" && image && request.position) {
        const projectImageResource = projectWorkspace?.resources?.find((candidate) => candidate.kind === "file" && candidate.path === image.path);
        const projectImage = projectWorkspace?.files.find((candidate) => candidate.path === image.path)
          ?? (projectImageResource ? { name: projectImageResource.name, path: projectImageResource.path, relativePath: projectImageResource.relativePath } : undefined)
          ?? { name: image.name, path: image.path, relativePath: image.path };
        const phase = request.type === "drop" ? "drop" : "move";
        if (routeImageDrop(projectImage, request.position, phase)) return;
      }
      const file = request.files.find((candidate) => isSupportedMarkdownFilePath(candidate.path || candidate.name) || isHtmlDocumentFilePath(candidate.path || candidate.name) || isTextDocumentFilePath(candidate.path || candidate.name) || isCsvTableFilePath(candidate.path || candidate.name));
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
        const label = isHtmlDocumentFilePath(file.path || file.name) ? "HTML 文件节点" : isTextDocumentFilePath(file.path || file.name) ? "文本文件节点" : isCsvTableFilePath(file.path || file.name) ? "CSV 表格节点" : "Markdown 文档卡片";
        setFileDropFeedback({ message: `释放以添加 ${label}`, tone: "ready", position: localPoint });
        return;
      }

      setFileDropFeedback(null);
      const worldPoint = request.position && bounds
        ? canvasWorldPointFromClient(request.position, bounds, viewport)
        : undefined;
      if (isHtmlDocumentFilePath(file.path || file.name)) {
        addProjectHtmlFile(htmlDocumentProjectFileForRuntimeFile(file, projectWorkspace), worldPoint, "pointer");
      } else if (isTextDocumentFilePath(file.path || file.name)) {
        addProjectTextFile({ name: file.name, path: file.path, relativePath: file.path }, worldPoint, "pointer");
      } else if (isCsvTableFilePath(file.path || file.name)) {
        addProjectCsvFile({ name: file.name, path: file.path, relativePath: file.path }, worldPoint, "pointer");
      } else {
        addProjectMarkdownFile(markdownDocumentProjectFileForRuntimeFile(file, projectWorkspace), worldPoint, "pointer");
      }
    },
    pointer(file: ProjectFileEntry, kind: ExplorerCanvasNodeKind, point: { x: number; y: number }, phase: "move" | "drop" | "cancel") {
      if (kind === "image" && routeImageDrop(file, point, phase)) return;
      if (phase === "cancel") {
        setFileDropFeedback(null);
        return;
      }
      if (phase === "move") {
        if (!isPointOnWorkspaceSurface(point)) {
          setFileDropFeedback(null);
          return;
        }
        const bounds = workspaceSurfaceRef.current?.getBoundingClientRect();
        setFileDropFeedback({
          message: isCanvasEditable && workspaceView === "canvas" ? `释放以添加 ${kind === "html" ? "HTML 文件节点" : kind === "text" ? "文本文件节点" : kind === "csv" ? "CSV 表格节点" : kind === "image" ? "图片节点" : "Markdown 文档卡片"}` : "请切换到可编辑 Mermaid 画布",
          tone: isCanvasEditable && workspaceView === "canvas" ? "ready" : "blocked",
          position: bounds ? { x: point.x - bounds.left, y: point.y - bounds.top } : undefined
        });
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
      if (kind === "image") {
        importProjectImageFileAtWindowPoint(file, point);
        return;
      }
      const worldPoint = canvasWorldPointFromClient(point, bounds, viewport);
      if (kind === "html") addProjectHtmlFile(file, worldPoint, "pointer");
      else if (kind === "text") addProjectTextFile(file, worldPoint, "pointer");
      else if (kind === "csv") addProjectCsvFile(file, worldPoint, "pointer");
      else addProjectMarkdownFile(file, worldPoint, "pointer");
    }
  };
}
