import type { CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import { isSupportedDocumentFilePath } from "@/features/mermaid-editor/lib/document-kind";

export const NODE_ACTION_NONE_VALUE = "__none__";

export function normalizeNodeAction(action: CanvasNodeAction | null | undefined): CanvasNodeAction | undefined {
  if (!action) return undefined;

  if (action.kind === "url") {
    const url = action.url.trim();
    if (!isHttpUrl(url)) return undefined;
    return {
      kind: "url",
      url,
      openMode: action.openMode === "system" ? "system" : "app-browser",
      ...(action.tooltip?.trim() ? { tooltip: action.tooltip.trim() } : {})
    };
  }

  const path = normalizeFileActionPath(action.path);
  if (!path) return undefined;
  return {
    kind: "file",
    path,
    openMode: "app-window",
    ...(action.tooltip?.trim() ? { tooltip: action.tooltip.trim() } : {})
  };
}

export function inferNodeActionFromMermaidTarget(target: string, tooltip?: string): CanvasNodeAction | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;

  if (isHttpUrl(trimmed)) {
    return normalizeNodeAction({ kind: "url", url: trimmed, openMode: "app-browser", ...(tooltip ? { tooltip } : {}) });
  }

  const filePath = filePathFromUrl(trimmed) || (isFileLikeTarget(trimmed) ? trimmed : "");
  if (!filePath) return undefined;
  return normalizeNodeAction({ kind: "file", path: filePath, openMode: "app-window", ...(tooltip ? { tooltip } : {}) });
}

export function nodeActionTarget(action: CanvasNodeAction | undefined) {
  if (!action) return "";
  return action.kind === "url" ? action.url : action.path;
}

export function nodeActionLabel(action: CanvasNodeAction | undefined) {
  if (!action) return "无动作";
  return action.kind === "url" ? "网页链接" : "文件链接";
}

export function nodeActionOpenLabel(action: CanvasNodeAction | undefined) {
  if (!action) return "打开";
  return action.kind === "url" ? "打开链接" : "打开文件";
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function normalizeFileActionPath(path: string) {
  const filePath = filePathFromUrl(path) || path.trim();
  return filePath || undefined;
}

function isFileLikeTarget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return false;
  return isSupportedDocumentFilePath(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.includes("\\");
}

function filePathFromUrl(value: string) {
  if (!/^file:\/\//i.test(value.trim())) return undefined;

  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  } catch {
    return value.replace(/^file:\/\//i, "");
  }
}
