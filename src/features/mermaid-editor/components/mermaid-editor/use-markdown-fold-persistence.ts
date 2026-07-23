import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { normalizeMarkdownFoldSnapshot, type MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";
import { isRuntimePathInsideProjectWorkspace, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

type MarkdownFoldBinding = {
  foldState: MarkdownFoldSnapshot | null | undefined;
  onFoldStateChange?: (snapshot: MarkdownFoldSnapshot) => void;
};

type PendingMarkdownFoldWrite = {
  timer: ReturnType<typeof setTimeout>;
  write: () => Promise<unknown> | null;
};

const MARKDOWN_FOLD_WRITE_DELAY_MS = 300;

export function useMarkdownFoldPersistence({
  runtime,
  projectWorkspace,
  files,
  currentFile,
  detachedMarkdownWindows,
  onStatus
}: {
  runtime: EditorRuntime;
  projectWorkspace: ProjectWorkspace | null;
  files?: RuntimeFileRef[];
  currentFile?: RuntimeFileRef | null;
  detachedMarkdownWindows?: ReadonlyArray<{ file: RuntimeFileRef }>;
  onStatus: (message: string) => void;
}) {
  const [snapshots, setSnapshots] = useState<Record<string, MarkdownFoldSnapshot | null>>({});
  const requestedRef = useRef(new Set<string>());
  const locallyChangedRef = useRef(new Set<string>());
  const pendingWritesRef = useRef(new Map<string, PendingMarkdownFoldWrite>());
  const writesRef = useRef(new Set<Promise<unknown>>());
  const reportedErrorsRef = useRef(new Set<string>());
  const rootPath = projectWorkspace?.rootPath;
  const trackedFiles = useMemo(() => files ?? [
    ...(currentFile ? [currentFile] : []),
    ...(detachedMarkdownWindows ?? []).map((window) => window.file)
  ], [currentFile, detachedMarkdownWindows, files]);
  const persistentFiles = useMemo(() => trackedFiles.filter((file) => canPersistFile(runtime, projectWorkspace, file)), [projectWorkspace, runtime, trackedFiles]);
  const persistentFileKey = persistentFiles.map((file) => storageKey(rootPath!, file.path!)).sort().join("\n");

  const reportError = useCallback((operation: "读取" | "保存" | "迁移", filePath: string, error: unknown) => {
    const key = `${operation}:${filePath}`;
    if (reportedErrorsRef.current.has(key)) return;
    reportedErrorsRef.current.add(key);
    const detail = error instanceof Error ? error.message : String(error || "未知错误");
    onStatus(`Markdown 折叠状态${operation}失败：${detail}`);
  }, [onStatus]);

  useEffect(() => {
    if (!rootPath) return;
    let disposed = false;
    for (const file of persistentFiles) {
      const key = storageKey(rootPath, file.path!);
      if (requestedRef.current.has(key)) continue;
      requestedRef.current.add(key);
      void runtime.readMarkdownFoldState({ rootPath, documentPath: file.path! }).then((result) => {
        if (disposed) return;
        const snapshot = result.status === "loaded" ? normalizeMarkdownFoldSnapshot(result.snapshot) : null;
        setSnapshots((current) => locallyChangedRef.current.has(key) ? current : { ...current, [key]: snapshot });
      }).catch((error) => {
        if (disposed) return;
        setSnapshots((current) => locallyChangedRef.current.has(key) ? current : { ...current, [key]: null });
        reportError("读取", file.path!, error);
      });
    }
    return () => {
      disposed = true;
    };
  }, [persistentFileKey, persistentFiles, reportError, rootPath, runtime]);

  const writeSnapshot = useCallback((file: RuntimeFileRef, snapshot: MarkdownFoldSnapshot) => {
    if (!rootPath || !canPersistFile(runtime, projectWorkspace, file)) return null;
    const write = runtime.writeMarkdownFoldState({ rootPath, documentPath: file.path!, snapshot })
      .catch((error) => reportError("保存", file.path!, error));
    writesRef.current.add(write);
    void write.finally(() => writesRef.current.delete(write));
    return write;
  }, [projectWorkspace, reportError, rootPath, runtime]);

  const persistSnapshot = useCallback((file: RuntimeFileRef, snapshot: MarkdownFoldSnapshot) => {
    if (!rootPath || !canPersistFile(runtime, projectWorkspace, file)) return;
    const key = storageKey(rootPath, file.path!);
    locallyChangedRef.current.add(key);
    setSnapshots((current) => ({ ...current, [key]: snapshot }));
    const pending = pendingWritesRef.current.get(key);
    if (pending) clearTimeout(pending.timer);
    const write = () => writeSnapshot(file, snapshot);
    const timer = setTimeout(() => {
      pendingWritesRef.current.delete(key);
      write();
    }, MARKDOWN_FOLD_WRITE_DELAY_MS);
    pendingWritesRef.current.set(key, { timer, write });
  }, [projectWorkspace, rootPath, runtime, writeSnapshot]);

  const bindingFor = useCallback((file: RuntimeFileRef | null | undefined): MarkdownFoldBinding => {
    if (!file || !rootPath || !canPersistFile(runtime, projectWorkspace, file)) return { foldState: null };
    const key = storageKey(rootPath, file.path!);
    return {
      foldState: Object.hasOwn(snapshots, key) ? snapshots[key] : undefined,
      onFoldStateChange: (snapshot) => persistSnapshot(file, snapshot)
    };
  }, [persistSnapshot, projectWorkspace, rootPath, runtime, snapshots]);

  const flushMarkdownFoldWrites = useCallback(async () => {
    const pending = [...pendingWritesRef.current.values()];
    pendingWritesRef.current.clear();
    for (const pendingWrite of pending) {
      clearTimeout(pendingWrite.timer);
      pendingWrite.write();
    }
    await Promise.allSettled([...writesRef.current]);
  }, []);

  const migrateMarkdownFoldState = useCallback(async (sourcePath: string, targetPath: string) => {
    if (!rootPath || runtime.host !== "electron" || !isMarkdownPath(sourcePath)) return;
    await flushMarkdownFoldWrites();
    const sourceKey = storageKey(rootPath, sourcePath);
    const targetKey = storageKey(rootPath, targetPath);
    setSnapshots((current) => {
      if (!Object.hasOwn(current, sourceKey)) return current;
      const next = { ...current, [targetKey]: current[sourceKey] };
      delete next[sourceKey];
      return next;
    });
    requestedRef.current.delete(sourceKey);
    requestedRef.current.add(targetKey);
    if (locallyChangedRef.current.delete(sourceKey)) locallyChangedRef.current.add(targetKey);
    try {
      await runtime.moveMarkdownFoldState({ rootPath, sourcePath, targetPath });
    } catch (error) {
      reportError("迁移", sourcePath, error);
    }
  }, [flushMarkdownFoldWrites, reportError, rootPath, runtime]);

  const flushBeforeWindowClose = useCallback(async (prepareWindowClose: () => Promise<boolean>) => {
    await flushMarkdownFoldWrites();
    return prepareWindowClose();
  }, [flushMarkdownFoldWrites]);

  return { bindingFor, flushBeforeWindowClose, flushMarkdownFoldWrites, migrateMarkdownFoldState };
}

function canPersistFile(runtime: EditorRuntime, workspace: ProjectWorkspace | null, file: RuntimeFileRef) {
  return runtime.host === "electron"
    && Boolean(file.path)
    && isMarkdownPath(file.path!)
    && isRuntimePathInsideProjectWorkspace(file.path, workspace);
}

function storageKey(rootPath: string, filePath: string) {
  return `${normalizePath(rootPath)}\u0000${normalizePath(filePath)}`;
}

function normalizePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/\/+$/, "");
  return /^[A-Za-z]:/.test(normalized) ? normalized.toLocaleLowerCase() : normalized;
}

function isMarkdownPath(value: string) {
  return /\.(?:md|markdown)$/i.test(value);
}
