import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

import { useEditorAutoSave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-auto-save";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { EditorRuntime, RuntimeDocumentSnapshot } from "@/features/mermaid-editor/lib/editor-runtime";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import {
  csvWindowPanelId,
  textWindowPanelId,
  type CsvWindowPanelId,
  type DetachedCsvWindow,
  type DetachedTextWindow,
  type TextWindowPanelId,
  type WorkspaceFloatingPanelId
} from "@/features/mermaid-editor/lib/workspace-panels";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import { isTextDocumentFilePath } from "@/features/mermaid-editor/lib/text-document";
import { isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";

type Setter<T> = Dispatch<SetStateAction<T>>;

export function useAuxiliaryDocumentWindows({
  runtime,
  preferences,
  textWindows,
  setTextWindows,
  csvWindows,
  setCsvWindows,
  bringPanelToFront,
  removePanel,
  setPanelWindowState,
  onTextFileSaved,
  onStatus,
  onError
}: {
  runtime: EditorRuntime;
  preferences: EditorPreferences;
  textWindows: DetachedTextWindow[];
  setTextWindows: Setter<DetachedTextWindow[]>;
  csvWindows: DetachedCsvWindow[];
  setCsvWindows: Setter<DetachedCsvWindow[]>;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  removePanel: (panelId: WorkspaceFloatingPanelId) => void;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  onTextFileSaved?: (path: string, text: string) => void;
  onStatus: (message: string) => void;
  onError: (error: unknown, fallback?: string) => void;
}) {
  const hydratedPanelIdsRef = useRef(new Set<string>());
  const applySnapshot = useCallback((snapshot: RuntimeDocumentSnapshot, preserveLocalValue = false) => {
    if (snapshot.kind === "text") {
      setTextWindows((current) => current.map((window) => sameDocument(window, snapshot) ? {
        ...window,
        file: { ...snapshot.file, path: snapshot.file.path || window.file.path },
        title: snapshot.file.name,
        value: preserveLocalValue && window.value !== snapshot.content ? window.value : snapshot.content,
        savedValue: snapshot.savedContent,
        format: snapshot.format,
        missing: snapshot.syncState === "deleted"
      } : window));
    } else if (snapshot.kind === "csv") {
      setCsvWindows((current) => current.map((window) => sameDocument(window, snapshot) ? {
        ...window,
        file: { ...snapshot.file, path: snapshot.file.path || window.file.path },
        title: snapshot.file.name,
        value: preserveLocalValue && window.value !== snapshot.content ? window.value : snapshot.content,
        savedValue: snapshot.savedContent,
        format: snapshot.format,
        canUndo: snapshot.canUndo,
        canRedo: snapshot.canRedo,
        missing: snapshot.syncState === "deleted"
      } : window));
    }
  }, [setCsvWindows, setTextWindows]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    void runtime.listenForDocumentHubEvents((event) => {
      if (event.snapshot.kind === "text" || event.snapshot.kind === "csv") applySnapshot(event.snapshot);
    }).then((listener) => { dispose = listener; });
    return () => dispose?.();
  }, [applySnapshot, runtime]);

  useEffect(() => {
    for (const window of [...textWindows, ...csvWindows]) {
      if (hydratedPanelIdsRef.current.has(window.id)) continue;
      hydratedPanelIdsRef.current.add(window.id);
      void runtime.openDocumentSnapshot(window.file.path).then(async (snapshot) => {
        if (!snapshot) return;
        if (window.value === window.savedValue) {
          applySnapshot(snapshot);
          return;
        }
        const restored = await runtime.syncDocumentWorkingCopy({
          documentId: snapshot.documentId, path: snapshot.file.path, content: window.value,
          baseContent: window.savedValue, baseRevision: window.file.revision,
          label: `恢复 ${window.title} 工作副本`, origin: window.id.startsWith("csv:") ? "csv" : "view"
        });
        if (restored.snapshot) applySnapshot(restored.snapshot, Boolean(restored.snapshot.conflict));
      }).catch((error) => onError(error, `恢复 ${window.title} 工作副本失败。`));
    }
  }, [applySnapshot, csvWindows, onError, runtime, textWindows]);

  const openTextWindow = useCallback(async (file: ProjectFileEntry) => {
    if (!isTextDocumentFilePath(file.path)) return;
    const existing = textWindows.find((window) => window.file.path === file.path);
    if (existing) {
      setTextWindows((current) => current.map((window) => window.id === existing.id ? { ...window, open: true } : window));
      bringPanelToFront(existing.id);
      return;
    }
    try {
      const snapshot = await runtime.openDocumentSnapshot(file.path);
      if (!snapshot) return;
      const path = snapshot.file.path || file.path;
      const openedPanelId = textWindowPanelId({ ...snapshot.file, path });
      hydratedPanelIdsRef.current.add(openedPanelId);
      setTextWindows((current) => [...current, {
        id: openedPanelId,
        file: { ...snapshot.file, path },
        title: snapshot.file.name,
        value: snapshot.content,
        savedValue: snapshot.savedContent,
        format: snapshot.format,
        missing: snapshot.syncState === "deleted"
      }]);
      bringPanelToFront(openedPanelId);
      setPanelWindowState(openedPanelId, "normal");
      onStatus(`已在文本编辑器中打开 ${snapshot.file.name}。`);
    } catch (error) { onError(error, "打开文本文件失败。"); }
  }, [bringPanelToFront, onError, onStatus, runtime, setPanelWindowState, setTextWindows, textWindows]);

  const openCsvWindow = useCallback(async (file: ProjectFileEntry) => {
    if (!isCsvTableFilePath(file.path)) return;
    const existing = csvWindows.find((window) => window.file.path === file.path);
    if (existing) {
      setCsvWindows((current) => current.map((window) => window.id === existing.id ? { ...window, open: true } : window));
      bringPanelToFront(existing.id);
      return;
    }
    try {
      const snapshot = await runtime.openDocumentSnapshot(file.path);
      if (!snapshot) return;
      const path = snapshot.file.path || file.path;
      const openedPanelId = csvWindowPanelId({ ...snapshot.file, path });
      hydratedPanelIdsRef.current.add(openedPanelId);
      setCsvWindows((current) => [...current, {
        id: openedPanelId,
        file: { ...snapshot.file, path },
        title: snapshot.file.name,
        value: snapshot.content,
        savedValue: snapshot.savedContent,
        format: snapshot.format,
        headerMode: "auto",
        canUndo: snapshot.canUndo,
        canRedo: snapshot.canRedo,
        missing: snapshot.syncState === "deleted"
      }]);
      bringPanelToFront(openedPanelId);
      setPanelWindowState(openedPanelId, "normal");
      onStatus(`已在 CSV 编辑器中打开 ${snapshot.file.name}。`);
    } catch (error) { onError(error, "打开 CSV 文件失败。"); }
  }, [bringPanelToFront, csvWindows, onError, onStatus, runtime, setCsvWindows, setPanelWindowState]);

  const syncTextWindow = useCallback((panelId: TextWindowPanelId, value: string) => {
    const target = textWindows.find((window) => window.id === panelId);
    if (!target) return;
    setTextWindows((current) => current.map((window) => window.id === panelId ? { ...window, value } : window));
    void syncWorkingCopy(runtime, target, value, "编辑文本").then((snapshot) => snapshot && applySnapshot(snapshot, true)).catch((error) => onError(error, "同步文本工作副本失败。"));
  }, [applySnapshot, onError, runtime, setTextWindows, textWindows]);

  const syncCsvWindow = useCallback((panelId: CsvWindowPanelId, value: string) => {
    const target = csvWindows.find((window) => window.id === panelId);
    if (!target) return;
    setCsvWindows((current) => current.map((window) => window.id === panelId ? { ...window, value } : window));
    void syncWorkingCopy(runtime, target, value, "编辑 CSV").then((snapshot) => snapshot && applySnapshot(snapshot, true)).catch((error) => onError(error, "同步 CSV 工作副本失败。"));
  }, [applySnapshot, csvWindows, onError, runtime, setCsvWindows]);

  const saveTextWindow = useCallback(async (panelId: TextWindowPanelId) => {
    const target = textWindows.find((window) => window.id === panelId);
    const saved = await saveWindow(runtime, target, applySnapshot, onStatus, onError);
    if (saved && target?.file.path) onTextFileSaved?.(target.file.path, target.value);
    return saved;
  }, [applySnapshot, onError, onStatus, onTextFileSaved, runtime, textWindows]);
  const saveCsvWindow = useCallback(async (panelId: CsvWindowPanelId) => saveWindow(runtime, csvWindows.find((window) => window.id === panelId), applySnapshot, onStatus, onError), [applySnapshot, csvWindows, onError, onStatus, runtime]);

  const undoCsvWindow = useCallback(async (panelId: CsvWindowPanelId) => {
    const target = csvWindows.find((window) => window.id === panelId);
    if (!target?.file.documentId) return;
    const result = await runtime.undoDocumentTransaction({ documentId: target.file.documentId }) as { snapshot?: RuntimeDocumentSnapshot };
    if (result.snapshot) applySnapshot(result.snapshot);
  }, [applySnapshot, csvWindows, runtime]);
  const redoCsvWindow = useCallback(async (panelId: CsvWindowPanelId) => {
    const target = csvWindows.find((window) => window.id === panelId);
    if (!target?.file.documentId) return;
    const result = await runtime.redoDocumentTransaction({ documentId: target.file.documentId }) as { snapshot?: RuntimeDocumentSnapshot };
    if (result.snapshot) applySnapshot(result.snapshot);
  }, [applySnapshot, csvWindows, runtime]);

  const saveAll = useCallback(async () => {
    const dirty = [...textWindows, ...csvWindows].filter((window) => window.value !== window.savedValue);
    const results = await Promise.all(dirty.map((window) => saveWindow(runtime, window, applySnapshot, onStatus, onError)));
    dirty.forEach((window, index) => { if (results[index] && isTextDocumentFilePath(window.file.path)) onTextFileSaved?.(window.file.path, window.value); });
    return results.every(Boolean);
  }, [applySnapshot, csvWindows, onError, onStatus, onTextFileSaved, runtime, textWindows]);
  const discardAll = useCallback(async () => {
    const dirty = [...textWindows, ...csvWindows].filter((window) => window.value !== window.savedValue);
    await Promise.all(dirty.map(async (window) => {
      const result = await runtime.discardDocumentWorkingCopy({ documentId: window.file.documentId, path: window.file.path }) as { snapshot?: RuntimeDocumentSnapshot };
      if (result.snapshot) applySnapshot(result.snapshot);
    }));
  }, [applySnapshot, csvWindows, runtime, textWindows]);
  const dirtyDocumentNames = useMemo(() => [...textWindows, ...csvWindows].filter((window) => window.value !== window.savedValue).map((window) => window.title), [csvWindows, textWindows]);
  const dirtyKey = useMemo(() => [...textWindows, ...csvWindows].filter((window) => window.value !== window.savedValue).map((window) => `${window.id}:${window.value.length}:${window.file.workingRevision || ""}`).join("|"), [csvWindows, textWindows]);
  useEditorAutoSave({ preferences, dirty: Boolean(dirtyKey), fileBacked: true, documentRevisionKey: dirtyKey, save: saveAll });

  return {
    openTextWindow,
    openCsvWindow,
    updateTextWindow: syncTextWindow,
    updateCsvWindow: syncCsvWindow,
    saveTextWindow,
    saveCsvWindow,
    undoCsvWindow,
    redoCsvWindow,
    saveAll,
    discardAll,
    dirtyDocumentNames,
    setCsvHeaderMode(panelId: CsvWindowPanelId, headerMode: DetachedCsvWindow["headerMode"]) {
      setCsvWindows((current) => current.map((window) => window.id === panelId ? { ...window, headerMode } : window));
    },
    closeTextWindow(panelId: TextWindowPanelId) { setTextWindows((current) => current.flatMap((window) => window.id !== panelId ? [window] : window.value !== window.savedValue ? [{ ...window, open: false }] : [])); removePanel(panelId); },
    closeCsvWindow(panelId: CsvWindowPanelId) { setCsvWindows((current) => current.flatMap((window) => window.id !== panelId ? [window] : window.value !== window.savedValue ? [{ ...window, open: false }] : [])); removePanel(panelId); }
  };
}

