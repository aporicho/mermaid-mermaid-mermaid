import type { Dispatch, SetStateAction } from "react";

import {
  isSupportedDocumentFilePath,
  upsertRecentFile,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import { imageViewerWatchPath } from "@/features/mermaid-editor/lib/image-viewer";
import { adjacentImageNavigationIndex, projectDirectoryImageNavigation } from "@/features/mermaid-editor/lib/image-window-navigation";
import {
  ensureEditorDocumentFileName
} from "@/features/mermaid-editor/lib/editor-state";
import type {
  EditorRuntime,
  RuntimeFileOpenRequest,
  RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import type { EditorRecentAction } from "@/features/mermaid-editor/lib/editor-interaction-state";
import {
  browserToolWindowLabel,
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
  htmlWindowPanelId,
  imageWindowPanelId,
  markdownWindowPanelId,
  type BrowserWindowPanelId,
  type DetachedBrowserWindow,
  type DetachedHtmlWindow,
  type DetachedImageWindow,
  type DetachedMarkdownWindow,
  type HtmlWindowPanelId,
  type ImageWindowPanelId,
  type ImageWindowOpenRequest,
  type ImageWindowNavigation,
  type ImageWindowNavigationItem,
  type MarkdownWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import type { EditorDocumentBuffer, EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import {
  isAbsoluteRuntimePath,
  joinRuntimePath,
  normalizeProjectRelativePath,
  parentDirectoryPath,
  runtimeFileNameFromPath
} from "@/features/mermaid-editor/lib/runtime-paths";
import type { FileOpenSource } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import {
  isHtmlDocumentFilePath,
  resolveHtmlDocumentFile,
  runtimeFilePathToUrl
} from "@/features/mermaid-editor/lib/html-document";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorWindowActionsArgs = {
  runtime: EditorRuntime;
  fileRef: RuntimeFileRef | null;
  projectWorkspace: ProjectWorkspace | null;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
  detachedBrowserWindows: DetachedBrowserWindow[];
  setDetachedBrowserWindows: StateSetter<DetachedBrowserWindow[]>;
  detachedHtmlWindows: DetachedHtmlWindow[];
  setDetachedHtmlWindows: StateSetter<DetachedHtmlWindow[]>;
  detachedImageWindows: DetachedImageWindow[];
  setDetachedImageWindows: StateSetter<DetachedImageWindow[]>;
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
  recordRecentAction: (type: string, target?: EditorRecentAction["target"], summary?: string) => void;
  onMarkdownFileSaved?: (path: string, text: string) => void;
  findFileDocumentBuffer: (file: RuntimeFileRef | null | undefined) => EditorDocumentBuffer | null;
  registerDocumentBuffer: (input: { documentKind: "markdown"; fileName: string; fileRef: RuntimeFileRef | null; content: string; savedContent: string }) => EditorDocumentBuffer;
  updateDocumentBuffer: (bufferId: string, updates: Partial<Pick<EditorDocumentBuffer, "content" | "savedContent" | "revision" | "status" | "fileName" | "fileRef">>) => EditorDocumentSession;
  saveDocumentBufferById: (bufferId: string) => Promise<boolean>;
};

export function useEditorWindowActions({
  runtime,
  fileRef,
  projectWorkspace,
  detachedMarkdownWindows,
  setDetachedMarkdownWindows,
  detachedBrowserWindows,
  setDetachedBrowserWindows,
  detachedHtmlWindows,
  setDetachedHtmlWindows,
  detachedImageWindows,
  setDetachedImageWindows,
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
  onMarkdownFileSaved,
  findFileDocumentBuffer,
  registerDocumentBuffer,
  updateDocumentBuffer,
  saveDocumentBufferById
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

    const buffered = findFileDocumentBuffer(file);
    if (buffered) {
      const nextWindow: DetachedMarkdownWindow = {
        id: panelId,
        file: { ...file, revision: buffered.revision || undefined },
        title: buffered.fileName,
        value: buffered.content,
        savedValue: buffered.savedContent
      };
      setDetachedMarkdownWindows((current) => [...current, nextWindow]);
      bringWorkspacePanelToFront(panelId);
      setWorkspacePanelWindowState(panelId, "normal");
      setStatus(`已在窗口中恢复 ${buffered.fileName}。`);
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
      registerDocumentBuffer({ documentKind: "markdown", fileName: title, fileRef: result.file, content: result.text, savedContent: result.text });
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
    const target = detachedMarkdownWindows.find((window) => window.id === panelId);
    const buffer = findFileDocumentBuffer(target?.file);
    if (buffer) updateDocumentBuffer(buffer.id, { content: value, status: value === buffer.savedContent ? "clean" : "dirty" });
    setDetachedMarkdownWindows((current) => current.map((window) => (window.id === panelId ? { ...window, value } : window)));
  }

  function closeDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    setDetachedMarkdownWindows((current) => current.filter((window) => window.id !== panelId));
    removeWorkspacePanel(panelId);
  }

  function openProjectHtmlWindow(file: ProjectFileEntry) {
    if (!isHtmlDocumentFilePath(file.path)) return;
    if (runtime.host !== "electron") {
      setStatus("本地 HTML 预览仅在桌面版可用。");
      return;
    }

    const path = file.path.trim();
    const url = runtimeFilePathToUrl(path);
    if (!path || !url) {
      showFileWorkflowError({ code: "file_not_found", path }, "无法打开 HTML 文件。");
      return;
    }

    const runtimeFile = { name: file.name, path };
    const panelId = htmlWindowPanelId(runtimeFile);
    const existingWindow = detachedHtmlWindows.find((window) => window.id === panelId);
    if (existingWindow) {
      bringWorkspacePanelToFront(panelId);
      setStatus(`已切换到 ${existingWindow.title} 预览。`);
      return;
    }

    const title = file.name || runtimeFileNameFromPath(path) || "HTML 预览";
    setDetachedHtmlWindows((current) => [...current, { id: panelId, file: runtimeFile, title, url }]);
    bringWorkspacePanelToFront(panelId);
    setWorkspacePanelWindowState(panelId, "normal");
    setStatus(`已在浮动窗口中预览 ${title}。`);
  }

  function closeDetachedHtmlWindow(panelId: HtmlWindowPanelId) {
    setDetachedHtmlWindows((current) => current.filter((window) => window.id !== panelId));
    removeWorkspacePanel(panelId);
  }

  function openImageWindow(request: ImageWindowOpenRequest) {
    const selectedItem = normalizeImageWindowItem(request, request);
    if (!selectedItem) {
      showFileWorkflowError({ code: "file_not_found", path: request.source }, "无法打开图片。");
      return;
    }
    const navigation = normalizeImageWindowNavigation(request, selectedItem);
    const runtimeFile = imageWindowRuntimeFile(selectedItem);
    const panelId = imageWindowPanelId({ name: selectedItem.title, path: selectedItem.identity });
    const existingWindow = detachedImageWindows.find((window) => window.id === panelId);
    if (existingWindow) {
      setDetachedImageWindows((current) => current.map((window) => window.id === panelId ? {
        ...window,
        file: runtimeFile,
        title: selectedItem.title,
        source: selectedItem.source,
        documentFile: selectedItem.documentFile,
        watchPath: selectedItem.watchPath,
        revision: (window.revision || 0) + 1,
        missing: false,
        navigation
      } : window));
      bringWorkspacePanelToFront(panelId);
      setStatus(`已切换到 ${selectedItem.title} 图片查看器。`);
      return;
    }
    setDetachedImageWindows((current) => [...current, {
      id: panelId,
      file: runtimeFile,
      title: selectedItem.title,
      source: selectedItem.source,
      documentFile: selectedItem.documentFile,
      watchPath: selectedItem.watchPath,
      navigation
    }]);
    bringWorkspacePanelToFront(panelId);
    setWorkspacePanelWindowState(panelId, "normal");
    setStatus(`已在图片查看器中打开 ${selectedItem.title}。`);
  }

  function openProjectImageWindow(file: ProjectFileEntry) {
    if (!isSupportedImagePath(file.path)) return;
    openImageWindow({
      source: file.path,
      title: file.name,
      identity: file.path,
      watchPath: file.path,
      navigation: projectDirectoryImageNavigation(projectWorkspace, file)
    });
  }

  function navigateDetachedImageWindow(panelId: ImageWindowPanelId, direction: -1 | 1) {
    const targetWindow = detachedImageWindows.find((window) => window.id === panelId);
    const navigation = targetWindow?.navigation;
    if (!targetWindow || !navigation || navigation.items.length <= 1) return;
    const index = adjacentImageNavigationIndex(navigation, direction);
    const item = navigation.items[index];
    setDetachedImageWindows((current) => current.map((window) => window.id === panelId ? {
      ...window,
      file: imageWindowRuntimeFile(item),
      title: item.title,
      source: item.source,
      documentFile: item.documentFile,
      watchPath: item.watchPath,
      revision: (window.revision || 0) + 1,
      missing: false,
      navigation: { ...navigation, index }
    } : window));
    bringWorkspacePanelToFront(panelId);
    setStatus(`已切换到 ${item.title}。`);
  }

  function closeDetachedImageWindow(panelId: ImageWindowPanelId) {
    setDetachedImageWindows((current) => current.filter((window) => window.id !== panelId));
    removeWorkspacePanel(panelId);
  }

  async function saveDetachedMarkdownWindow(panelId: MarkdownWindowPanelId) {
    const targetWindow = detachedMarkdownWindows.find((window) => window.id === panelId);
    if (!targetWindow) return;

    const buffered = findFileDocumentBuffer(targetWindow.file);
    if (buffered) {
      if (!(await saveDocumentBufferById(buffered.id))) return;
      setDetachedMarkdownWindows((current) => current.map((window) => window.id === panelId ? { ...window, savedValue: window.value, missing: false } : window));
      if (targetWindow.file.path) onMarkdownFileSaved?.(targetWindow.file.path, targetWindow.value);
      setStatus(`已保存 ${targetWindow.title}。`);
      return;
    }

    try {
      const result = targetWindow.missing
        ? await runtime.saveFileAs(targetWindow.value, targetWindow.title, "markdown")
        : await runtime.saveFile(targetWindow.file, targetWindow.value, targetWindow.title, "markdown");
      if (result.status === "cancelled") return;
      if (result.status === "conflict") {
        showFileWorkflowError({ code: "write_failed", message: `${targetWindow.title} 已在外部修改。`, path: targetWindow.file.path }, "保存 Markdown 窗口失败。");
        return;
      }
      const savedTitle = ensureEditorDocumentFileName(result.file.name, "markdown");
      const savedPanelId = markdownWindowPanelId(result.file);
      setDetachedMarkdownWindows((current) =>
        current.map((window) =>
          window.id === panelId
            ? {
                ...window,
                id: savedPanelId,
                file: result.file,
                title: savedTitle,
                savedValue: window.value,
                missing: false
              }
            : window
        )
      );
      if (savedPanelId !== panelId) {
        removeWorkspacePanel(panelId);
        bringWorkspacePanelToFront(savedPanelId);
        setWorkspacePanelWindowState(savedPanelId, "normal");
      }
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

  function openBrowserWorkspaceWindow(url: string, sourceNode?: CanvasNode) {
    const targetUrl = normalizeBrowserUrl(url);
    if (!targetUrl) {
      setStatus("节点链接只支持 http/https URL。");
      return;
    }

    const title = browserToolWindowTitle(targetUrl, sourceNode?.label);
    if (runtime.host === "web") {
      runtime.openExternalUrl(targetUrl);
      recordRecentAction("browser.open", sourceNode ? { kind: "node", id: sourceNode.id } : { kind: "canvas" }, title);
      setStatus(`已使用系统浏览器打开 ${title}。`);
      return;
    }

    const panelId = `browser:${browserToolWindowLabel(targetUrl)}` as BrowserWindowPanelId;
    const existingWindow = detachedBrowserWindows.find((window) => window.id === panelId);
    if (existingWindow) {
      bringWorkspacePanelToFront(panelId);
      setStatus(`已切换到内置浏览器 ${title}。`);
      return;
    }

    setDetachedBrowserWindows((current) => [...current, {
      id: panelId,
      request: {
        url: targetUrl,
        title,
        sourceNodeId: sourceNode?.id,
        sourceLabel: sourceNode?.label
      }
    }]);
    bringWorkspacePanelToFront(panelId);
    setWorkspacePanelWindowState(panelId, "normal");
    recordRecentAction("browser.open", sourceNode ? { kind: "node", id: sourceNode.id } : { kind: "canvas" }, title);
    setStatus(`已打开内置浏览器 ${title}。`);
  }

  function closeDetachedBrowserWindow(panelId: BrowserWindowPanelId) {
    setDetachedBrowserWindows((current) => current.filter((window) => window.id !== panelId));
    removeWorkspacePanel(panelId);
  }

  function openUrlNodeAction(action: Extract<CanvasNodeAction, { kind: "url" }>, sourceNode?: CanvasNode) {
    if (action.openMode === "system") {
      runtime.openExternalUrl(action.url);
      return;
    }
    openBrowserWorkspaceWindow(action.url, sourceNode);
  }

  async function openFileNodeAction(action: Extract<CanvasNodeAction, { kind: "file" }>) {
    if (isHtmlDocumentFilePath(action.path)) {
      openProjectHtmlWindow(resolveHtmlDocumentFile(action.path, fileRef?.path, projectWorkspace));
      return;
    }
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

    if (isSupportedImagePath(path)) {
      openProjectImageWindow(file);
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
    openProjectHtmlWindow,
    openImageWindow,
    openProjectImageWindow,
    navigateDetachedImageWindow,
    updateDetachedMarkdownWindow,
    closeDetachedMarkdownWindow,
    saveDetachedMarkdownWindow,
    closeDetachedBrowserWindow,
    closeDetachedHtmlWindow,
    closeDetachedImageWindow,
    executeCanvasNodeAction,
    executeNodeActionDraft,
    editCanvasNodeAction,
    saveCanvasNodeAction
  };
}

function normalizeImageWindowNavigation(request: ImageWindowOpenRequest, selectedItem: ImageWindowNavigationItem): ImageWindowNavigation {
  const inheritedRequest = {
    documentFile: request.documentFile,
    watchPath: undefined
  } satisfies Pick<ImageWindowOpenRequest, "documentFile" | "watchPath">;
  const items = request.navigation?.items
    .map((item) => normalizeImageWindowItem(item, inheritedRequest))
    .filter((item): item is ImageWindowNavigationItem => Boolean(item)) || [];
  if (!items.some((item) => item.identity === selectedItem.identity)) items.push(selectedItem);
  const uniqueItems = items.filter((item, index) => items.findIndex((candidate) => candidate.identity === item.identity) === index);
  return {
    kind: request.navigation?.kind || "canvas",
    items: uniqueItems,
    index: Math.max(0, uniqueItems.findIndex((item) => item.identity === selectedItem.identity))
  };
}

function normalizeImageWindowItem(
  item: Pick<ImageWindowOpenRequest, "source" | "title" | "identity" | "documentFile" | "watchPath">,
  fallback: Pick<ImageWindowOpenRequest, "documentFile" | "watchPath">
): ImageWindowNavigationItem | null {
  const source = item.source.trim();
  if (!source) return null;
  const documentFile = item.documentFile === undefined ? fallback.documentFile : item.documentFile;
  const watchPath = item.watchPath?.trim() || imageViewerWatchPath(source, documentFile?.path) || undefined;
  const identity = item.identity?.trim() || watchPath || source;
  const title = item.title?.trim() || runtimeFileNameFromPath(watchPath || source) || "图片查看器";
  return { source, title, identity, documentFile, watchPath };
}

function imageWindowRuntimeFile(item: ImageWindowNavigationItem) {
  return { name: item.title, path: item.watchPath || item.identity };
}
