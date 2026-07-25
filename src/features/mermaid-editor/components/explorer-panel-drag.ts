import type { ProjectResourceEntry } from "@/features/mermaid-editor/lib/project-workspace";

export type ExplorerDropIntent =
  | { kind: "directory"; directoryPath: string }
  | { kind: "order"; parentDirectoryPath: string; resourceKind: ProjectResourceEntry["kind"]; beforeRelativePath: string | null };

export function resolveExplorerDropIntentAtPoint(
  root: HTMLDivElement | null,
  x: number,
  y: number,
  options: {
    sortingEnabled: boolean;
    draggedKind: ProjectResourceEntry["kind"];
  }
): ExplorerDropIntent | null {
  if (!root || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return null;
  const element = document.elementFromPoint(x, y);
  const row = element?.closest<HTMLElement>("[data-project-resource-path],[data-project-directory-path]");
  if (!row || !root.contains(row)) return null;

  const directoryPath = row.dataset.projectDirectoryPath;
  const resourceKind = resourceKindFromDataset(row.dataset.projectResourceKind);
  const resourceRelativePath = row.dataset.projectResourceRelativePath || "";
  const parentDirectoryPath = row.dataset.projectResourceParentPath || "";

  if (options.sortingEnabled && resourceKind && resourceRelativePath && resourceKind === options.draggedKind) {
    const rect = row.getBoundingClientRect();
    const pointerRatio = rect.height > 0 ? (y - rect.top) / rect.height : 0.5;
    const directoryCenterDrop = typeof directoryPath === "string" && pointerRatio > 0.32 && pointerRatio < 0.68;
    if (!directoryCenterDrop) {
      return {
        kind: "order",
        parentDirectoryPath,
        resourceKind,
        beforeRelativePath: pointerRatio < 0.5
          ? resourceRelativePath
          : nextResourceRelativePath(root, parentDirectoryPath, resourceKind, resourceRelativePath)
      };
    }
  }

  return typeof directoryPath === "string" ? { kind: "directory", directoryPath } : null;
}

export function orderedRelativePathsForDrop(
  resources: readonly ProjectResourceEntry[],
  draggedResources: readonly ProjectResourceEntry[],
  intent: Extract<ExplorerDropIntent, { kind: "order" }>
) {
  const dragged = draggedResources.filter((resource) =>
    resource.kind === intent.resourceKind &&
    parentResourceDirectory(resource.relativePath) === intent.parentDirectoryPath
  );
  if (!dragged.length) return null;

  const draggedPathSet = new Set(dragged.map((resource) => resource.relativePath));
  const currentOrder = resourceGroupRelativePaths(resources, intent.parentDirectoryPath, intent.resourceKind);
  const draggedOrder = currentOrder.filter((relativePath) => draggedPathSet.has(relativePath));
  if (!draggedOrder.length) return null;

  const remaining = currentOrder.filter((relativePath) => !draggedPathSet.has(relativePath));
  const insertIndex = intent.beforeRelativePath ? remaining.indexOf(intent.beforeRelativePath) : remaining.length;
  const safeInsertIndex = insertIndex >= 0 ? insertIndex : remaining.length;
  const nextOrder = [
    ...remaining.slice(0, safeInsertIndex),
    ...draggedOrder,
    ...remaining.slice(safeInsertIndex)
  ];
  return sameStringArray(currentOrder, nextOrder) ? null : nextOrder;
}

export function isDirectoryDropAllowed(resources: readonly ProjectResourceEntry[], draggedResources: readonly ProjectResourceEntry[], directoryPath: string) {
  const allowedBySelection = draggedResources.every((resource) => {
    if (parentResourceDirectory(resource.relativePath) === directoryPath) return false;
    if (resource.kind !== "directory") return true;
    return directoryPath !== resource.relativePath && !directoryPath.startsWith(`${resource.relativePath}/`);
  });
  if (!allowedBySelection) return false;
  return directoryPath === "" || resources.some((resource) => resource.kind === "directory" && resource.relativePath === directoryPath);
}

export function sameExplorerDropIntent(left: ExplorerDropIntent | null, right: ExplorerDropIntent | null) {
  if (!left || !right) return left === right;
  if (left.kind !== right.kind) return false;
  if (left.kind === "directory") return left.directoryPath === (right as Extract<ExplorerDropIntent, { kind: "directory" }>).directoryPath;
  const order = right as Extract<ExplorerDropIntent, { kind: "order" }>;
  return left.parentDirectoryPath === order.parentDirectoryPath &&
    left.resourceKind === order.resourceKind &&
    left.beforeRelativePath === order.beforeRelativePath;
}

export function resourceGroupRelativePaths(resources: readonly ProjectResourceEntry[], parentDirectoryPath: string, kind: ProjectResourceEntry["kind"]) {
  return resources
    .filter((resource) => resource.kind === kind && parentResourceDirectory(resource.relativePath) === parentDirectoryPath)
    .map((resource) => resource.relativePath);
}

export function parentResourceDirectory(relativePath: string) {
  const segments = relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function nextResourceRelativePath(root: HTMLDivElement, parentDirectoryPath: string, kind: ProjectResourceEntry["kind"], relativePath: string) {
  const rows = [...root.querySelectorAll<HTMLElement>("[data-project-resource-relative-path]")]
    .filter((row) =>
      row.dataset.projectResourceParentPath === parentDirectoryPath &&
      row.dataset.projectResourceKind === kind
    );
  const index = rows.findIndex((row) => row.dataset.projectResourceRelativePath === relativePath);
  return index >= 0 ? rows[index + 1]?.dataset.projectResourceRelativePath || null : null;
}

function resourceKindFromDataset(value: string | undefined) {
  return value === "directory" || value === "file" ? value : null;
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
