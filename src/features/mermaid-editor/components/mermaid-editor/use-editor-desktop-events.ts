import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type Dispatch, type SetStateAction } from "react";

import { FALLBACK_FILE_NAME, type StoredEditor, type StoredEditorApplyResult } from "@/features/mermaid-editor/lib/editor-state";
import { normalizeEditorPreferences, type EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { EditorRuntime, RuntimeFileDropRequest, RuntimeFileOpenRequest, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { normalizeRecentFiles, type RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { normalizeProjectWorkspace, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { normalizeExplorerTreeState, type StoredExplorerTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

import type { FileOpenSource } from "./use-editor-file-workflow";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorDesktopEventsArgs = {
  runtime: EditorRuntime;
  lastWindowFocusAtRef: { current: number };
  isDirtyRef: { current: boolean };
  currentDocumentRef: { current: string };
  openRuntimeFileRequest: (file: RuntimeFileOpenRequest, source: FileOpenSource) => Promise<void>;
  handleRuntimeFileDropRequest: (request: RuntimeFileDropRequest) => void;
  prepareWindowClose: () => Promise<boolean>;
  beforeDesktopWindowClose?: () => void;
  applyLoadedDocument: (text: string, name: string, file: RuntimeFileRef | null, source?: FileOpenSource) => void;
  applyStoredEditorState: (stored: StoredEditor) => StoredEditorApplyResult;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
  setDraftPersistenceReady: StateSetter<boolean>;
  setPreferences: StateSetter<EditorPreferences>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setProjectWorkspace: StateSetter<ProjectWorkspace | null>;
  setExplorerTreeState: StateSetter<StoredExplorerTreeState>;
  setProjectBusy: StateSetter<boolean>;
  setFileName: StateSetter<string>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setLastSavedDocument: StateSetter<string>;
  setStatus: StateSetter<string>;
  setDetachedMarkdownWindows: StateSetter<DetachedMarkdownWindow[]>;
};

export function useEditorDesktopEvents({
  runtime,
  lastWindowFocusAtRef,
  isDirtyRef,
  currentDocumentRef,
  openRuntimeFileRequest,
  handleRuntimeFileDropRequest,
  prepareWindowClose,
  beforeDesktopWindowClose,
  applyLoadedDocument,
  applyStoredEditorState,
  showFileWorkflowError,
  setDraftPersistenceReady,
  setPreferences,
  setRecentFiles,
  setProjectWorkspace,
  setExplorerTreeState,
  setProjectBusy,
  setFileName,
  setFileRef,
  setLastSavedDocument,
  setStatus,
  setDetachedMarkdownWindows
}: UseEditorDesktopEventsArgs) {
  const desktopFileWorkflowInitializedRef = useRef(false);
  const canCloseWindowRef = useRef(false);
  const openPathRequestRef = useRef(openRuntimeFileRequest);
  const fileDropRequestRef = useRef(handleRuntimeFileDropRequest);
  const prepareCloseRequestRef = useRef(prepareWindowClose);
  const beforeCloseRef = useRef(beforeDesktopWindowClose);
  const applyLoadedDocumentRef = useRef(applyLoadedDocument);
  const applyStoredEditorStateRef = useRef(applyStoredEditorState);

  useEffect(() => {
    function markWindowFocus() {
      lastWindowFocusAtRef.current = Date.now();
    }

    window.addEventListener("focus", markWindowFocus);
    return () => window.removeEventListener("focus", markWindowFocus);
  }, [lastWindowFocusAtRef]);

  const startDesktopWindowDragHandle = useCallback(
    async (event: ReactPointerEvent<HTMLElement>) => {
      if (runtime.kind !== "desktop" || event.button !== 0 || event.detail > 1) return;
      try {
        await runtime.startDesktopWindowDrag();
      } catch {
        // Window dragging is desktop-only; ignore capability/runtime failures in web-like shells.
      }
    },
    [runtime]
  );

  const toggleDesktopWindowMaximizeHandle = useCallback(
    async () => {
      if (runtime.kind !== "desktop") return;
      try {
        await runtime.toggleDesktopWindowMaximize();
      } catch {
        // Window controls are optional outside the desktop shell.
      }
    },
    [runtime]
  );

  useEffect(() => {
    openPathRequestRef.current = openRuntimeFileRequest;
    fileDropRequestRef.current = handleRuntimeFileDropRequest;
    prepareCloseRequestRef.current = prepareWindowClose;
    beforeCloseRef.current = beforeDesktopWindowClose;
    applyLoadedDocumentRef.current = applyLoadedDocument;
    applyStoredEditorStateRef.current = applyStoredEditorState;
  });

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (canCloseWindowRef.current) return;
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirtyRef]);

  useEffect(() => {
    if (runtime.kind !== "desktop" || desktopFileWorkflowInitializedRef.current) return;
    desktopFileWorkflowInitializedRef.current = true;
    let disposed = false;
    let unlistenExternal: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    async function restoreDesktopState() {
      try {
        const stored = (await runtime.loadSavedState()) as StoredEditor | null;
        if (!stored) return;
        const storedPreferences = normalizeEditorPreferences(stored.preferences);
        const storedProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
        setPreferences(storedPreferences);
        setRecentFiles(normalizeRecentFiles(stored.recentFiles));
        setProjectWorkspace(storedProjectWorkspace);
        setExplorerTreeState(normalizeExplorerTreeState(stored.explorerTreeState));
        setDetachedMarkdownWindows(normalizeStoredMarkdownWindows(stored.detachedMarkdownWindows));
        if (storedProjectWorkspace) void refreshRestoredProjectWorkspace(storedProjectWorkspace.rootPath);
        if (!storedPreferences.restoreLastFile) {
          setFileName(FALLBACK_FILE_NAME);
          setFileRef(null);
          setLastSavedDocument(currentDocumentRef.current);
          isDirtyRef.current = false;
          return;
        }
        const restored = applyStoredEditorStateRef.current(stored);
        const cleanStoredFile = Boolean(
          restored.preferences.restoreLastFile &&
            restored.fileRef?.path &&
            restored.lastSavedDocument &&
            restored.currentDocument === restored.lastSavedDocument
        );
        if (!cleanStoredFile || !restored.fileRef?.path) {
          if (restored.lastSavedDocument && restored.currentDocument !== restored.lastSavedDocument) {
            setStatus("已恢复未保存草稿。");
          }
          return;
        }

        try {
          const result = await runtime.openFilePath(restored.fileRef.path);
          if (!disposed && result.status === "opened") applyLoadedDocumentRef.current(result.text, result.file.name, result.file, "restore");
        } catch (error) {
          if (!disposed) showFileWorkflowError(error, "恢复上次文件失败。");
        }
      } catch (error) {
        if (!disposed) showFileWorkflowError(error, "读取应用状态失败。");
      }
    }

    async function refreshRestoredProjectWorkspace(rootPath: string) {
      setProjectBusy(true);
      try {
        const result = await runtime.readProjectFolder(rootPath);
        if (disposed || result.status !== "opened") return;
        setProjectWorkspace(normalizeProjectWorkspace(result.workspace));
      } catch {
        // Restored project metadata is still useful if the folder cannot be refreshed.
      } finally {
        if (!disposed) setProjectBusy(false);
      }
    }

    async function registerDesktopFileWorkflow() {
      await restoreDesktopState();
      const pendingFiles = await runtime.takePendingOpenFiles();
      if (!disposed && pendingFiles[0]) await openPathRequestRef.current(pendingFiles[0], "external");
      if (!disposed) setDraftPersistenceReady(true);

      unlistenExternal = await runtime.listenForExternalFileOpen((files) => {
        const file = files[0];
        if (!file) return;
        void openPathRequestRef.current(file, "external");
      });

      unlistenDrop = await runtime.listenForFileDrops((request) => fileDropRequestRef.current(request));

      unlistenClose = await runtime.listenForDesktopWindowCloseRequest(async () => {
        if (canCloseWindowRef.current) {
          beforeCloseRef.current?.();
          return true;
        }
        const canClose = await prepareCloseRequestRef.current();
        if (!canClose) return false;
        canCloseWindowRef.current = true;
        beforeCloseRef.current?.();
        return true;
      });
    }

    void registerDesktopFileWorkflow().catch((error) => {
      if (!disposed) {
        setDraftPersistenceReady(true);
        showFileWorkflowError(error, "初始化桌面文件工作流失败。");
      }
    });

    return () => {
      disposed = true;
      unlistenExternal?.();
      unlistenDrop?.();
      unlistenClose?.();
    };
  }, [
    currentDocumentRef,
    isDirtyRef,
    runtime,
    setDraftPersistenceReady,
    setFileName,
    setFileRef,
    setLastSavedDocument,
    setPreferences,
    setProjectBusy,
    setProjectWorkspace,
    setExplorerTreeState,
    setRecentFiles,
    setStatus,
    setDetachedMarkdownWindows,
    showFileWorkflowError
  ]);

  return { startDesktopWindowDragHandle, toggleDesktopWindowMaximizeHandle };
}

function normalizeStoredMarkdownWindows(value: unknown): DetachedMarkdownWindow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const record = candidate as Partial<DetachedMarkdownWindow>;
    if (typeof record.id !== "string" || typeof record.title !== "string" || typeof record.value !== "string" || typeof record.savedValue !== "string") return [];
    if (!record.file || typeof record.file.name !== "string") return [];
    return [{ ...record, file: record.file } as DetachedMarkdownWindow];
  });
}
