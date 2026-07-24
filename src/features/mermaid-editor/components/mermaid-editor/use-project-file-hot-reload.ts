import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import type { FileOpenSource } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-file-workflow";
import { isSupportedMarkdownFilePath } from "@/features/mermaid-editor/lib/document-kind";
import type {
  EditorRuntime,
  RuntimeOpenFileResult,
  RuntimeFileRef,
  RuntimeProjectFileChange,
  RuntimeProjectFileChangeBatch
} from "@/features/mermaid-editor/lib/editor-runtime";
import { isSupportedImagePath } from "@/features/mermaid-editor/lib/node-assets";
import { isHtmlDocumentFilePath } from "@/features/mermaid-editor/lib/html-document";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { DetachedHtmlWindow, DetachedImageWindow, DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type SetState<T> = Dispatch<SetStateAction<T>>;

type ProjectFileHotReloadArgs = {
  runtime: EditorRuntime;
  projectWorkspace: ProjectWorkspace | null;
  fileRef: RuntimeFileRef | null;
  currentDocumentRef: { current: string };
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  setDetachedMarkdownWindows: SetState<DetachedMarkdownWindow[]>;
  detachedHtmlWindows: DetachedHtmlWindow[];
  setDetachedHtmlWindows: SetState<DetachedHtmlWindow[]>;
  detachedImageWindows: DetachedImageWindow[];
  setDetachedImageWindows: SetState<DetachedImageWindow[]>;
  setFileRef: SetState<RuntimeFileRef | null>;
  setStatus: SetState<string>;
  applyLoadedDocument: (text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void;
  refreshProjectWorkspace: (rootPath?: string) => Promise<void>;
  discardLinkedFileWrites: () => Promise<void>;
  reloadExternalCsvFiles: (paths: ReadonlySet<string> | readonly string[]) => Promise<void>;
  updateMarkdownPreviewFromText: (path: string, text: string) => void;
  markMarkdownPreviewMissing: (path: string) => void;
  refreshImageAssets: () => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
};

export function useProjectFileHotReload(args: ProjectFileHotReloadArgs) {
  const argsRef = useRef(args);
  const requestRevisionRef = useRef(new Map<string, number>());
  argsRef.current = args;

  const extraPaths = [args.fileRef?.path, ...args.detachedMarkdownWindows.map((window) => window.file.path), ...args.detachedHtmlWindows.map((window) => window.file.path), ...args.detachedImageWindows.map(imageWindowWatchPath)]
    .filter((path): path is string => Boolean(path));
  const targetKey = `${args.projectWorkspace?.rootPath || ""}\0${[...new Set(extraPaths)].sort().join("\0")}`;

  useEffect(() => {
    if (args.runtime.kind !== "desktop") return;
    void args.runtime.setProjectFileWatchTargets({
      rootPath: args.projectWorkspace?.rootPath,
      extraPaths
    }).catch((error) => argsRef.current.showFileWorkflowError(error, "无法监听项目文件变化。"));
    // targetKey is a stable projection of all watched paths.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.runtime, targetKey]);

  useEffect(() => {
    if (args.runtime.kind !== "desktop") return;
    let disposed = false;
    let stopListening: (() => void) | undefined;
    void args.runtime.listenForProjectFileChanges((batch) => {
      if (!disposed) void handleProjectFileChanges(argsRef.current, requestRevisionRef.current, batch);
    }).then((cleanup) => {
      if (disposed) cleanup();
      else stopListening = cleanup;
    }).catch((error) => argsRef.current.showFileWorkflowError(error, "无法接收项目文件变化。"));

    return () => {
      disposed = true;
      stopListening?.();
      void args.runtime.setProjectFileWatchTargets({});
    };
  }, [args.runtime]);
}

async function handleProjectFileChanges(
  args: ProjectFileHotReloadArgs,
  requestRevisions: Map<string, number>,
  batch: RuntimeProjectFileChangeBatch
) {
  const changes = collapseChanges(batch.changes);
  if (!changes.length) return;

  if (batch.rootPath) void args.refreshProjectWorkspace(batch.rootPath);
  const fileChanges = changes.filter((change) => !change.directory);
  const csvPaths = new Set(fileChanges.filter((change) => isCsvPath(change.path)).map((change) => change.path));
  if (csvPaths.size) void args.reloadExternalCsvFiles(csvPaths);
  const imageChanges = fileChanges.filter((change) => isSupportedImagePath(change.path));
  if (imageChanges.length) {
    args.refreshImageAssets();
    args.setDetachedImageWindows((current) => current.map((window) => {
      const change = imageChanges.find((candidate) => comparablePath(candidate.path) === comparablePath(imageWindowWatchPath(window)));
      return change ? { ...window, revision: (window.revision || 0) + 1, missing: change.kind === "removed" } : window;
    }));
  }
  const htmlChanges = fileChanges.filter((change) => isHtmlDocumentFilePath(change.path));
  if (htmlChanges.length) {
    args.setDetachedHtmlWindows((current) => current.map((window) => {
      const change = htmlChanges.find((candidate) => comparablePath(candidate.path) === comparablePath(window.file.path));
      return change ? { ...window, revision: (window.revision || 0) + 1, missing: change.kind === "removed" } : window;
    }));
  }

  const reads = new Map<string, Promise<RuntimeOpenFileResult>>();
  const readFile = (path: string) => {
    const key = comparablePath(path);
    let read = reads.get(key);
    if (!read) {
      read = args.runtime.openFilePath(path);
      reads.set(key, read);
    }
    return read;
  };

  const currentPath = args.fileRef?.path;
  const currentChange = currentPath
    ? fileChanges.find((change) => comparablePath(change.path) === comparablePath(currentPath))
    : undefined;
  if (currentChange) {
    if (currentChange.kind === "removed") {
      args.setFileRef((current) => current?.path && comparablePath(current.path) === comparablePath(currentChange.path)
        ? { name: current.name }
        : current);
      args.setStatus(`${args.fileRef?.name || "当前文档"} 已从磁盘移除；内容已保留，下次保存将另存为。`);
    } else {
      await reloadCurrentDocument(args, requestRevisions, currentChange.path, readFile);
    }
  }

  await Promise.all(fileChanges.flatMap((change) => {
    if (!isSupportedMarkdownFilePath(change.path)) return [];
    if (change.kind === "removed") {
      args.markMarkdownPreviewMissing(change.path);
      args.setDetachedMarkdownWindows((current) => current.map((window) => comparablePath(window.file.path) === comparablePath(change.path)
        ? { ...window, missing: true }
        : window));
      return [];
    }
    return [reloadMarkdownConsumers(args, requestRevisions, change.path, readFile)];
  }));
}

async function reloadCurrentDocument(
  args: ProjectFileHotReloadArgs,
  requestRevisions: Map<string, number>,
  path: string,
  readFile: (path: string) => Promise<RuntimeOpenFileResult>
) {
  const requestKey = `current:${path}`;
  const revision = nextRequestRevision(requestRevisions, requestKey);
  try {
    const result = await readFile(path);
    if (result.status !== "opened" || !isLatestRequest(requestRevisions, requestKey, revision)) return;
    if (result.text === args.currentDocumentRef.current) return;
    await args.discardLinkedFileWrites();
    if (!isLatestRequest(requestRevisions, requestKey, revision)) return;
    args.applyLoadedDocument(result.text, result.file.name, result.file, "watch");
  } catch (error) {
    args.showFileWorkflowError(error, `从磁盘刷新 ${args.fileRef?.name || "当前文档"} 失败。`);
  }
}

async function reloadMarkdownConsumers(
  args: ProjectFileHotReloadArgs,
  requestRevisions: Map<string, number>,
  path: string,
  readFile: (path: string) => Promise<RuntimeOpenFileResult>
) {
  const requestKey = `markdown:${path}`;
  const revision = nextRequestRevision(requestRevisions, requestKey);
  try {
    const result = await readFile(path);
    if (result.status !== "opened" || !isLatestRequest(requestRevisions, requestKey, revision)) return;
    args.updateMarkdownPreviewFromText(path, result.text);
    args.setDetachedMarkdownWindows((current) => current.map((window) => comparablePath(window.file.path) === comparablePath(path)
      ? { ...window, file: result.file, title: result.file.name || window.title, value: result.text, savedValue: result.text, missing: false }
      : window));
  } catch (error) {
    args.showFileWorkflowError(error, `从磁盘刷新 Markdown 文档失败：${path}`);
  }
}

function collapseChanges(changes: RuntimeProjectFileChange[]) {
  const byPath = new Map<string, RuntimeProjectFileChange>();
  for (const change of changes) byPath.set(comparablePath(change.path), change);
  return [...byPath.values()];
}

function comparablePath(path: string | undefined) {
  return (path || "").replaceAll("\\", "/");
}

function imageWindowWatchPath(window: DetachedImageWindow) {
  return window.watchPath || (window.source ? "" : window.file.path);
}

function isCsvPath(path: string) {
  return path.toLowerCase().endsWith(".csv");
}

function nextRequestRevision(revisions: Map<string, number>, path: string) {
  const key = comparablePath(path);
  const revision = (revisions.get(key) || 0) + 1;
  revisions.set(key, revision);
  return revision;
}

function isLatestRequest(revisions: Map<string, number>, path: string, revision: number) {
  return revisions.get(comparablePath(path)) === revision;
}
