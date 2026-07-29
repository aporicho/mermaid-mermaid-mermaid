import { useCallback, useMemo } from "react";

import {
  createMarkdownFileLinkIndex,
  resolveMarkdownFileWindowTarget
} from "@/features/mermaid-editor/lib/markdown-file-link";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  ProjectResourceOpenRequest,
  WorkspaceWindowPlacementAnchor
} from "@/features/mermaid-editor/lib/project-resource-open";

export function useMarkdownFileLinkOpener({
  projectWorkspace,
  openProjectResource
}: {
  projectWorkspace: ProjectWorkspace | null;
  openProjectResource: (request: ProjectResourceOpenRequest) => boolean;
}) {
  const linkIndex = useMemo(() => createMarkdownFileLinkIndex(projectWorkspace), [projectWorkspace]);

  return useCallback((
    href: string,
    sourceFilePath: string | undefined,
    context: WorkspaceWindowPlacementAnchor
  ) => {
    const target = resolveMarkdownFileWindowTarget(href, sourceFilePath, linkIndex);
    if (!target) return false;

    return openProjectResource({
      file: target.file,
      mode: "floating",
      source: "markdown-link",
      placementAnchor: context
    });
  }, [linkIndex, openProjectResource]);
}
