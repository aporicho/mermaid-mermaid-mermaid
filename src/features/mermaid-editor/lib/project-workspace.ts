import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { documentKindFromPath, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";

export type ProjectFileEntry = {
  name: string;
  path: string;
  relativePath: string;
  modifiedAt?: number;
};

export type ProjectWorkspace = {
  rootName: string;
  rootPath: string;
  files: ProjectFileEntry[];
  resources?: ProjectResourceEntry[];
  resourceOrder?: ProjectExplorerOrderState;
  scannedAt: number;
  truncated?: boolean;
  resourcesTruncated?: boolean;
};

export type ProjectExplorerOrderGroup = {
  directories: string[];
  files: string[];
};

export type ProjectExplorerOrderState = {
  version: 1;
  directories: Record<string, ProjectExplorerOrderGroup>;
};

export type ProjectResourceEntry = {
  kind: "directory" | "file";
  name: string;
  path: string;
  relativePath: string;
  documentKind?: DocumentKind;
  modifiedAt?: number;
};

export type ProjectTreeFileNode = {
  kind: "file";
  id: string;
  name: string;
  relativePath: string;
  resource: ProjectResourceEntry;
  file?: ProjectFileEntry;
};

export type ProjectTreeDirectoryNode = {
  kind: "directory";
  id: string;
  name: string;
  path: string;
  relativePath: string;
  fileCount: number;
  resourceCount: number;
  children: ProjectTreeNode[];
};

export type ProjectTreeNode = ProjectTreeDirectoryNode | ProjectTreeFileNode;

export type ProjectResourceTreeNode = ProjectTreeNode;

export const PROJECT_FILE_LIMIT = 500;
export const PROJECT_RESOURCE_LIMIT = 10_000;

export function normalizeProjectWorkspace(value: unknown): ProjectWorkspace | null {
  if (!value || typeof value !== "object") return null;
  const workspace = value as Partial<ProjectWorkspace>;
  if (!workspace.rootName || !workspace.rootPath || typeof workspace.rootName !== "string" || typeof workspace.rootPath !== "string") {
    return null;
  }

  const files = normalizeProjectFiles(workspace.files);
  const resourceOrder = normalizeProjectExplorerOrderState(workspace.resourceOrder);
  const resources = normalizeProjectResources(workspace.resources, files, resourceOrder);
  return {
    rootName: workspace.rootName,
    rootPath: workspace.rootPath,
    files,
    resources,
    ...(resourceOrder ? { resourceOrder } : {}),
    scannedAt: normalizeNumber(workspace.scannedAt) || Date.now(),
    truncated: Boolean(workspace.truncated),
    resourcesTruncated: Boolean(workspace.resourcesTruncated)
  };
}

export function projectWorkspaceForStorage(workspace: ProjectWorkspace | null): ProjectWorkspace | null {
  if (!workspace) return null;
  return {
    rootName: workspace.rootName,
    rootPath: workspace.rootPath,
    files: workspace.files,
    scannedAt: workspace.scannedAt,
    truncated: workspace.truncated,
    resourcesTruncated: workspace.resourcesTruncated
  };
}

export function normalizeProjectResources(value: unknown, fallbackFiles: ProjectFileEntry[] = [], order?: ProjectExplorerOrderState | null): ProjectResourceEntry[] {
  if (!Array.isArray(value)) return sortProjectResources(projectResourcesFromFiles(fallbackFiles), order);
  const seen = new Set<string>();
  const resources: ProjectResourceEntry[] = [];
  for (const item of value) {
    const resource = normalizeProjectResourceEntry(item);
    if (!resource) continue;
    const key = `${resource.kind}:${normalizeComparablePath(resource.path)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resources.push(resource);
    if (resources.length >= PROJECT_RESOURCE_LIMIT) break;
  }
  return sortProjectResources(resources, order);
}

export function projectResourcesFromFiles(files: ProjectFileEntry[]): ProjectResourceEntry[] {
  return files.map((file) => ({
    kind: "file",
    name: file.name,
    path: file.path,
    relativePath: file.relativePath,
    documentKind: documentKindFromPath(file.path),
    ...(file.modifiedAt ? { modifiedAt: file.modifiedAt } : {})
  }));
}

export function sortProjectResources(resources: ProjectResourceEntry[], order?: ProjectExplorerOrderState | null) {
  return [...resources].sort((left, right) => {
    const leftDepth = pathSegments(left.relativePath).length;
    const rightDepth = pathSegments(right.relativePath).length;
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    const leftParent = parentProjectResourceDirectory(left.relativePath);
    const rightParent = parentProjectResourceDirectory(right.relativePath);
    if (leftParent === rightParent) {
      const siblingOrder = compareProjectResourceSiblings(left, right, order);
      if (siblingOrder !== 0) return siblingOrder;
    }
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" });
  });
}

export function normalizeProjectFiles(value: unknown): ProjectFileEntry[] {
  if (!Array.isArray(value)) return [];
  return sortProjectFiles(value.reduce<ProjectFileEntry[]>((files, item) => {
    const entry = normalizeProjectFileEntry(item);
    if (!entry) return files;
    if (files.some((file) => file.path === entry.path)) return files;
    return [...files, entry];
  }, [])).slice(0, PROJECT_FILE_LIMIT);
}

export function sortProjectFiles(files: ProjectFileEntry[]) {
  return [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" }));
}

export function filterProjectFiles(files: ProjectFileEntry[], query: string) {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return files;

  return files.filter((file) => {
    const haystack = `${file.name}\n${file.relativePath}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function isProjectFileActive(file: ProjectFileEntry, currentFileRef: RuntimeFileRef | null | undefined) {
  if (!currentFileRef?.path) return false;
  const currentPath = normalizeComparablePath(currentFileRef.path);
  const projectPath = normalizeComparablePath(file.path);
  if (currentPath === projectPath) return true;
  return isWindowsLikePath(file.path) || isWindowsLikePath(currentFileRef.path)
    ? currentPath.toLowerCase() === projectPath.toLowerCase()
    : false;
}

export function parentDirectoryFromRuntimePath(path: string | undefined) {
  const trimmed = path?.trim().replace(/[\\/]+$/, "");
  if (!trimmed) return undefined;

  const slashIndex = trimmed.lastIndexOf("/");
  const backslashIndex = trimmed.lastIndexOf("\\");
  const separatorIndex = Math.max(slashIndex, backslashIndex);
  if (separatorIndex < 0) return undefined;

  const separator = trimmed[separatorIndex];
  const parent = trimmed.slice(0, separatorIndex);
  if (!parent && separator === "/") return "/";
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}${separator}`;
  return parent || undefined;
}

export function isRuntimePathInsideProjectWorkspace(path: string | undefined, workspace: ProjectWorkspace | null | undefined) {
  if (!path || !workspace?.rootPath) return false;
  const filePath = normalizeComparablePath(path);
  const rootPath = normalizeComparablePath(workspace.rootPath);
  if (!filePath || !rootPath) return false;

  const shouldIgnoreCase = isWindowsLikePath(path) || isWindowsLikePath(workspace.rootPath);
  const comparableFilePath = shouldIgnoreCase ? filePath.toLowerCase() : filePath;
  const comparableRootPath = shouldIgnoreCase ? rootPath.toLowerCase() : rootPath;
  const comparableRootPrefix = comparableRootPath.endsWith("/") ? comparableRootPath : `${comparableRootPath}/`;
  return comparableFilePath === comparableRootPath || comparableFilePath.startsWith(comparableRootPrefix);
}

export function workspaceRootForOpenedFile(path: string | undefined, workspace: ProjectWorkspace | null | undefined) {
  if (!path || isRuntimePathInsideProjectWorkspace(path, workspace)) return undefined;
  return parentDirectoryFromRuntimePath(path);
}

export function buildProjectFileTree(files: ProjectFileEntry[]): ProjectTreeNode[] {
  return buildProjectResourceTree(projectResourcesFromFiles(files), files);
}

export function buildProjectResourceTree(resources: ProjectResourceEntry[], files: ProjectFileEntry[] = [], order?: ProjectExplorerOrderState | null): ProjectResourceTreeNode[] {
  const directories = new Map<string, ProjectTreeDirectoryNode>();
  const roots: ProjectTreeNode[] = [];
  const projectFilesByPath = new Map(files.map((file) => [normalizeComparablePath(file.path), file]));

  for (const resource of sortProjectResources(resources, order)) {
    const segments = pathSegments(resource.relativePath);
    const resourceName = segments.pop() || resource.name;
    let parentChildren = roots;
    let parentPath = "";
    const ancestorDirectories: ProjectTreeDirectoryNode[] = [];

    const directorySegments = resource.kind === "directory" ? [...segments, resourceName] : segments;
    for (const segment of directorySegments) {
      const relativePath = parentPath ? `${parentPath}/${segment}` : segment;
      let directory = directories.get(relativePath);
      if (!directory) {
        directory = {
          kind: "directory",
          id: `dir:${relativePath}`,
          name: segment,
          path: resource.kind === "directory" && relativePath === resource.relativePath
            ? resource.path
            : runtimePathForRelativeResource(resource.path, resource.relativePath, relativePath),
          relativePath,
          fileCount: 0,
          resourceCount: 0,
          children: []
        };
        directories.set(relativePath, directory);
        parentChildren.push(directory);
      }
      ancestorDirectories.push(directory);
      parentChildren = directory.children;
      parentPath = relativePath;
    }

    if (resource.kind === "directory") continue;
    for (const directory of ancestorDirectories) {
      directory.resourceCount += 1;
      if (resource.documentKind) directory.fileCount += 1;
    }
    const projectFile = projectFilesByPath.get(normalizeComparablePath(resource.path));
    parentChildren.push({
      kind: "file",
      id: `file:${resource.path}`,
      name: resourceName,
      relativePath: resource.relativePath,
      resource,
      ...(projectFile ? { file: projectFile } : {})
    });
  }

  return sortProjectTreeNodes(roots, order);
}

export function normalizeProjectExplorerOrderState(value: unknown): ProjectExplorerOrderState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<ProjectExplorerOrderState>;
  if (state.version !== 1 || !state.directories || typeof state.directories !== "object") return null;
  const directories: Record<string, ProjectExplorerOrderGroup> = {};
  for (const [rawParentPath, rawGroup] of Object.entries(state.directories)) {
    const parentPath = normalizeProjectRelativePath(rawParentPath);
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const group = rawGroup as Partial<ProjectExplorerOrderGroup>;
    const directoryPaths = normalizeOrderedRelativePaths(group.directories, parentPath);
    const filePaths = normalizeOrderedRelativePaths(group.files, parentPath);
    if (directoryPaths.length || filePaths.length) {
      directories[parentPath] = { directories: directoryPaths, files: filePaths };
    }
  }
  return Object.keys(directories).length ? { version: 1, directories } : null;
}

export function projectTreeDirectoryIds(nodes: ProjectTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "directory" ? [node.id, ...projectTreeDirectoryIds(node.children)] : []
  );
}

function normalizeProjectFileEntry(value: unknown): ProjectFileEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<ProjectFileEntry>;
  if (!entry.path || typeof entry.path !== "string") return null;
  const relativePath = typeof entry.relativePath === "string" && entry.relativePath.trim()
    ? entry.relativePath
    : fileNameFromPath(entry.path);
  const name = typeof entry.name === "string" && entry.name.trim() ? entry.name : fileNameFromPath(relativePath);
  const modifiedAt = normalizeNumber(entry.modifiedAt);

  return {
    name,
    path: entry.path,
    relativePath: relativePath.replaceAll("\\", "/"),
    ...(modifiedAt ? { modifiedAt } : {})
  };
}

function normalizeProjectResourceEntry(value: unknown): ProjectResourceEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<ProjectResourceEntry>;
  if ((entry.kind !== "directory" && entry.kind !== "file") || !entry.path || typeof entry.path !== "string") return null;
  const relativePath = typeof entry.relativePath === "string" && entry.relativePath.trim()
    ? entry.relativePath.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
    : fileNameFromPath(entry.path);
  if (!relativePath) return null;
  const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : fileNameFromPath(relativePath);
  const modifiedAt = normalizeNumber(entry.modifiedAt);
  const documentKind = entry.kind === "file" ? documentKindFromPath(entry.path) : undefined;
  return {
    kind: entry.kind,
    name,
    path: entry.path,
    relativePath,
    ...(documentKind ? { documentKind } : {}),
    ...(modifiedAt ? { modifiedAt } : {})
  };
}

function sortProjectTreeNodes(nodes: ProjectTreeNode[], order: ProjectExplorerOrderState | null | undefined, parentPath = ""): ProjectTreeNode[] {
  return [...nodes]
    .map((node) => (node.kind === "directory" ? { ...node, children: sortProjectTreeNodes(node.children, order, node.relativePath) } : node))
    .sort((left, right) => {
      const siblingOrder = compareProjectTreeSiblings(left, right, order, parentPath);
      if (siblingOrder !== 0) return siblingOrder;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
}

function compareProjectTreeSiblings(left: ProjectTreeNode, right: ProjectTreeNode, order: ProjectExplorerOrderState | null | undefined, parentPath: string) {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  const group = order?.directories[parentPath];
  if (!group) return 0;
  const orderedPaths = left.kind === "directory" ? group.directories : group.files;
  return compareOrderedRelativePaths(left.relativePath, right.relativePath, orderedPaths);
}

function compareProjectResourceSiblings(left: ProjectResourceEntry, right: ProjectResourceEntry, order: ProjectExplorerOrderState | null | undefined) {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  const parentPath = parentProjectResourceDirectory(left.relativePath);
  const group = order?.directories[parentPath];
  if (!group) return 0;
  const orderedPaths = left.kind === "directory" ? group.directories : group.files;
  return compareOrderedRelativePaths(left.relativePath, right.relativePath, orderedPaths);
}

function compareOrderedRelativePaths(leftPath: string, rightPath: string, orderedPaths: readonly string[]) {
  const leftIndex = orderedPaths.indexOf(normalizeProjectRelativePath(leftPath));
  const rightIndex = orderedPaths.indexOf(normalizeProjectRelativePath(rightPath));
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return 0;
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "diagram.mmd";
}

function pathSegments(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean);
}

function parentProjectResourceDirectory(relativePath: string) {
  const segments = pathSegments(relativePath);
  segments.pop();
  return segments.join("/");
}

function normalizeProjectRelativePath(path: string) {
  return String(path || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
}

function normalizeOrderedRelativePaths(value: unknown, parentPath: string) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  const parentPrefix = parentPath ? `${parentPath}/` : "";
  for (const item of value) {
    const relativePath = normalizeProjectRelativePath(String(item || ""));
    if (!relativePath || seen.has(relativePath)) continue;
    if (parentPath && !relativePath.startsWith(parentPrefix)) continue;
    if (!parentPath && relativePath.includes("/") && parentProjectResourceDirectory(relativePath) !== "") continue;
    seen.add(relativePath);
    normalized.push(relativePath);
  }
  return normalized;
}

function runtimePathForRelativeResource(resourcePath: string, resourceRelativePath: string, targetRelativePath: string) {
  const separator = resourcePath.includes("\\") && !resourcePath.includes("/") ? "\\" : "/";
  const resourceSegments = pathSegments(resourceRelativePath);
  const targetSegments = pathSegments(targetRelativePath);
  const baseSegmentsToRemove = resourceSegments.length;
  let rootPath = resourcePath;
  for (let index = 0; index < baseSegmentsToRemove; index += 1) {
    const separatorIndex = Math.max(rootPath.lastIndexOf("/"), rootPath.lastIndexOf("\\"));
    if (separatorIndex < 0) break;
    rootPath = rootPath.slice(0, separatorIndex);
  }
  return [rootPath.replace(/[\\/]+$/, ""), ...targetSegments].filter(Boolean).join(separator) || resourcePath;
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizeComparablePath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  if (/^[A-Za-z]:$/.test(normalized)) return `${normalized}/`;
  return normalized || (path.startsWith("/") ? "/" : normalized);
}

function isWindowsLikePath(path: string) {
  return path.includes("\\") || /^[a-z]:/i.test(path);
}
