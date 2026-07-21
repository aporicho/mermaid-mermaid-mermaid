import { describe, expect, it } from "vitest";

import {
  EXPLORER_STATE_DIRECTORY_LIMIT,
  EXPLORER_STATE_WORKSPACE_LIMIT,
  explorerWorkspaceTreeState,
  normalizeExplorerTreeState,
  projectDirectoryAncestors,
  rememberExplorerWorkspaceTreeState,
  validExpandedDirectoryPaths
} from "@/features/mermaid-editor/lib/explorer-tree-state";

describe("explorer tree state", () => {
  it("normalizes, deduplicates, and bounds remembered workspaces", () => {
    const normalized = normalizeExplorerTreeState({
      workspaces: Array.from({ length: EXPLORER_STATE_WORKSPACE_LIMIT + 2 }, (_item, index) => ({
        rootPath: index < 2 ? "C:\\Repo" : `C:\\Repo-${index}`,
        rootExpanded: index !== 1,
        expandedDirectoryPaths: Array.from({ length: EXPLORER_STATE_DIRECTORY_LIMIT + 2 }, (_entry, pathIndex) => `docs\\${pathIndex}`),
        updatedAt: index < 2 ? 100 + index : index + 1
      }))
    });

    expect(normalized.workspaces).toHaveLength(EXPLORER_STATE_WORKSPACE_LIMIT);
    expect(normalized.workspaces.filter((workspace) => workspace.rootPath.toLocaleLowerCase() === "c:\\repo")).toHaveLength(1);
    expect(normalized.workspaces[0]?.expandedDirectoryPaths).toHaveLength(EXPLORER_STATE_DIRECTORY_LIMIT);
    expect(normalized.workspaces[0]?.expandedDirectoryPaths[0]).toContain("/");
  });

  it("remembers expansion separately by workspace and defaults new roots to expanded", () => {
    const state = rememberExplorerWorkspaceTreeState({ workspaces: [] }, {
      rootPath: "/project-a",
      rootExpanded: false,
      expandedDirectoryPaths: ["docs", "docs/core"],
      updatedAt: 10
    });

    expect(explorerWorkspaceTreeState(state, "/project-a")).toMatchObject({ rootExpanded: false, expandedDirectoryPaths: ["docs", "docs/core"] });
    expect(explorerWorkspaceTreeState(state, "/project-b")).toMatchObject({ rootExpanded: true, expandedDirectoryPaths: [] });
  });

  it("derives active-file ancestors and removes missing directories", () => {
    expect(projectDirectoryAncestors("docs/core/model.mmd")).toEqual(["docs", "docs/core"]);
    expect(validExpandedDirectoryPaths(["docs", "missing", "docs/core"], new Set(["docs", "docs/core"]))).toEqual(["docs", "docs/core"]);
  });
});
