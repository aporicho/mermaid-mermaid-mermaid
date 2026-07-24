import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  normalizeProjectRelativePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";

export const HTML_DOCUMENT_NODE_WIDTH = 280;
export const HTML_DOCUMENT_NODE_HEIGHT = 180;

export function isHtmlDocumentFilePath(path: string | undefined) {
  return Boolean(path && /\.html?$/i.test(path.trim()));
}

export function htmlDocumentAction(action: CanvasNodeAction | null | undefined) {
  return action?.kind === "file" && isHtmlDocumentFilePath(action.path) ? action : undefined;
}

export function isHtmlDocumentNode(node: Pick<CanvasNode, "action">) {
  return Boolean(htmlDocumentAction(node.action));
}

export function htmlDocumentReferenceKey(path: string) {
  const normalized = normalizeProjectRelativePath(path.trim()).replace(/^\.\//, "").replace(/\/$/, "");
  return isWindowsPath(path) ? normalized.toLowerCase() : normalized;
}

export function htmlDocumentNodeForProjectFile(nodes: CanvasNode[], file: ProjectFileEntry) {
  const candidates = new Set([file.path, file.relativePath, file.name].map(htmlDocumentReferenceKey));
  return nodes.find((node) => {
    const action = htmlDocumentAction(node.action);
    return action ? candidates.has(htmlDocumentReferenceKey(action.path)) : false;
  });
}

export function htmlProjectFiles(workspace: ProjectWorkspace | null | undefined): ProjectFileEntry[] {
  return (workspace?.resources ?? [])
    .filter((resource) => resource.kind === "file" && isHtmlDocumentFilePath(resource.path))
    .map(resourceProjectFile);
}

export function htmlDocumentProjectFileForRuntimeFile(
  file: Pick<ProjectFileEntry, "name" | "path">,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const pathKey = htmlDocumentReferenceKey(file.path);
  return htmlProjectFiles(workspace).find((candidate) => htmlDocumentReferenceKey(candidate.path) === pathKey) ?? {
    name: file.name,
    path: file.path,
    relativePath: file.path
  };
}

export function resolveHtmlDocumentFile(
  actionPath: string,
  currentFilePath: string | undefined,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const trimmed = actionPath.trim();
  const comparable = htmlDocumentReferenceKey(trimmed);
  const projectFile = htmlProjectFiles(workspace).find((file) => {
    return [file.relativePath, file.path, file.name].some((candidate) => htmlDocumentReferenceKey(candidate) === comparable);
  });
  if (projectFile) return projectFile;

  const path = isAbsoluteRuntimePath(trimmed)
    ? trimmed
    : joinRuntimePath(parentDirectoryPath(currentFilePath) || workspace?.rootPath, trimmed);
  return {
    name: runtimeFileNameFromPath(path || trimmed),
    path: path || trimmed,
    relativePath: trimmed || runtimeFileNameFromPath(path)
  };
}

export function htmlDocumentActionForProjectFile(file: ProjectFileEntry): CanvasNodeAction {
  return {
    kind: "file",
    path: isAbsoluteRuntimePath(file.relativePath) ? file.path : normalizeProjectRelativePath(file.relativePath || file.name),
    openMode: "app-window",
    tooltip: "预览 HTML 文件"
  };
}

export function htmlDocumentLabel(file: Pick<ProjectFileEntry, "name">) {
  return file.name.replace(/\.html?$/i, "") || "HTML 文件";
}

export function normalizeNewHtmlFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/\0]/.test(trimmed)) return "";
  if (/\.html?$/i.test(trimmed)) return trimmed;
  if (/\.[^.]+$/.test(trimmed)) return "";
  return `${trimmed}.html`;
}

export function initialHtmlDocumentSource(fileName: string) {
  const title = htmlDocumentLabel({ name: fileName }).trim() || "HTML 文档";
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${escapeHtml(title)}</title>\n</head>\n<body>\n  <h1>${escapeHtml(title)}</h1>\n</body>\n</html>\n`;
}

export function runtimeFilePathToUrl(path: string) {
  const normalized = path.trim().replaceAll("\\", "/");
  if (!normalized) return "";
  if (/^file:/i.test(normalized)) return normalized;

  const encoded = normalized
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment).replace(/%3A/gi, ":"))
    .join("/");
  if (/^[A-Za-z]:\//.test(normalized)) return `file:///${encoded}`;
  if (normalized.startsWith("//")) return `file:${encoded}`;
  return normalized.startsWith("/") ? `file://${encoded}` : `file:///${encoded}`;
}

function resourceProjectFile(resource: NonNullable<ProjectWorkspace["resources"]>[number]): ProjectFileEntry {
  return {
    name: resource.name,
    path: resource.path,
    relativePath: resource.relativePath,
    ...(resource.modifiedAt ? { modifiedAt: resource.modifiedAt } : {})
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] || character);
}

function isWindowsPath(path: string) {
  return /^[a-z]:/i.test(path) || path.includes("\\");
}
