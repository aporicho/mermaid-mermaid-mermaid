import { useCallback, useMemo, useState } from "react";

import {
  explorerWorkspaceTreeState,
  rememberExplorerWorkspaceTreeState,
  type StoredExplorerTreeState
} from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function useEditorExplorerTreeModel({
  initialState,
  projectWorkspace
}: {
  initialState: StoredExplorerTreeState;
  projectWorkspace: ProjectWorkspace | null;
}) {
  const [explorerTreeState, setExplorerTreeState] = useState(initialState);
  const activeExplorerTreeState = useMemo(
    () => projectWorkspace ? explorerWorkspaceTreeState(explorerTreeState, projectWorkspace.rootPath) : null,
    [explorerTreeState, projectWorkspace]
  );
  const updateExplorerTreeState = useCallback((state: { rootExpanded: boolean; expandedDirectoryPaths: string[] }) => {
    if (!projectWorkspace) return;
    setExplorerTreeState((current) => rememberExplorerWorkspaceTreeState(current, {
      rootPath: projectWorkspace.rootPath,
      rootExpanded: state.rootExpanded,
      expandedDirectoryPaths: state.expandedDirectoryPaths
    }));
  }, [projectWorkspace]);

  return { explorerTreeState, setExplorerTreeState, activeExplorerTreeState, updateExplorerTreeState };
}
