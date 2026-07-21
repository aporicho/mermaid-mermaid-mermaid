export type ExplorerWorkspaceTreeState = {
  rootPath: string;
  rootExpanded: boolean;
  expandedDirectoryPaths: string[];
  updatedAt: number;
};

export type StoredExplorerTreeState = {
  workspaces: ExplorerWorkspaceTreeState[];
};

export const EXPLORER_STATE_WORKSPACE_LIMIT = 20;
export const EXPLORER_STATE_DIRECTORY_LIMIT = 1_000;

export const EMPTY_EXPLORER_TREE_STATE: StoredExplorerTreeState = { workspaces: [] };

export function normalizeExplorerTreeState(value: unknown): StoredExplorerTreeState {
  if (!value || typeof value !== "object") return EMPTY_EXPLORER_TREE_STATE;
  const source = value as Partial<StoredExplorerTreeState>;
  if (!Array.isArray(source.workspaces)) return EMPTY_EXPLORER_TREE_STATE;
  const seen = new Set<string>();
  const workspaces = source.workspaces
    .map(normalizeWorkspaceState)
    .filter((workspace): workspace is ExplorerWorkspaceTreeState => Boolean(workspace))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .filter((workspace) => {
      const key = comparableRootPath(workspace.rootPath);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, EXPLORER_STATE_WORKSPACE_LIMIT);
  return { workspaces };
}

export function explorerWorkspaceTreeState(value: StoredExplorerTreeState, rootPath: string): ExplorerWorkspaceTreeState {
  return value.workspaces.find((workspace) => comparableRootPath(workspace.rootPath) === comparableRootPath(rootPath)) ?? {
    rootPath,
    rootExpanded: true,
    expandedDirectoryPaths: [],
    updatedAt: 0
  };
}

export function rememberExplorerWorkspaceTreeState(
  value: StoredExplorerTreeState,
  workspace: Omit<ExplorerWorkspaceTreeState, "updatedAt"> & { updatedAt?: number }
): StoredExplorerTreeState {
  const normalized = normalizeWorkspaceState({ ...workspace, updatedAt: workspace.updatedAt ?? Date.now() });
  if (!normalized) return value;
  const rootKey = comparableRootPath(normalized.rootPath);
  return normalizeExplorerTreeState({
    workspaces: [normalized, ...value.workspaces.filter((candidate) => comparableRootPath(candidate.rootPath) !== rootKey)]
  });
}

export function projectDirectoryAncestors(relativeFilePath: string) {
  const segments = normalizedRelativePath(relativeFilePath).split("/").filter(Boolean);
  segments.pop();
  const paths: string[] = [];
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  }
  return paths;
}

export function validExpandedDirectoryPaths(paths: readonly string[], directoryPaths: ReadonlySet<string>) {
  return normalizedDirectoryPaths(paths).filter((path) => directoryPaths.has(path));
}

function normalizeWorkspaceState(value: unknown): ExplorerWorkspaceTreeState | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<ExplorerWorkspaceTreeState>;
  if (typeof source.rootPath !== "string" || !source.rootPath.trim()) return null;
  return {
    rootPath: source.rootPath,
    rootExpanded: source.rootExpanded !== false,
    expandedDirectoryPaths: normalizedDirectoryPaths(source.expandedDirectoryPaths),
    updatedAt: finitePositiveNumber(source.updatedAt) || 0
  };
}

function normalizedDirectoryPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((path): path is string => typeof path === "string")
    .map(normalizedRelativePath)
    .filter(Boolean))]
    .slice(0, EXPLORER_STATE_DIRECTORY_LIMIT);
}

function normalizedRelativePath(value: string) {
  return value.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function comparableRootPath(value: string) {
  const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[a-z]:/i.test(normalized) ? normalized.toLocaleLowerCase() : normalized;
}

function finitePositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}
