import { serializeCanvasTableCsv } from "@/features/mermaid-editor/lib/canvas-table-csv";
import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";
import type { CanvasNode, CanvasNodeAction } from "@/features/mermaid-editor/lib/editor-types";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";

export const CSV_TABLE_DEFAULT_FILE_NAME = "table.csv";
export const CSV_TABLE_DEFAULT_SOURCE = serializeCanvasTableCsv(createDefaultCanvasTableContent());

export function isCsvTableFilePath(path: string | undefined) {
  return Boolean(path && /(?:^|[\\/])?[^\\/]+\.csv$/i.test(path));
}

export function csvTableDocumentAction(action: CanvasNodeAction | null | undefined) {
  return action?.kind === "file" && isCsvTableFilePath(action.path) ? action : undefined;
}

export function isCsvTableDocumentNode(node: Pick<CanvasNode, "action">) {
  return Boolean(csvTableDocumentAction(node.action));
}

export function csvTableDocumentLabel(file: Pick<ProjectFileEntry, "name">) {
  return file.name.replace(/\.csv$/i, "") || "CSV 表格";
}

export function csvTableDocumentReferenceKey(path: string) {
  const normalized = normalizeCsvRelativePath(path);
  return isWindowsPath(path) ? normalized.toLowerCase() : normalized;
}

export function csvTableDocumentNodeForPath(nodes: CanvasNode[], path: string) {
  const target = csvTableDocumentReferenceKey(path);
  return nodes.find((node) => {
    const action = csvTableDocumentAction(node.action);
    return action ? csvTableDocumentReferenceKey(action.path) === target : false;
  });
}

export function csvTableDocumentNodeForProjectFile(nodes: CanvasNode[], file: ProjectFileEntry) {
  const candidates = new Set([file.path, file.relativePath, file.name].map(csvTableDocumentReferenceKey));
  return nodes.find((node) => {
    const action = csvTableDocumentAction(node.action);
    return action ? candidates.has(csvTableDocumentReferenceKey(action.path)) : false;
  });
}

export function csvTableDocumentActionForProjectFile(file: ProjectFileEntry): CanvasNodeAction {
  return {
    kind: "file",
    path: isAbsoluteRuntimePath(file.relativePath) ? file.path : normalizeCsvRelativePath(file.relativePath || file.name),
    openMode: "app-window",
    tooltip: "编辑 CSV 表格"
  };
}

export function csvTableDocumentProjectFileForRuntimeFile(
  file: Pick<ProjectFileEntry, "name" | "path">,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const target = csvTableDocumentReferenceKey(file.path);
  return csvTableProjectFiles(workspace).find((candidate) => csvTableDocumentReferenceKey(candidate.path) === target) ?? {
    name: file.name,
    path: file.path,
    relativePath: file.path
  };
}

export function csvTableProjectFiles(workspace: ProjectWorkspace | null | undefined): ProjectFileEntry[] {
  return (workspace?.resources || [])
    .filter((resource) => resource.kind === "file" && isCsvTableFilePath(resource.path || resource.name))
    .map((resource) => ({
      name: resource.name,
      path: resource.path,
      relativePath: resource.relativePath,
      ...(resource.modifiedAt !== undefined ? { modifiedAt: resource.modifiedAt } : {})
    }))
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" }));
}

export function resolveCsvTableDocumentFile(
  actionPath: string,
  currentFilePath: string | undefined,
  workspace: ProjectWorkspace | null | undefined
): ProjectFileEntry {
  const trimmed = actionPath.trim();
  const comparable = csvTableDocumentReferenceKey(trimmed);
  const projectFile = csvTableProjectFiles(workspace).find((file) => {
    return [file.relativePath, file.path, file.name].some((candidate) => csvTableDocumentReferenceKey(candidate) === comparable);
  });
  if (projectFile) return projectFile;

  const path = isAbsoluteRuntimePath(trimmed)
    ? trimmed
    : joinRuntimePath(workspace?.rootPath || parentDirectoryPath(currentFilePath), trimmed);
  return {
    name: runtimeFileNameFromPath(path || trimmed),
    path: path || trimmed,
    relativePath: trimmed || runtimeFileNameFromPath(path)
  };
}

export function normalizeNewCsvTableFileName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/\0]/.test(trimmed)) return "";
  if (/\.csv$/i.test(trimmed)) return trimmed;
  if (/\.[^.]+$/.test(trimmed)) return "";
  return `${trimmed}.csv`;
}

export function initialCsvTableDocumentSource() {
  return CSV_TABLE_DEFAULT_SOURCE;
}

function isWindowsPath(path: string) {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function normalizeCsvRelativePath(path: string) {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").replace(/\/$/, "");
}
