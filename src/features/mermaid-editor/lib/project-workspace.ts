import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

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
  scannedAt: number;
  truncated?: boolean;
};

export type ProjectTreeFileNode = {
  kind: "file";
  id: string;
  name: string;
  relativePath: string;
  file: ProjectFileEntry;
};

export type ProjectTreeDirectoryNode = {
  kind: "directory";
  id: string;
  name: string;
  relativePath: string;
  fileCount: number;
  children: ProjectTreeNode[];
};

export type ProjectTreeNode = ProjectTreeDirectoryNode | ProjectTreeFileNode;

export const PROJECT_FILE_LIMIT = 500;

export function normalizeProjectWorkspace(value: unknown): ProjectWorkspace | null {
  if (!value || typeof value !== "object") return null;
  const workspace = value as Partial<ProjectWorkspace>;
  if (!workspace.rootName || !workspace.rootPath || typeof workspace.rootName !== "string" || typeof workspace.rootPath !== "string") {
    return null;
  }

  return {
    rootName: workspace.rootName,
    rootPath: workspace.rootPath,
    files: normalizeProjectFiles(workspace.files),
    scannedAt: normalizeNumber(workspace.scannedAt) || Date.now(),
    truncated: Boolean(workspace.truncated)
  };
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

export function buildProjectFileTree(files: ProjectFileEntry[]): ProjectTreeNode[] {
  const directories = new Map<string, ProjectTreeDirectoryNode>();
  const roots: ProjectTreeNode[] = [];

  for (const file of sortProjectFiles(files)) {
    const segments = file.relativePath.split("/").filter(Boolean);
    const fileName = segments.pop() || file.name;
    let parentChildren = roots;
    let parentPath = "";

    for (const segment of segments) {
      const relativePath = parentPath ? `${parentPath}/${segment}` : segment;
      let directory = directories.get(relativePath);
      if (!directory) {
        directory = {
          kind: "directory",
          id: `dir:${relativePath}`,
          name: segment,
          relativePath,
          fileCount: 0,
          children: []
        };
        directories.set(relativePath, directory);
        parentChildren.push(directory);
      }
      directory.fileCount += 1;
      parentChildren = directory.children;
      parentPath = relativePath;
    }

    parentChildren.push({
      kind: "file",
      id: `file:${file.path}`,
      name: fileName,
      relativePath: file.relativePath,
      file
    });
  }

  return sortProjectTreeNodes(roots);
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

function sortProjectTreeNodes(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
  return [...nodes]
    .map((node) => (node.kind === "directory" ? { ...node, children: sortProjectTreeNodes(node.children) } : node))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) || "diagram.mmd";
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function normalizeComparablePath(path: string) {
  return path.replaceAll("\\", "/");
}

function isWindowsLikePath(path: string) {
  return path.includes("\\") || /^[a-z]:/i.test(path);
}
