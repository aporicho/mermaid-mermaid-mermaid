import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import { useAuxiliaryDocumentWindows } from "@/features/mermaid-editor/components/mermaid-editor/use-auxiliary-document-windows";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import type { FloatingPanelWindowState } from "@/features/mermaid-editor/lib/floating-chrome";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { csvTableDocumentAction, resolveCsvTableDocumentFile } from "@/features/mermaid-editor/lib/csv-table-document";
import { resolveTextDocumentFile, textDocumentNodeAction } from "@/features/mermaid-editor/lib/text-document";
import type { DetachedCsvWindow, DetachedTextWindow, WorkspaceFloatingPanelId } from "@/features/mermaid-editor/lib/workspace-panels";

type Setter<T> = Dispatch<SetStateAction<T>>;
type CloseActions = { dirtyNames: string[]; saveAll: () => Promise<boolean>; discardAll: () => Promise<void> };

export function useEditorAuxiliaryDocumentController({
  runtime, preferences, textWindows, setTextWindows, csvWindows, setCsvWindows,
  fileRef, projectWorkspace, bringPanelToFront, removePanel, setPanelWindowState,
  executeCanvasNodeAction, closeActionsRef, onTextFileSaved, onStatus, onError
}: {
  runtime: EditorRuntime; preferences: EditorPreferences;
  textWindows: DetachedTextWindow[]; setTextWindows: Setter<DetachedTextWindow[]>;
  csvWindows: DetachedCsvWindow[]; setCsvWindows: Setter<DetachedCsvWindow[]>;
  fileRef: RuntimeFileRef | null; projectWorkspace: ProjectWorkspace | null;
  bringPanelToFront: (panelId: WorkspaceFloatingPanelId) => void;
  removePanel: (panelId: WorkspaceFloatingPanelId) => void;
  setPanelWindowState: (panelId: WorkspaceFloatingPanelId, state: FloatingPanelWindowState) => void;
  executeCanvasNodeAction: (node: CanvasNode) => void | Promise<unknown>;
  closeActionsRef: MutableRefObject<CloseActions>;
  onStatus: (message: string) => void;
  onError: (error: unknown, fallback?: string) => void;
  onTextFileSaved?: (path: string, text: string) => void;
}) {
  const windows = useAuxiliaryDocumentWindows({
    runtime, preferences, textWindows, setTextWindows, csvWindows, setCsvWindows,
    bringPanelToFront, removePanel, setPanelWindowState, onTextFileSaved, onStatus, onError
  });
  const executeNodeAction = useCallback((node: CanvasNode) => {
    const textAction = textDocumentNodeAction(node.action);
    if (textAction) return void windows.openTextWindow(resolveTextDocumentFile(textAction.path, fileRef?.path, projectWorkspace));
    const csvAction = csvTableDocumentAction(node.action);
    if (csvAction) return void windows.openCsvWindow(resolveCsvTableDocumentFile(csvAction.path, fileRef?.path, projectWorkspace));
    return executeCanvasNodeAction(node);
  }, [executeCanvasNodeAction, fileRef?.path, projectWorkspace, windows]);
  closeActionsRef.current = { dirtyNames: windows.dirtyDocumentNames, saveAll: windows.saveAll, discardAll: windows.discardAll };
  return { windows, executeNodeAction };
}
