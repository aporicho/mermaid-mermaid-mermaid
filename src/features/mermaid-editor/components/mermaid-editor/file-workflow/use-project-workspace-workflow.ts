import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  normalizeProjectWorkspace,
  workspaceRootForOpenedFile
} from "@/features/mermaid-editor/lib/project-workspace";

import type {
  ShowFileWorkflowError,
  SyncWorkspaceForOpenedFile,
  UseEditorFileWorkflowArgs
} from "./types";
import { isAbortError } from "./utils";

export function useProjectWorkspaceWorkflow(
  args: UseEditorFileWorkflowArgs,
  {
    persistStoredEditorDraft,
    showFileWorkflowError
  }: {
    persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
    showFileWorkflowError: ShowFileWorkflowError;
  }
) {
  const {
    runtime,
    projectWorkspace,
    setLeftCollapsed,
    setProjectBusy,
    setProjectWorkspace,
    setStatus
  } = args;

  const syncWorkspaceForOpenedFile: SyncWorkspaceForOpenedFile = async (
    file: RuntimeFileRef | null,
    options: { announce?: boolean; revealExplorer?: boolean } = {}
  ) => {
    if (runtime.kind !== "desktop" || !file?.path) return;

    const revealExplorer = options.revealExplorer ?? true;
    const rootPath = workspaceRootForOpenedFile(file.path, projectWorkspace);
    if (!rootPath) {
      if (projectWorkspace && revealExplorer) setLeftCollapsed(false);
      return;
    }

    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status !== "opened") return;
      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "同步文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      if (revealExplorer) setLeftCollapsed(false);
      if (options.announce ?? true) setStatus(`已显示 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "同步文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  };

  async function openProjectFolder() {
    setProjectBusy(true);
    try {
      const result = await runtime.openProjectFolder();
      if (result.status === "cancelled") return;
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message }, "工作区文件夹不可用。");
        return;
      }

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。" }, "打开工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setLeftCollapsed(false);
      setStatus(`已打开工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function refreshProjectWorkspace(rootPath = projectWorkspace?.rootPath) {
    if (!rootPath) return;
    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }
      if (result.status === "cancelled") return;

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setStatus(`已刷新工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "刷新工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function closeProjectWorkspace() {
    setProjectWorkspace(null);
    setStatus("已关闭工作区文件夹。");
    try {
      await persistStoredEditorDraft({ projectWorkspace: null });
    } catch {
      // Closing a project only affects draft metadata.
    }
  }

  return {
    syncWorkspaceForOpenedFile,
    openProjectFolder,
    refreshProjectWorkspace,
    closeProjectWorkspace
  };
}