function sameDocument(window: DetachedTextWindow | DetachedCsvWindow, snapshot: RuntimeDocumentSnapshot) {
  return window.file.documentId === snapshot.documentId || window.file.path === snapshot.file.path;
}

async function syncWorkingCopy(runtime: EditorRuntime, window: DetachedTextWindow | DetachedCsvWindow, content: string, label: string) {
  const result = await runtime.syncDocumentWorkingCopy({
    documentId: window.file.documentId,
    path: window.file.path,
    content,
    baseContent: window.savedValue,
    baseRevision: window.file.revision,
    label,
    origin: window.id.startsWith("csv:") ? "csv" : "view"
  });
  return result.snapshot;
}

async function saveWindow(runtime: EditorRuntime, window: DetachedTextWindow | DetachedCsvWindow | undefined, applySnapshot: (snapshot: RuntimeDocumentSnapshot) => void, onStatus: (message: string) => void, onError: (error: unknown, fallback?: string) => void) {
  if (!window) return false;
  try {
    const result = await runtime.saveDocumentWorkingCopy({
      documentId: window.file.documentId,
      path: window.file.path,
      text: window.value,
      expectedRevision: window.file.revision,
      expectedWorkingRevision: window.file.workingRevision,
      format: window.format
    }) as { status?: string; snapshot?: RuntimeDocumentSnapshot };
    if (result.snapshot) applySnapshot(result.snapshot);
    if (result.status === "conflict") return false;
    onStatus(`已保存 ${window.title}。`);
    return true;
  } catch (error) {
    onError(error, `保存 ${window.title} 失败。`);
    return false;
  }
}
