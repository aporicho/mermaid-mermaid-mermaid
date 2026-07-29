import { useCallback } from "react";

import { useMarkdownFileLinkOpener } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-file-link-opener";
import { useProjectResourceOpener } from "@/features/mermaid-editor/components/mermaid-editor/use-project-resource-opener";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { WorkspaceWindowPlacementAnchor } from "@/features/mermaid-editor/lib/project-resource-open";
import type { WorkspaceWindowOpenRequest } from "@/features/mermaid-editor/lib/workspace-panels";

type OpenCurrentFile = (file: ProjectFileEntry) => void | Promise<unknown>;
type OpenFloatingFile = (file: ProjectFileEntry, request?: WorkspaceWindowOpenRequest) => void | Promise<unknown>;

export function useEditorProjectResourceOpening({
  projectWorkspace,
  currentFilePath,
  openCurrentFile,
  openMarkdownWindow,
  openHtmlWindow,
  openImageWindow,
  openTextWindow,
  openCsvWindow,
  onStatus,
  onError
}: {
  projectWorkspace: ProjectWorkspace | null;
  currentFilePath?: string;
  openCurrentFile: OpenCurrentFile;
  openMarkdownWindow: OpenFloatingFile;
  openHtmlWindow: OpenFloatingFile;
  openImageWindow: OpenFloatingFile;
  openTextWindow: OpenFloatingFile;
  openCsvWindow: OpenFloatingFile;
  onStatus: (message: string) => void;
  onError: (error: unknown, fallbackMessage?: string) => void;
}) {
  const openProjectResource = useProjectResourceOpener({
    openCurrentFile,
    openMarkdownWindow,
    openHtmlWindow,
    openImageWindow,
    openTextWindow,
    openCsvWindow,
    onStatus,
    onError
  });
  const openMarkdownLink = useMarkdownFileLinkOpener({ projectWorkspace, openProjectResource });
  const openProjectFile = useCallback((file: ProjectFileEntry) => {
    openProjectResource({ file, mode: "current", source: "explorer" });
  }, [openProjectResource]);
  const openProjectFileWindow = useCallback((file: ProjectFileEntry) => {
    openProjectResource({ file, mode: "floating", source: "explorer" });
  }, [openProjectResource]);
  const openCurrentMarkdownFileLink = useCallback((href: string, context: WorkspaceWindowPlacementAnchor) => {
    return openMarkdownLink(href, currentFilePath, context);
  }, [currentFilePath, openMarkdownLink]);

  return {
    openProjectResource,
    openProjectFile,
    openProjectFileWindow,
    openMarkdownFileLink: openMarkdownLink,
    openCurrentMarkdownFileLink
  };
}
