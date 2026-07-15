import type { Dispatch, SetStateAction } from "react";

import {
  isSupportedDocumentFilePath,
  upsertRecentFile,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import {
  ensureEditorDocumentFileName
} from "@/features/mermaid-editor/lib/editor-state";
import type {
  EditorRuntime,
  RuntimeFileOpenRequest,
  RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import {
  browserToolWindowTitle,
  normalizeBrowserUrl
} from "@/features/mermaid-editor/lib/browser-tool-window";
import type {
  CanvasNode,
  CanvasNodeAction
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { normalizeNodeAction } from "@/features/mermaid-editor/lib/node-actions";
import type {
  ProjectFileEntry,
  ProjectWorkspace
} from "@/features/mermaid-editor/lib/project-workspace";
import {
  markdownWindowPanelId,
  type DetachedMarkdownWindow,
  type MarkdownWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  normalizeProjectRelativePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";
import type { FileOpenSource } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorWindowActionsArgs = {
  runtime: EditorRuntime;
  fileRef: RuntimeFileRef | null;
  projectWorkspace: ProjectWorkspace | null;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setNodeActionEditor: StateSetter<{ nodeId: string } | null>;
  setStatus: StateSetter<string>;
  bringWorkspacePanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  removeWorkspacePanel: (panelId: WorkspaceFloatingPanelId) => void;
  setWorkspacePanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
  openRuntimeFileRequest: (file: RuntimeFileOpenRequest, source: FileOpenSource) => Promise<void>;
  openInspectorPanel: () => void;
  applyEditorCommand: (command: EditorCommand) => void;
  recordRecentAction: (type: string, target?: AiRecentAction["target"], summary?: string) => void;
  onMarkdownFileSaved?: (path: string, text: string) => void;
};

export function useEditorWindowActions({
  runtime,
  fileRef,
  projectWorkspace,
  detachedMarkdownWindows,
  setDetachedMarkdownWindows,
  setRecentFiles,
  setNodeActionEditor,
  setStatus,
  bringWorkspacePanelToFront,
  removeWorkspacePanel,
  setWorkspacePanelWindowState,
  showFileWorkflowError,
  openRuntimeFileRequest,
  openInspectorPanel,
  applyEditorCommand,
  recordRecentAction,
  onMarkdownFileSaved
}: UseEditorWindowActionsArgs) {
  async function openProjectMarkdownWindow(file: ProjectFileEntry) {
    if (!isSupportedMarkdownFilePath(file.path)) return;
    const panelId = markdownWindowPanelId(file);
    const existingWindow = detachedMarkdownWindows.find((window) => window.id === panelId);
    if (existingWindow) {
      bringWorkspacePanelToFront(panelId);
      setStatus(`已切换到 ${existingWindow.title} 窗口。`);
      return;
    }

    try {
      const result = await runtime.openFilePath(file.path);
      if (result.status !== "opened") return;
      const title = result.file.name || file.name;
      const nextWindow: DetachedMarkdownWindow = {
        id: panelId,
        file: result.file,
        title,
        value: result.text,
        savedValue: result.text
      };
      setDetachedMarkdownWindows((current) => [...current, nextWindow]);
      bringWorkspacePanelToFront(panelId);
      setWorkspacePanelWindowState(panelId, "normal");
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setStatus(`已在窗口中打开 ${title}。`);
    } catch (error) {
      showFileWorkflowError(error, "打开 Markdown 窗口失败。");
    }
  }

  function updateDetachedMarkdownWindow(panelId: MarkdownWindowPanelId, value: string) {
    setDetachedMarkdownWindows((current) => current.map((window) => (window.id === panelId ? { ...window, value } : window)));
  }

  function closeDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    setDetachedMarkdownWindows((current) => current.filter((window) => window.id !== panelId));
    removeWorkspacePanel(panelId);
  }

  async function saveDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    const targetWindow = detachedMarkdownWindows.find((window) => window.id === panelId);
    if (!targetWindow) return;

    try {
      const result = await runtime.saveFile(targetWindow.file, targetWindow.value, targetWindow.title, "markdown");
      if (result.status === "cancelled") return;
      const savedTitle = ensureEditorDocumentFileName(result.file.name, "markdown");
      setDetachedMarkdownWindows((current) =>
        current.map((window) =>
          window.id === panelId
            ? {
                ...window,
                file: result.file,
                title: savedTitle,
                savedValue: window.value
              }
            : window
        )
      );
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      if (result.file.path) onMarkdownFileSaved?.(result.file.path, targetWindow.value);
      setStatus(`已保存 ${savedTitle}。`);
    } catch (error) {
      showFileWorkflowError(error, "保存 Markdown 窗口失败。");
    }
  }

  function executeCanvasNodeAction(node: CanvasNode) {
    const action = normalizeNodeAction(node.action);
    if (!action) {
      setStatus("此节点没有可打开的动作。");
      return;
    }

    if (action.kind === "url") {
      openUrlNodeAction(action, node);
      return;
    }

    void openFileNodeAction(action);
  }

  function executeNodeActionDraft(action: CanvasNodeAction) {
    const normalized = normalizeNodeAction(action);
    if (!normalized) {
      setStatus("链接目标无效。");
      return;
    }

    if (normalized.kind === "url") {
      openUrlNodeAction(normalized);
      return;
    }

    void openFileNodeAction(normalized);
  }

  function editCanvasNodeAction(node: CanvasNode) {
    applyEditorCommand({ type: "selection.set", selection: { nodeIds: [node.id], edgeIds: [], subgraphIds: [], primaryId: node.id }, source: "menu" });
    setNodeActionEditor({ nodeId: node.id });
    openInspectorPanel();
  }

  function saveCanvasNodeAction(nodeId: string, action: CanvasNodeAction | undefined) {
    applyEditorCommand({
      type: "graph.updateNode",
      nodeId,
      patch: { action },
      message: action ? "已更新节点链接。" : "已清除节点链接。",
      source: "menu"
    });
    setNodeActionEditor(null);
  }

  async function openBrowserToolWindow(url: string, sourceNode?: CanvasNode) {
    const targetUrl = normalizeBrowserUrl(url);
    if (!targetUrl) {
      setStatus("节点链接只支持 http/https URL。");
      return;
    }

    const title = browserToolWindowTitle(targetUrl, sourceNode?.label);
    try {
      const result = await runtime.openBrowserToolWindow({
        url: targetUrl,
        title,
        sourceNodeId: sourceNode?.id,
        sourceLabel: sourceNode?.label
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }
      recordRecentAction("browser.open", sourceNode ? { kind: "node", id: sourceNode.id } : { kind: "canvas" }, title);
      if (result.external) {
        setStatus(`已使用系统浏览器打开 ${title}。`);
      } else if (result.reused) {
        setStatus(`已切换到网页工具 ${title}。`);
      } else {
        setStatus(`已打开网页工具 ${title}。`);
      }
    } catch (error) {
      showFileWorkflowError(error, "打开浏览器工具失败。");
    }
  }

  function openUrlNodeAction(action: Extract<CanvasNodeAction, { kind: "url" }>, sourceNode?: CanvasNode) {
    if (action.openMode === "system") {
      runtime.openExternalUrl(action.url);
      return;
    }
    void openBrowserToolWindow(action.url, sourceNode);
  }

  async function openFileNodeAction(action: Extract<CanvasNodeAction, { kind: "file" }>) {
    const path = resolveNodeActionFilePath(action.path);
    if (!path) {
      showFileWorkflowError({ code: "file_not_found", path: action.path }, "无法打开节点文件。");
      return;
    }

    const file = projectFileEntryFromPath(path);
    if (isSupportedMarkdownFilePath(path)) {
      await openProjectMarkdownWindow(file);
      return;
    }

    if (isSupportedDocumentFilePath(path)) {
      await openRuntimeFileRequest(file, "project");
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path }, "节点文件类型不支持。");
  }

  function resolveNodeActionFilePath(path: string) {
    const trimmed = path.trim();
    if (!trimmed) return "";
    if (isAbsoluteRuntimePath(trimmed)) return trimmed;

    const comparable = normalizeProjectRelativePath(trimmed);
    const projectFile = projectWorkspace?.files.find((file) => {
      return normalizeProjectRelativePath(file.relativePath) === comparable || normalizeProjectRelativePath(file.name) === comparable;
    });
    if (projectFile) return projectFile.path;

    return joinRuntimePath(parentDirectoryPath(fileRef?.path) || projectWorkspace?.rootPath, trimmed);
  }

  function projectFileEntryFromPath(path: string): ProjectFileEntry {
    const projectFile = projectWorkspace?.files.find((file) => file.path === path);
    if (projectFile) return projectFile;
    return {
      name: runtimeFileNameFromPath(path),
      path,
      relativePath: runtimeFileNameFromPath(path)
    };
  }

  return {
    openProjectMarkdownWindow,
    updateDetachedMarkdownWindow,
    closeDetachedMarkdownWindow,
    saveDetachedMarkdownWindow,
    executeCanvasNodeAction,
    executeNodeActionDraft,
    editCanvasNodeAction,
    saveCanvasNodeAction
  };
}
