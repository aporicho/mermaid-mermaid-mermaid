import type { Dispatch, SetStateAction } from "react";

import type {
  EditorRuntime,
  RuntimeFileRef,
  RuntimeProjectFileKind
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import {
  initialProjectFileText,
  migrateCurrentProjectFileRef,
  migrateDetachedMarkdownWindows,
  migrateDetachedHtmlWindows,
  migrateRecentProjectFiles,
  projectFileActionUpdates,
  projectRelativePathFromRuntimePath,
  type ProjectFilePathMigration
} from "@/features/mermaid-editor/lib/project-file-actions";
import type {
  ProjectFileEntry,
  ProjectResourceEntry,
  ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import type { DetachedHtmlWindow, DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type ExplorerCreateProjectFileRequest = {
  directoryPath: string;
  fileName: string;
  kind: RuntimeProjectFileKind;
};

export function useProjectFileActions({
  runtime,
  projectWorkspace,
  fileRef,
  graph,
  detachedMarkdownWindows,
  detachedHtmlWindows,
  setProjectBusy,
  setFileRef,
  setFileName,
  setRecentFiles,
  setDetachedMarkdownWindows,
  setDetachedHtmlWindows,
  refreshProjectWorkspace,
  openProjectFile,
  beforeMove,
  applyEditorCommand,
  onDetachedMarkdownWindowMoved,
  onDetachedHtmlWindowMoved,
  onMarkdownFileMoved,
  setStatus,
  showFileWorkflowError
}: {
  runtime: EditorRuntime;
  projectWorkspace: ProjectWorkspace | null;
  fileRef: RuntimeFileRef | null;
  graph: MermaidGraph;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedHtmlWindows: DetachedHtmlWindow[];
  setProjectBusy: StateSetter<boolean>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setFileName: StateSetter<string>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
  setDetachedHtmlWindows: StateSetter<DetachedHtmlWindow[]>;
  refreshProjectWorkspace: () => void | Promise<unknown>;
  openProjectFile: (file: ProjectFileEntry) => void | Promise<unknown>;
  beforeMove?: () => boolean | void | Promise<boolean | void>;
  applyEditorCommand: (command: EditorCommand) => void;
  onDetachedMarkdownWindowMoved?: (source: RuntimeFileRef, target: RuntimeFileRef) => void;
  onDetachedHtmlWindowMoved?: (source: RuntimeFileRef, target: RuntimeFileRef) => void;
  onMarkdownFileMoved?: (sourcePath: string, targetPath: string) => void | Promise<void>;
  setStatus: (message: string) => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
}) {
  async function createProjectFile(request: ExplorerCreateProjectFileRequest) {
    if (!projectWorkspace) return;
    setProjectBusy(true);
    try {
      const text = initialProjectFileText(request.kind, request.fileName);
      const result = await runtime.createProjectFile({
        rootPath: projectWorkspace.rootPath,
        directoryPath: request.directoryPath,
        fileName: request.fileName,
        kind: request.kind,
        text
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      if (result.status === "exists") {
        setStatus(`${result.file.name} 已存在。`);
        return;
      }

      await refreshProjectWorkspace();
      setStatus(`已创建 ${result.file.name}。`);
      if (request.kind === "csv" || request.kind === "html" || !result.file.path) return;
      await openProjectFile({
        name: result.file.name,
        path: result.file.path,
        relativePath: projectRelativePathFromRuntimePath(projectWorkspace.rootPath, result.file.path)
      });
    } catch (error) {
      showFileWorkflowError(error, "创建项目文件失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function moveProjectFile(source: ProjectResourceEntry, targetDirectoryPath: string) {
    if (!projectWorkspace || source.kind !== "file") return;
    setProjectBusy(true);
    try {
      if (await beforeMove?.() === false) {
        setStatus("存在尚未写回的 CSV 编辑，已取消移动。");
        return;
      }
      const result = await runtime.moveProjectFile({
        rootPath: projectWorkspace.rootPath,
        sourcePath: source.path,
        targetDirectoryPath
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      if (result.status === "exists") {
        setStatus(`${result.file.name} 已存在于目标文件夹。`);
        return;
      }
      if (result.status === "noop") {
        setStatus(`${result.file.name} 已在目标文件夹中。`);
        return;
      }

      const targetPath = result.file.path;
      if (targetPath) {
        await onMarkdownFileMoved?.(source.path, targetPath);
        const migration: ProjectFilePathMigration = {
          sourceAbsolutePath: source.path,
          sourceRelativePath: source.relativePath,
          sourceName: source.name,
          targetFile: { ...result.file, path: targetPath },
          targetRelativePath: projectRelativePathFromRuntimePath(projectWorkspace.rootPath, targetPath)
        };
        const currentFile = migrateCurrentProjectFileRef(fileRef, migration);
        if (currentFile !== fileRef) {
          setFileRef(currentFile);
          setFileName(result.file.name);
        }
        setRecentFiles((current) => migrateRecentProjectFiles(current, migration));
        const detachedWindow = detachedMarkdownWindows.find((window) => window.file.path === source.path);
        if (detachedWindow) onDetachedMarkdownWindowMoved?.(detachedWindow.file, result.file);
        setDetachedMarkdownWindows((current) => migrateDetachedMarkdownWindows(current, migration));
        const detachedHtmlWindow = detachedHtmlWindows.find((window) => window.file.path === source.path);
        if (detachedHtmlWindow) onDetachedHtmlWindowMoved?.(detachedHtmlWindow.file, result.file);
        setDetachedHtmlWindows((current) => migrateDetachedHtmlWindows(current, migration));
        const updates = projectFileActionUpdates(graph, migration);
        if (updates.length) {
          applyEditorCommand({
            type: "graph.updateNodeActions",
            updates,
            message: "已更新移动文件的节点链接。",
            source: "api"
          });
        }
      }

      await refreshProjectWorkspace();
      setStatus(`已移动 ${result.file.name}。`);
    } catch (error) {
      showFileWorkflowError(error, "移动项目文件失败。");
      try {
        await refreshProjectWorkspace();
      } catch {
        // The mutation result is uncertain, so refresh is best-effort in the error path.
      }
    } finally {
      setProjectBusy(false);
    }
  }

  return { createProjectFile, moveProjectFile };
}
