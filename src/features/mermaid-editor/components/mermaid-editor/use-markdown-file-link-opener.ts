import { useCallback } from "react";

import { resolveMarkdownFileWindowTarget } from "@/features/mermaid-editor/lib/markdown-file-link";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

type OpenFileWindow = (file: ProjectFileEntry) => void | Promise<unknown>;

export function useMarkdownFileLinkOpener({
  projectWorkspace,
  openMarkdownWindow,
  openHtmlWindow,
  openImageWindow,
  openTextWindow,
  openCsvWindow
}: {
  projectWorkspace: ProjectWorkspace | null;
  openMarkdownWindow: OpenFileWindow;
  openHtmlWindow: OpenFileWindow;
  openImageWindow: OpenFileWindow;
  openTextWindow: OpenFileWindow;
  openCsvWindow: OpenFileWindow;
}) {
  return useCallback((href: string, sourceFilePath: string | undefined) => {
    const target = resolveMarkdownFileWindowTarget(href, sourceFilePath, projectWorkspace);
    if (!target) return false;

    if (target.kind === "markdown") void openMarkdownWindow(target.file);
    else if (target.kind === "html") void openHtmlWindow(target.file);
    else if (target.kind === "image") void openImageWindow(target.file);
    else if (target.kind === "text") void openTextWindow(target.file);
    else void openCsvWindow(target.file);
    return true;
  }, [openCsvWindow, openHtmlWindow, openImageWindow, openMarkdownWindow, openTextWindow, projectWorkspace]);
}
