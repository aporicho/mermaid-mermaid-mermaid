import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { ImageWindowNavigation, ImageWindowNavigationRequest } from "@/features/mermaid-editor/lib/workspace-panels";

export function projectDirectoryImageNavigation(
  workspace: ProjectWorkspace | null,
  selectedFile: ProjectFileEntry
): ImageWindowNavigationRequest {
  const directory = normalizedParentPath(selectedFile.relativePath);
  const items = (workspace?.resources || [])
    .filter((resource) => resource.kind === "file" && isSupportedImagePath(resource.path) && normalizedParentPath(resource.relativePath) === directory)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }))
    .map((resource) => ({
      source: resource.path,
      title: resource.name,
      identity: resource.path,
      watchPath: resource.path
    }));

  return {
    kind: "project-directory",
    items: items.length ? items : [{
      source: selectedFile.path,
      title: selectedFile.name,
      identity: selectedFile.path,
      watchPath: selectedFile.path
    }]
  };
}

export function adjacentImageNavigationIndex(navigation: Pick<ImageWindowNavigation, "index" | "items">, direction: -1 | 1) {
  if (navigation.items.length <= 1) return 0;
  return (navigation.index + direction + navigation.items.length) % navigation.items.length;
}

function normalizedParentPath(path: string) {
  const normalized = path.trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index).toLocaleLowerCase() : "";
}
