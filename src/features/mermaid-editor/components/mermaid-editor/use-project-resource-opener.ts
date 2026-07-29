import { useCallback, useRef } from "react";

import { isSupportedDocumentFilePath } from "@/features/mermaid-editor/lib/document-kind";
import {
  cascadeFloatingPanelFrame,
  type FloatingPanelRect,
  type FloatingPanelViewport
} from "@/features/mermaid-editor/lib/floating-chrome";
import { markdownFileWindowKind, type MarkdownFileWindowKind } from "@/features/mermaid-editor/lib/markdown-file-link";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import type { ProjectResourceOpenRequest } from "@/features/mermaid-editor/lib/project-resource-open";
import {
  WORKSPACE_PANEL_DEFAULT_SIZES,
  WORKSPACE_PANEL_MIN_SIZES,
  type WorkspaceWindowOpenRequest
} from "@/features/mermaid-editor/lib/workspace-panels";

type OpenCurrentFile = (file: ProjectFileEntry) => void | Promise<unknown>;
type OpenFloatingFile = (file: ProjectFileEntry, request?: WorkspaceWindowOpenRequest) => void | Promise<unknown>;

export function useProjectResourceOpener({
  openCurrentFile,
  openMarkdownWindow,
  openHtmlWindow,
  openImageWindow,
  openTextWindow,
  openCsvWindow,
  onStatus,
  onError
}: {
  openCurrentFile: OpenCurrentFile;
  openMarkdownWindow: OpenFloatingFile;
  openHtmlWindow: OpenFloatingFile;
  openImageWindow: OpenFloatingFile;
  openTextWindow: OpenFloatingFile;
  openCsvWindow: OpenFloatingFile;
  onStatus: (message: string) => void;
  onError: (error: unknown, fallbackMessage?: string) => void;
}) {
  const inFlightRef = useRef(new Map<string, Promise<unknown>>());
  const sequenceRef = useRef(0);

  return useCallback((request: ProjectResourceOpenRequest) => {
    const target = openTarget(request, {
      current: openCurrentFile,
      markdown: openMarkdownWindow,
      html: openHtmlWindow,
      image: openImageWindow,
      text: openTextWindow,
      csv: openCsvWindow
    });
    if (!target) return false;

    const requestKey = projectResourceOpenRequestKey(request);
    if (inFlightRef.current.has(requestKey)) return true;

    const activationKey = ++sequenceRef.current;
    const windowRequest = request.mode === "floating"
      ? workspaceWindowOpenRequest(request, target.kind, activationKey)
      : undefined;
    onStatus(`正在打开 ${request.file.name}…`);

    let opening: Promise<unknown>;
    try {
      opening = Promise.resolve(target.open(request.file, windowRequest));
    } catch (error) {
      onError(error, `打开 ${request.file.name} 失败。`);
      return true;
    }

    const tracked = opening
      .catch((error) => onError(error, `打开 ${request.file.name} 失败。`))
      .finally(() => {
        if (inFlightRef.current.get(requestKey) === tracked) inFlightRef.current.delete(requestKey);
      });
    inFlightRef.current.set(requestKey, tracked);
    return true;
  }, [onError, onStatus, openCsvWindow, openCurrentFile, openHtmlWindow, openImageWindow, openMarkdownWindow, openTextWindow]);
}

function openTarget(
  request: ProjectResourceOpenRequest,
  handlers: {
    current: OpenCurrentFile;
    markdown: OpenFloatingFile;
    html: OpenFloatingFile;
    image: OpenFloatingFile;
    text: OpenFloatingFile;
    csv: OpenFloatingFile;
  }
) {
  if (request.mode === "current") {
    return isSupportedDocumentFilePath(request.file.path)
      ? { kind: undefined, open: handlers.current }
      : null;
  }

  const kind = markdownFileWindowKind(request.file.path);
  return kind ? { kind, open: handlers[kind] } : null;
}

function workspaceWindowOpenRequest(
  request: ProjectResourceOpenRequest,
  kind: MarkdownFileWindowKind | undefined,
  activationKey: number
): WorkspaceWindowOpenRequest {
  const sourceRect = request.placementAnchor?.sourcePanelRect ?? request.placementAnchor?.anchorRect;
  if (!kind || !sourceRect) return { activationKey };
  const measuredTitlebarHeight = request.placementAnchor?.sourceTitlebarHeight;
  const titlebarHeight = measuredTitlebarHeight && measuredTitlebarHeight > 0
    ? measuredTitlebarHeight
    : undefined;

  return {
    activationKey,
    initialFrameKey: `${projectResourceOpenRequestKey(request)}:${activationKey}`,
    initialFrame: cascadeFloatingPanelFrame({
      sourceRect: normalizedSourceRect(sourceRect),
      targetSize: WORKSPACE_PANEL_DEFAULT_SIZES[kind],
      minSize: WORKSPACE_PANEL_MIN_SIZES[kind],
      viewport: currentViewport(),
      ...(titlebarHeight === undefined ? {} : { titlebarHeight })
    })
  };
}

function normalizedSourceRect(rect: FloatingPanelRect): FloatingPanelRect {
  return {
    left: Number.isFinite(rect.left) ? rect.left : 0,
    top: Number.isFinite(rect.top) ? rect.top : 0,
    right: Number.isFinite(rect.right) ? rect.right : rect.left,
    bottom: Number.isFinite(rect.bottom) ? rect.bottom : rect.top
  };
}

function currentViewport(): FloatingPanelViewport {
  if (typeof window === "undefined") return { width: 1024, height: 768 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export function projectResourceOpenRequestKey(request: Pick<ProjectResourceOpenRequest, "file" | "mode">) {
  const normalizedPath = request.file.path.trim().replaceAll("\\", "/");
  const comparablePath = /^[A-Za-z]:\//.test(normalizedPath) || normalizedPath.startsWith("//")
    ? normalizedPath.toLowerCase()
    : normalizedPath;
  return `${request.mode}:${comparablePath}`;
}
