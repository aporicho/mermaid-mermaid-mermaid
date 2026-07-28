import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { isAbsoluteRuntimePath, joinRuntimePath, normalizeProjectRelativePath, parentDirectoryPath, runtimeFileNameFromPath } from "@/features/mermaid-editor/lib/runtime-paths";

export const TEXT_DOCUMENT_DRAG_TYPE = "application/x-mermaid-canvas-text-document";
export const TEXT_DOCUMENT_NODE_WIDTH = 420;
export const TEXT_DOCUMENT_NODE_HEIGHT = Math.round(TEXT_DOCUMENT_NODE_WIDTH * Math.SQRT2);

export type TextDocumentPreview = {
  status: "loading" | "ready" | "empty" | "missing" | "error" | "unsupported";
  path: string;
  excerpt: string;
  message?: string;
};

export function isTextDocumentFilePath(path: string | undefined) {
  return Boolean(path && /\.txt$/i.test(path.trim()));
}

export function textDocumentAction(path: string): CanvasNodeAction {
  return { kind: "file", path, openMode: "app-window" };
}

export function textDocumentNodeAction(action: CanvasNodeAction | null | undefined) {
  return action?.kind === "file" && isTextDocumentFilePath(action.path) ? action : undefined;
}

export function isTextDocumentNode(node: Pick<CanvasNode, "action">) {
  return Boolean(textDocumentNodeAction(node.action));
}

export function textDocumentReferenceKey(path: string) {
  return normalizeProjectRelativePath(path.trim()).replace(/^\.\//, "").replace(/\/$/, "").toLowerCase();
}

export function textDocumentNodeForProjectFile(nodes: CanvasNode[], file: ProjectFileEntry) {
  const candidates = new Set([file.path, file.relativePath, file.name].map(textDocumentReferenceKey));
  return nodes.find((node) => {
    const action = textDocumentNodeAction(node.action);
    return action ? candidates.has(textDocumentReferenceKey(action.path)) : false;
  });
}

export function textProjectFiles(workspace: ProjectWorkspace | null | undefined): ProjectFileEntry[] {
  return (workspace?.resources ?? []).filter((resource) => resource.kind === "file" && isTextDocumentFilePath(resource.path)).map((resource) => ({
    name: resource.name,
    path: resource.path,
    relativePath: resource.relativePath,
    modifiedAt: resource.modifiedAt
  }));
}

export function resolveTextDocumentFile(actionPath: string, currentFilePath: string | undefined, workspace: ProjectWorkspace | null | undefined): ProjectFileEntry {
  const comparable = textDocumentReferenceKey(actionPath);
  const projectFile = textProjectFiles(workspace).find((file) => [file.relativePath, file.path, file.name].some((candidate) => textDocumentReferenceKey(candidate) === comparable));
  if (projectFile) return projectFile;
  const path = isAbsoluteRuntimePath(actionPath) ? actionPath : joinRuntimePath(parentDirectoryPath(currentFilePath) || workspace?.rootPath, actionPath);
  return { name: runtimeFileNameFromPath(path || actionPath), path: path || actionPath, relativePath: actionPath };
}

export function textDocumentActionForProjectFile(file: ProjectFileEntry): CanvasNodeAction {
  return textDocumentAction(isAbsoluteRuntimePath(file.relativePath) ? file.path : normalizeProjectRelativePath(file.relativePath || file.name));
}

export function textDocumentLabel(file: Pick<ProjectFileEntry, "name">) {
  return file.name.replace(/\.txt$/i, "") || "文本文档";
}

export function textDocumentExcerpt(source: string, maximumLines = 24) {
  return source.replace(/\r\n/g, "\n").split("\n").slice(0, maximumLines).join("\n");
}
