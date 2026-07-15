import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  normalizeProjectRelativePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";

export const MARKDOWN_DOCUMENT_DRAG_TYPE = "application/x-mermaid-canvas-markdown-document";
export const MARKDOWN_DOCUMENT_NODE_WIDTH = 272;
export const MARKDOWN_DOCUMENT_NODE_HEIGHT = 144;

export type MarkdownDocumentPreview = {
  status: "loading" | "ready" | "empty" | "missing" | "error" | "unsupported";
  path: string;
  excerpt: string;
  message?: string;
};

export type MarkdownDocumentDragPayload = Pick<ProjectFileEntry, "name" | "path" | "relativePath">;

let activeMarkdownDocumentDrag: MarkdownDocumentDragPayload | null = null;

export function markdownDocumentAction(action: CanvasNodeAction | null | undefined) {
  return action?.kind === "file" && isSupportedMarkdownFilePath(action.path) ? action : undefined;
}

export function isMarkdownDocumentNode(node: Pick<CanvasNode, "action">) {
  return Boolean(markdownDocumentAction(node.action));
}

export function markdownDocumentReferenceKey(path: string) {
  const normalized = normalizeProjectRelativePath(path.trim()).replace(/^\.\//, "").replace(/\/$/, "");
  return isWindowsPath(path) ? normalized.toLowerCase() : normalized;
}

export function markdownDocumentNodeForPath(nodes: CanvasNode[], path: string) {
  const target = markdownDocumentReferenceKey(path);
  return nodes.find((node) => {
    const action = markdownDocumentAction(node.action);
    return action ? markdownDocumentReferenceKey(action.path) === target : false;
  });
}

export function markdownDocumentNodeForProjectFile(nodes: CanvasNode[], file: ProjectFileEntry) {
  const candidates = new Set([file.path, file.relativePath, file.name].map(markdownDocumentReferenceKey));
  return nodes.find((node) => {
    const action = markdownDocumentAction(node.action);
    return action ? candidates.has(markdownDocumentReferenceKey(action.path)) : false;
  });
}

export function markdownDocumentProjectFileForRuntimeFile(
  file: Pick<ProjectFileEntry, "name" | "path">,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const pathKey = markdownDocumentReferenceKey(file.path);
  return workspace?.files.find((candidate) => markdownDocumentReferenceKey(candidate.path) === pathKey) ?? {
    name: file.name,
    path: file.path,
    relativePath: file.path
  };
}

export function canvasWorldPointFromClient(
  client: { x: number; y: number },
  bounds: Pick<DOMRect, "left" | "top">,
  viewport: ViewportState
) {
  return {
    x: (client.x - bounds.left - viewport.x) / viewport.scale,
    y: (client.y - bounds.top - viewport.y) / viewport.scale
  };
}

export function resolveMarkdownDocumentFile(
  actionPath: string,
  currentFilePath: string | undefined,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const trimmed = actionPath.trim();
  const comparable = markdownDocumentReferenceKey(trimmed);
  const projectFile = workspace?.files.find((file) => {
    return [file.relativePath, file.path, file.name].some((candidate) => markdownDocumentReferenceKey(candidate) === comparable);
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

export function markdownDocumentActionForProjectFile(file: ProjectFileEntry): CanvasNodeAction {
  return {
    kind: "file",
    path: isAbsoluteRuntimePath(file.relativePath) ? file.path : normalizeProjectRelativePath(file.relativePath || file.name),
    openMode: "app-window",
    tooltip: "打开 Markdown 文档"
  };
}

export function markdownDocumentLabel(file: Pick<ProjectFileEntry, "name">) {
  return file.name.replace(/\.(?:md|markdown)$/i, "") || "Markdown 文档";
}

export function extractMarkdownDocumentExcerpt(source: string, maxLength = 180) {
  const body = stripFrontmatter(source.replace(/\r\n?/g, "\n"));
  const blocks = body.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length || lines.every(isHeadingLine) || lines[0]?.startsWith("```")) continue;

    const plain = stripMarkdownInline(
      lines
        .filter((line) => !isHeadingLine(line) && !/^```/.test(line))
        .join(" ")
    );
    if (!plain) continue;
    return plain.length > maxLength ? `${plain.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : plain;
  }

  return "";
}

export function normalizeNewMarkdownFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/\0]/.test(trimmed)) return "";
  if (/\.(?:md|markdown)$/i.test(trimmed)) return trimmed;
  if (/\.[^.]+$/.test(trimmed)) return "";
  return `${trimmed}.md`;
}

export function initialMarkdownDocumentSource(fileName: string) {
  const title = markdownDocumentLabel({ name: fileName }).trim() || "新文档";
  return `# ${title}\n\n`;
}

export function serializeMarkdownDocumentDragPayload(file: ProjectFileEntry) {
  const payload: MarkdownDocumentDragPayload = {
    name: file.name,
    path: file.path,
    relativePath: file.relativePath
  };
  return JSON.stringify(payload);
}

export function beginMarkdownDocumentDrag(file: ProjectFileEntry, dataTransfer: DataTransfer) {
  activeMarkdownDocumentDrag = {
    name: file.name,
    path: file.path,
    relativePath: file.relativePath
  };
  dataTransfer.effectAllowed = "link";
  dataTransfer.setData(MARKDOWN_DOCUMENT_DRAG_TYPE, serializeMarkdownDocumentDragPayload(file));
  dataTransfer.setData("text/plain", file.relativePath);
}

export function currentMarkdownDocumentDrag() {
  return activeMarkdownDocumentDrag;
}

export function endMarkdownDocumentDrag() {
  activeMarkdownDocumentDrag = null;
}

export function parseMarkdownDocumentDragPayload(value: string): MarkdownDocumentDragPayload | null {
  try {
    const payload = JSON.parse(value) as Partial<MarkdownDocumentDragPayload>;
    if (
      typeof payload.name !== "string" ||
      typeof payload.path !== "string" ||
      typeof payload.relativePath !== "string" ||
      !isSupportedMarkdownFilePath(payload.path)
    ) {
      return null;
    }
    return { name: payload.name, path: payload.path, relativePath: payload.relativePath };
  } catch {
    return null;
  }
}

function stripFrontmatter(source: string) {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") return source;
  const endIndex = lines.slice(1).findIndex((line) => line.trim() === "---");
  return endIndex < 0 ? source : lines.slice(endIndex + 2).join("\n");
}

function isHeadingLine(line: string) {
  return /^#{1,6}\s+/.test(line) || /^[-=]{3,}$/.test(line);
}

function stripMarkdownInline(value: string) {
  return value
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+|>\s*)/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWindowsPath(path: string) {
  return /^[a-z]:/i.test(path) || path.includes("\\");
}
