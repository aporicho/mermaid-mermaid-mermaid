import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

type ExplorerFileRef = {
  name?: string;
  path?: string;
} | null;

export type ExplorerStartupContext = {
  startWithPanelsCollapsed: boolean;
  storedCollapsed?: boolean;
  projectWorkspace?: ProjectWorkspace | null;
  recentFiles?: RecentFileEntry[];
  fileRef?: ExplorerFileRef;
  fileName?: string;
  fallbackFileName: string;
};

export function shouldCollapseExplorerOnStartup(context: ExplorerStartupContext) {
  if (context.startWithPanelsCollapsed) return true;
  if (!hasExplorerContext(context)) return true;
  return context.storedCollapsed ?? false;
}

function hasExplorerContext(context: ExplorerStartupContext) {
  return Boolean(
    context.projectWorkspace ||
      context.recentFiles?.length ||
      context.fileRef?.path ||
      context.fileRef?.name ||
      (context.fileName && context.fileName !== context.fallbackFileName)
  );
}
