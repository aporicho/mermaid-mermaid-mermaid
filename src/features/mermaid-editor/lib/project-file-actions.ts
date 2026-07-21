import { createBlankCanvasDocument, serializeCanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type { RuntimeFileRef, RuntimeProjectFileKind } from "@/features/mermaid-editor/lib/editor-runtime";
import { BLANK_FLOWCHART_SOURCE, BLANK_MARKDOWN_SOURCE } from "@/features/mermaid-editor/lib/editor-state";
import type { CanvasNodeAction, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { initialMarkdownDocumentSource } from "@/features/mermaid-editor/lib/markdown-document";
import {
  markdownWindowPanelId,
  type DetachedMarkdownWindow
} from "@/features/mermaid-editor/lib/workspace-panels";

export type ProjectFilePathMigration = {
  sourceAbsolutePath: string;
  sourceRelativePath: string;
  sourceName: string;
  targetFile: RuntimeFileRef & { path: string };
  targetRelativePath: string;
};

export function initialProjectFileText(kind: RuntimeProjectFileKind, fileName?: string) {
  if (kind === "mermaid") return `${BLANK_FLOWCHART_SOURCE}\n`;
  if (kind === "markdown") return fileName ? initialMarkdownDocumentSource(fileName) : BLANK_MARKDOWN_SOURCE;
  if (kind === "canvas") return serializeCanvasDocument(createBlankCanvasDocument());
  return "";
}

export function projectRelativePathFromRuntimePath(rootPath: string, filePath: string) {
  const root = normalizeRuntimePath(rootPath);
  const file = normalizeRuntimePath(filePath);
  const ignoreCase = isWindowsLikePath(rootPath) || isWindowsLikePath(filePath);
  const comparableRoot = ignoreCase ? root.toLocaleLowerCase() : root;
  const comparableFile = ignoreCase ? file.toLocaleLowerCase() : file;
  const prefix = comparableRoot === "/" ? "/" : `${comparableRoot}/`;
  if (comparableFile.startsWith(prefix)) return file.slice(prefix.length).replace(/^\/+/, "");
  return file.split("/").filter(Boolean).at(-1) || file;
}

export function projectFileActionUpdates(graph: MermaidGraph, migration: ProjectFilePathMigration) {
  const sourcePaths = new Set([
    migration.sourceAbsolutePath,
    migration.sourceRelativePath,
    migration.sourceName
  ].map((value) => projectFileReferenceKey(value, migration.sourceAbsolutePath)));

  return graph.nodes.flatMap<{ nodeId: string; action: CanvasNodeAction }>((node) => {
    if (node.action?.kind !== "file" || !sourcePaths.has(projectFileReferenceKey(node.action.path, migration.sourceAbsolutePath))) return [];
    return [{
      nodeId: node.id,
      action: { ...node.action, path: migration.targetRelativePath }
    }];
  });
}

export function migrateCurrentProjectFileRef(file: RuntimeFileRef | null, migration: ProjectFilePathMigration) {
  if (!sameRuntimePath(file?.path, migration.sourceAbsolutePath)) return file;
  return { ...file, ...migration.targetFile };
}

export function migrateRecentProjectFiles(files: RecentFileEntry[], migration: ProjectFilePathMigration) {
  return files.map((file) => sameRuntimePath(file.path, migration.sourceAbsolutePath)
    ? { ...file, name: migration.targetFile.name, path: migration.targetFile.path }
    : file);
}

export function migrateDetachedMarkdownWindows(windows: DetachedMarkdownWindow[], migration: ProjectFilePathMigration) {
  return windows.map((window) => {
    if (!sameRuntimePath(window.file.path, migration.sourceAbsolutePath)) return window;
    const file = { ...window.file, ...migration.targetFile };
    return {
      ...window,
      id: markdownWindowPanelId(file),
      file,
      title: migration.targetFile.name
    };
  });
}

function normalizeRuntimePath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (/^[A-Za-z]:$/.test(normalized)) return `${normalized}/`;
  return normalized || (value.startsWith("/") ? "/" : normalized);
}

function projectFileReferenceKey(value: string, platformPath: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return isWindowsLikePath(platformPath) ? normalized.toLocaleLowerCase() : normalized;
}

function isWindowsLikePath(value: string) {
  return value.includes("\\") || /^[A-Za-z]:/.test(value);
}

function sameRuntimePath(left: string | undefined, right: string) {
  if (!left) return false;
  const leftPath = normalizeRuntimePath(left);
  const rightPath = normalizeRuntimePath(right);
  return isWindowsLikePath(left) || isWindowsLikePath(right)
    ? leftPath.toLocaleLowerCase() === rightPath.toLocaleLowerCase()
    : leftPath === rightPath;
}
