import type { Dispatch, SetStateAction } from "react";

import type {
  EditorRuntime,
  RuntimeFileRef,
  RuntimeProjectFileKind,
  RuntimeProjectResourceKind,
  RuntimeProjectResourcePlacement
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import {
  initialProjectFileText,
  migrateCurrentProjectFileRef,
  migrateDetachedMarkdownWindows,
  migrateDetachedHtmlWindows,
  migrateDetachedImageWindows,
  migrateRecentProjectFiles,
  projectFileActionUpdates,
  projectRelativePathFromRuntimePath,
  projectResourcePathMigrations,
  type ProjectFilePathMigration
} from "@/features/mermaid-editor/lib/project-file-actions";
import type {
  ProjectFileEntry,
  ProjectResourceEntry,
  ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import { projectResourcesFromFiles } from "@/features/mermaid-editor/lib/project-workspace";
import type { DetachedHtmlWindow, DetachedImageWindow, DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type ExplorerCreateProjectFileRequest = {
  directoryPath: string;
  fileName: string;
  kind: RuntimeProjectFileKind;
};

export type ExplorerCreateProjectDirectoryRequest = {
  directoryPath: string;
  directoryName: string;
};

export function useProjectFileActions({
  runtime,
  projectWorkspace,
  fileRef,
  graph,
  detachedMarkdownWindows,
  detachedHtmlWindows,
  detachedImageWindows,
  setProjectBusy,
  setFileRef,
  setFileName,
  setRecentFiles,
  setDetachedMarkdownWindows,
  setDetachedHtmlWindows,
  setDetachedImageWindows,
  refreshProjectWorkspace,
  openProjectFile,
  beforeMove,
  applyEditorCommand,
  onDetachedMarkdownWindowMoved,
  onDetachedHtmlWindowMoved,
  onDetachedImageWindowMoved,
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
  detachedImageWindows: DetachedImageWindow[];
  setProjectBusy: StateSetter<boolean>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setFileName: StateSetter<string>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
  setDetachedHtmlWindows: StateSetter<DetachedHtmlWindow[]>;
  setDetachedImageWindows: StateSetter<DetachedImageWindow[]>;
  refreshProjectWorkspace: () => void | Promise<unknown>;
  openProjectFile: (file: ProjectFileEntry) => void | Promise<unknown>;
  beforeMove?: () => boolean | void | Promise<boolean | void>;
  applyEditorCommand: (command: EditorCommand) => void;
  onDetachedMarkdownWindowMoved?: (source: RuntimeFileRef, target: RuntimeFileRef) => void;
  onDetachedHtmlWindowMoved?: (source: RuntimeFileRef, target: RuntimeFileRef) => void;
  onDetachedImageWindowMoved?: (source: RuntimeFileRef, target: RuntimeFileRef) => void;
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
    await moveProjectResources([source], targetDirectoryPath);
  }

  async function createProjectDirectory(request: ExplorerCreateProjectDirectoryRequest) {
    if (!projectWorkspace) return;
    setProjectBusy(true);
    try {
      const result = await runtime.createProjectDirectory({
        rootPath: projectWorkspace.rootPath,
        directoryPath: request.directoryPath,
        directoryName: request.directoryName
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      if (result.status === "exists") {
        setStatus(`${result.resource.name} 已存在。`);
        return;
      }
      await refreshProjectWorkspace();
      setStatus(`已创建文件夹 ${result.resource.name}。`);
    } catch (error) {
      showFileWorkflowError(error, "创建项目文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function renameProjectResource(resource: ProjectResourceEntry, name: string) {
    if (!projectWorkspace) return;
    setProjectBusy(true);
    try {
      if (await beforeMove?.() === false) {
        setStatus("存在尚未写回的 CSV 编辑，已取消重命名。");
        return;
      }
      const result = await runtime.renameProjectResource({
        rootPath: projectWorkspace.rootPath,
        sourcePath: resource.path,
        name
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      if (result.status === "exists") {
        setStatus(`${result.resource.name} 已存在。`);
        return;
      }
      if (result.status === "noop") {
        setStatus(`${result.resource.name} 未变化。`);
        return;
      }

      await applyResourcePathChanges([{ sourcePath: result.sourcePath, targetPath: result.resource.path }], "已更新重命名资源的节点链接。");

      await refreshProjectWorkspace();
      setStatus(`已重命名为 ${result.resource.name}。`);
    } catch (error) {
      showFileWorkflowError(error, "重命名项目资源失败。");
      try {
        await refreshProjectWorkspace();
      } catch {
        // The mutation result is uncertain, so refresh is best-effort in the error path.
      }
    } finally {
      setProjectBusy(false);
    }
  }

  async function moveProjectResources(resources: ProjectResourceEntry[], targetDirectoryPath: string, placement?: RuntimeProjectResourcePlacement) {
    if (!projectWorkspace || !resources.length) return;
    setProjectBusy(true);
    try {
      if (await beforeMove?.() === false) {
        setStatus("存在尚未写回的 CSV 编辑，已取消移动。");
        return;
      }
      const result = await runtime.moveProjectResources({
        rootPath: projectWorkspace.rootPath,
        sourcePaths: resources.map((resource) => resource.path),
        targetDirectoryPath,
        ...(placement ? { placement } : {})
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      const moved = result.results.filter((item) => item.status === "moved");
      if (moved.length) {
        await applyResourcePathChanges(moved.map((item) => ({ sourcePath: item.sourcePath, targetPath: item.resource.path })), "已更新移动资源的节点链接。");
      }
      await refreshProjectWorkspace();
      setStatus(projectMutationStatus(result.results, "移动"));
    } catch (error) {
      showFileWorkflowError(error, "移动项目资源失败。");
      try {
        await refreshProjectWorkspace();
      } catch {
        // The mutation result is uncertain, so refresh is best-effort in the error path.
      }
    } finally {
      setProjectBusy(false);
    }
  }

  async function reorderProjectResources(parentDirectoryPath: string, kind: RuntimeProjectResourceKind, orderedRelativePaths: string[]) {
    if (!projectWorkspace || !orderedRelativePaths.length) return;
    setProjectBusy(true);
    try {
      const result = await runtime.reorderProjectResources({
        rootPath: projectWorkspace.rootPath,
        parentDirectoryPath,
        kind,
        orderedRelativePaths
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      await refreshProjectWorkspace();
      setStatus("已更新资源顺序。");
    } catch (error) {
      showFileWorkflowError(error, "调整项目资源顺序失败。");
      try {
        await refreshProjectWorkspace();
      } catch {
        // The metadata result is uncertain, so refresh is best-effort in the error path.
      }
    } finally {
      setProjectBusy(false);
    }
  }

  async function copyProjectResources(resources: ProjectResourceEntry[], targetDirectoryPath: string) {
    if (!projectWorkspace || !resources.length) return;
    setProjectBusy(true);
    try {
      const result = await runtime.copyProjectResources({
        rootPath: projectWorkspace.rootPath,
        sourcePaths: resources.map((resource) => resource.path),
        targetDirectoryPath
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      await refreshProjectWorkspace();
      setStatus(projectMutationStatus(result.results, "复制"));
    } catch (error) {
      showFileWorkflowError(error, "复制项目资源失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function importProjectResources(externalPaths: string[], targetDirectoryPath: string) {
    if (!projectWorkspace || !externalPaths.length) return;
    setProjectBusy(true);
    try {
      const result = await runtime.importProjectResources({
        rootPath: projectWorkspace.rootPath,
        externalPaths,
        targetDirectoryPath
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      await refreshProjectWorkspace();
      setStatus(projectMutationStatus(result.results, "导入"));
    } catch (error) {
      showFileWorkflowError(error, "导入项目资源失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function deleteProjectResources(resources: ProjectResourceEntry[]) {
    if (!projectWorkspace || !resources.length) return;
    setProjectBusy(true);
    try {
      const result = await runtime.deleteProjectResources({
        rootPath: projectWorkspace.rootPath,
        sourcePaths: resources.map((resource) => resource.path)
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      detachDeletedCurrentFile(result.resources.map((resource) => resource.path));
      await refreshProjectWorkspace();
      setStatus(`已删除 ${result.resources.length} 项。`);
    } catch (error) {
      showFileWorkflowError(error, "删除项目资源失败。");
      try {
        await refreshProjectWorkspace();
      } catch {
        // The mutation result is uncertain, so refresh is best-effort in the error path.
      }
    } finally {
      setProjectBusy(false);
    }
  }

  async function showProjectResourceInFileManager(resource: ProjectResourceEntry) {
    if (!projectWorkspace) return;
    try {
      const result = await runtime.showProjectResourceInFileManager({
        rootPath: projectWorkspace.rootPath,
        path: resource.path
      });
      if (result.status === "unsupported") setStatus(result.message);
    } catch (error) {
      showFileWorkflowError(error, "无法在 Finder 中显示项目资源。");
    }
  }

  async function applyResourcePathChanges(changes: { sourcePath: string; targetPath: string }[], graphMessage: string) {
    const resources = projectWorkspace?.resources ?? projectResourcesFromFiles(projectWorkspace?.files ?? []);
    const migrations = changes.flatMap((change) => projectResourcePathMigrations(resources, projectWorkspace!.rootPath, change.sourcePath, change.targetPath));
    if (!migrations.length) return;
    await Promise.all(migrations.map((migration) => onMarkdownFileMoved?.(migration.sourceAbsolutePath, migration.targetFile.path)));
    applyPathMigrations(migrations, graphMessage);
  }

  function applyPathMigrations(migrations: ProjectFilePathMigration[], graphMessage: string) {
    const nextCurrentFile = migrations.reduce((current, migration) => migrateCurrentProjectFileRef(current, migration), fileRef);
    if (nextCurrentFile !== fileRef) {
      setFileRef(nextCurrentFile);
      setFileName(nextCurrentFile?.name || "");
    }
    setRecentFiles((current) => migrations.reduce((files, migration) => migrateRecentProjectFiles(files, migration), current));
    for (const migration of migrations) {
      const detachedWindow = detachedMarkdownWindows.find((window) => window.file.path === migration.sourceAbsolutePath);
      if (detachedWindow) onDetachedMarkdownWindowMoved?.(detachedWindow.file, migration.targetFile);
      const detachedHtmlWindow = detachedHtmlWindows.find((window) => window.file.path === migration.sourceAbsolutePath);
      if (detachedHtmlWindow) onDetachedHtmlWindowMoved?.(detachedHtmlWindow.file, migration.targetFile);
      const detachedImageWindow = detachedImageWindows.find((window) => window.file.path === migration.sourceAbsolutePath);
      if (detachedImageWindow) onDetachedImageWindowMoved?.(detachedImageWindow.file, migration.targetFile);
    }
    setDetachedMarkdownWindows((current) => migrations.reduce((windows, migration) => migrateDetachedMarkdownWindows(windows, migration), current));
    setDetachedHtmlWindows((current) => migrations.reduce((windows, migration) => migrateDetachedHtmlWindows(windows, migration), current));
    setDetachedImageWindows((current) => migrations.reduce((windows, migration) => migrateDetachedImageWindows(windows, migration), current));
    const updates = migrations.flatMap((migration) => projectFileActionUpdates(graph, migration));
    if (updates.length) {
      applyEditorCommand({
        type: "graph.updateNodeActions",
        updates,
        message: graphMessage,
        source: "api"
      });
    }
  }

  function detachDeletedCurrentFile(paths: string[]) {
    const currentPath = fileRef?.path;
    if (!currentPath || !paths.some((path) => runtimePathInsideOrSame(currentPath, path))) return;
    setFileRef({ name: fileRef.name });
    setStatus(`${fileRef.name} 已从磁盘移除；内容已保留，下次保存将另存为。`);
  }

  return {
    copyProjectResources,
    createProjectDirectory,
    createProjectFile,
    deleteProjectResources,
    importProjectResources,
    moveProjectFile,
    moveProjectResources,
    renameProjectResource,
    reorderProjectResources,
    showProjectResourceInFileManager
  };
}

function projectMutationStatus(results: readonly { status: string }[], verb: string) {
  const changed = results.filter((item) => item.status === "moved" || item.status === "copied" || item.status === "imported").length;
  const skipped = results.filter((item) => item.status === "exists" || item.status === "noop").length;
  if (changed && skipped) return `已${verb} ${changed} 项，跳过 ${skipped} 项。`;
  if (changed) return `已${verb} ${changed} 项。`;
  if (skipped) return `${skipped} 项未${verb}，目标位置已存在或未变化。`;
  return `没有可${verb}的项目资源。`;
}

function runtimePathInsideOrSame(path: string, rootPath: string) {
  const resource = normalizeRuntimePath(path);
  const root = normalizeRuntimePath(rootPath);
  return resource === root || resource.startsWith(`${root}/`);
}

function normalizeRuntimePath(value: string) {
  return value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
}
