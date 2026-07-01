import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { buildAiEditorContext, type AiCanvasSize, type AiEditingContext, type AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import type { AiApplyResult, AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import {
  FALLBACK_FILE_NAME,
  comparableDocumentFileName,
  ensureEditorDocumentFileName,
  fallbackFileNameForKind,
  normalizeThemeId
} from "@/features/mermaid-editor/lib/editor-state";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { normalizeEditorTheme, type EditorTheme, type EditorThemeId } from "@/features/mermaid-editor/lib/editor-theme";
import type { CanvasLayoutTheme, DiagramType, EdgeRouting, EditableKind, EditorHistory, EditorMode, EditorSnapshot, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { pushHistory } from "@/features/mermaid-editor/lib/editor-history";
import { buildInteractionContext } from "@/features/mermaid-editor/lib/interaction/context";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { applyMermaidPatch } from "@/features/mermaid-editor/lib/mermaid-patch";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { emptySelection } from "@/features/mermaid-editor/lib/editor-actions";
import { measurePerformance } from "@/features/mermaid-editor/lib/editor-performance";
import { upsertRecentFile, type RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
  editing?: Exclude<AiEditingContext, { kind: "source" }> | null;
  interaction?: string;
};

type UseEditorAiCommandsArgs = {
  runtime: EditorRuntime;
  sourceEditBaseRef: { current: EditorSnapshot | null };
  isDirtyRef: { current: boolean };
  source: string;
  currentDocument: string;
  documentKind: DocumentKind;
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  fileTheme: CanvasLayoutTheme | null;
  isDirty: boolean;
  diagramType: DiagramType;
  editableKind: EditableKind;
  mode: EditorMode;
  workspaceView: WorkspaceView;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  diagnostics: EditorDiagnostic[];
  viewFilters: ViewFilters;
  canvasLiveState: CanvasLiveState;
  recentActions: AiRecentAction[];
  preferences: EditorPreferences;
  snapshot: () => EditorSnapshot;
  flushSourceHistory: () => void;
  recordRecentAction: (type: string, target?: AiRecentAction["target"], summary?: string) => void;
  setHistory: StateSetter<EditorHistory>;
  setSource: StateSetter<string>;
  setGraph: StateSetter<MermaidGraph>;
  setDiagramType: StateSetter<DiagramType>;
  setEditableKind: StateSetter<EditableKind>;
  setViewport: StateSetter<ViewportState>;
  setEdgeRouting: StateSetter<EdgeRouting>;
  setLayoutMode: StateSetter<LayoutMode>;
  setFileTheme: StateSetter<CanvasLayoutTheme | null>;
  setThemeId: StateSetter<EditorThemeId>;
  setCustomTheme: StateSetter<EditorTheme | null>;
  setWorkspaceView: StateSetter<WorkspaceView>;
  setSelection: StateSetter<Selection>;
  setDiagnostics: StateSetter<EditorDiagnostic[]>;
  setFileName: StateSetter<string>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setLastSavedDocument: StateSetter<string>;
  setStatus: StateSetter<string>;
};

export function useEditorAiCommands({
  runtime,
  sourceEditBaseRef,
  isDirtyRef,
  source,
  currentDocument,
  documentKind,
  graph,
  selection,
  viewport,
  fileName,
  fileRef,
  fileTheme,
  isDirty,
  diagramType,
  editableKind,
  mode,
  workspaceView,
  edgeRouting,
  layoutMode,
  diagnostics,
  viewFilters,
  canvasLiveState,
  recentActions,
  preferences,
  snapshot,
  flushSourceHistory,
  recordRecentAction,
  setHistory,
  setSource,
  setGraph,
  setDiagramType,
  setEditableKind,
  setViewport,
  setEdgeRouting,
  setLayoutMode,
  setFileTheme,
  setThemeId,
  setCustomTheme,
  setWorkspaceView,
  setSelection,
  setDiagnostics,
  setFileName,
  setFileRef,
  setRecentFiles,
  setLastSavedDocument,
  setStatus
}: UseEditorAiCommandsArgs) {
  const aiContextPostTimerRef = useRef<number | null>(null);
  const aiCommandBusyRef = useRef(false);

  const buildCurrentAiContext = useCallback(() => {
    const editing: AiEditingContext | null =
      canvasLiveState.editing || (sourceEditBaseRef.current ? { kind: "source", draftText: source.slice(0, 1200) } : null);
    const interactionContext = buildInteractionContext({
      sourceLength: source.length,
      dirty: isDirty,
      graph,
      selection,
      viewport,
      viewFilters,
      diagramType,
      editableKind,
      mode,
      workspaceView,
      edgeRouting,
      layoutMode,
      canvasSize: canvasLiveState.canvasSize,
      editing
    });

    return buildAiEditorContext({
      source,
      graph,
      selection,
      viewport,
      fileName: fileName || fallbackFileNameForKind(documentKind),
      dirty: isDirty,
      diagramType,
      editableKind,
      mode,
      workspaceView,
      edgeRouting,
      layoutMode,
      diagnostics,
      canvasSize: canvasLiveState.canvasSize,
      editing,
      recentActions,
      interactionContext
    });
  }, [
    canvasLiveState,
    sourceEditBaseRef,
    source,
    isDirty,
    graph,
    selection,
    viewport,
    viewFilters,
    diagramType,
    editableKind,
    mode,
    workspaceView,
    edgeRouting,
    layoutMode,
    fileName,
    documentKind,
    diagnostics,
    recentActions
  ]);

  const postAiEditorContext = useCallback((context: ReturnType<typeof buildAiEditorContext>) => {
    return runtime.publishAiContext(context).catch(() => {
      // The CLI context bridge is best-effort; editor usage should not be blocked by it.
    });
  }, [runtime]);

  const postAiApplyResult = useCallback(async (result: AiApplyResult) => {
    await runtime.finishAiCommand(result);
  }, [runtime]);

  const processAiCommand = useCallback(
    async (command: AiEditorCommand) => {
      if (command.type !== "applyPatch") {
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [editorCommandDiagnostic("UNKNOWN_COMMAND", `不支持的 AI 命令：${(command as { type?: string }).type || "unknown"}`)]
        });
        return;
      }

      if (documentKind !== "mermaid") {
        const diagnostic = editorCommandDiagnostic(
          "UNSUPPORTED_DOCUMENT_KIND",
          "当前打开的是 Markdown 文件，AI Mermaid patch 只能应用到 Mermaid 文件。",
          "请切换到 Mermaid 文件后再执行图表修改。"
        );
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [diagnostic]
        });
        setStatus("AI 修改被拒绝：当前文件不是 Mermaid。");
        return;
      }

      if (command.targetFileName && comparableDocumentFileName(command.targetFileName, documentKind) !== comparableDocumentFileName(fileName, documentKind)) {
        const diagnostic = editorCommandDiagnostic(
          "TARGET_FILE_MISMATCH",
          `当前打开的是 ${fileName || FALLBACK_FILE_NAME}，不是 AI 命令目标 ${command.targetFileName}。`,
          "重新打开目标 Mermaid 文件，或不要传 --target。"
        );
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: [diagnostic]
        });
        setStatus("AI 修改被拒绝：目标文件不匹配。");
        return;
      }

      flushSourceHistory();
      const previousSnapshot = snapshot();
      const patched = applyMermaidPatch(currentDocument, { ops: command.ops }, { write: command.autoSave });

      if (!patched.ok || !patched.result) {
        setDiagnostics(patched.diagnostics);
        setStatus("AI 修改失败，请查看诊断。");
        await postAiApplyResult({
          commandId: command.id,
          applied: false,
          saved: false,
          changed: false,
          fileName,
          diagnostics: patched.diagnostics
        });
        return;
      }

      const loaded = loadMermaidDocument(patched.result.source, graph);
      const nextViewport = loaded.viewport || viewport;
      const nextLayoutMode = loaded.layoutMode;
      const nextGraph =
        loaded.editableKind === "flowchart" && nextLayoutMode === "auto"
          ? measurePerformance("dagre-auto-layout", () => applyDagreAutoLayout(loaded.graph), {
              nodes: loaded.graph.nodes.length,
              edges: loaded.graph.edges.length,
              aiApply: true
            })
          : loaded.graph;
      const nextDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, loaded.fileTheme ?? fileTheme);
      const resultDiagnostics: EditorDiagnostic[] = [];
      let saved = false;

      if (command.autoSave) {
        if (!fileRef) {
          resultDiagnostics.push(
            editorCommandDiagnostic(
              "NO_FILE_HANDLE",
              "当前编辑器没有可覆盖保存的文件路径，已更新编辑器但无法写回原文件。",
              "先打开文件，或在编辑器里另存为一次。",
              "warning"
            )
          );
        } else {
          try {
            const saveResult = await runtime.saveFile(fileRef, nextDocument, fileName, documentKind);
            if (saveResult.status === "saved") {
              setFileRef(saveResult.file);
              setRecentFiles((current) => upsertRecentFile(current, saveResult.file));
            }
            saved = true;
          } catch (error) {
            resultDiagnostics.push(editorCommandDiagnostic("SAVE_FAILED", `AI 修改已应用，但保存失败：${readableError(error)}`));
          }
        }
      }

      setHistory((current) => pushHistory(current, previousSnapshot));
      setSource(loaded.source);
      setGraph(nextGraph);
      setDiagramType(loaded.diagramType);
      setEditableKind(loaded.editableKind);
      setViewport(nextViewport);
      setEdgeRouting(loaded.edgeRouting);
      setLayoutMode(nextLayoutMode);
      setFileTheme(loaded.fileTheme ?? fileTheme);
      if (loaded.fileTheme) {
        setThemeId(normalizeThemeId(loaded.fileTheme.themeId));
        setCustomTheme(loaded.fileTheme.customTheme ? normalizeEditorTheme(loaded.fileTheme.customTheme) : null);
      }
      setWorkspaceView(workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid"));
      setSelection(emptySelection);
      setDiagnostics([]);
      if (fileRef) setFileName(ensureEditorDocumentFileName(fileRef.name, "mermaid"));
      if (saved) {
        setLastSavedDocument(nextDocument);
        isDirtyRef.current = false;
      }
      setStatus(saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");
      recordRecentAction("ai.apply", { kind: "document" }, saved ? "AI 修改已应用并保存。" : "AI 修改已应用。");

      await postAiApplyResult({
        commandId: command.id,
        applied: true,
        saved,
        changed: patched.result.changed,
        fileName: fileRef?.name || fileName,
        source: nextDocument,
        diff: patched.result.diff,
        diagnostics: resultDiagnostics
      });
    },
    [
      currentDocument,
      documentKind,
      fileName,
      fileRef,
      fileTheme,
      flushSourceHistory,
      graph,
      isDirtyRef,
      postAiApplyResult,
      recordRecentAction,
      runtime,
      setCustomTheme,
      setDiagramType,
      setDiagnostics,
      setEditableKind,
      setEdgeRouting,
      setFileName,
      setFileRef,
      setFileTheme,
      setGraph,
      setHistory,
      setLastSavedDocument,
      setLayoutMode,
      setRecentFiles,
      setSelection,
      setSource,
      setStatus,
      setThemeId,
      setViewport,
      setWorkspaceView,
      snapshot,
      viewport,
      workspaceView
    ]
  );

  useEffect(() => {
    if (aiContextPostTimerRef.current) window.clearTimeout(aiContextPostTimerRef.current);
    aiContextPostTimerRef.current = window.setTimeout(() => {
      void postAiEditorContext(buildCurrentAiContext());
      aiContextPostTimerRef.current = null;
    }, 220);

    return () => {
      if (aiContextPostTimerRef.current) window.clearTimeout(aiContextPostTimerRef.current);
    };
  }, [buildCurrentAiContext, postAiEditorContext, preferences]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void postAiEditorContext(buildCurrentAiContext());
    }, 3000);
    return () => window.clearInterval(timer);
  }, [buildCurrentAiContext, postAiEditorContext]);

  useEffect(() => {
    let disposed = false;

    async function pollAiCommand() {
      if (aiCommandBusyRef.current) return;
      aiCommandBusyRef.current = true;

      try {
        const command = await runtime.pollAiCommand();
        if (disposed || !command) return;
        await processAiCommand(command);
      } catch {
        // The AI command bridge is optional while a human edits in the browser.
      } finally {
        aiCommandBusyRef.current = false;
      }
    }

    const timer = window.setInterval(() => {
      void pollAiCommand();
    }, 800);
    void pollAiCommand();

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [processAiCommand, runtime]);
}

function editorCommandDiagnostic(code: string, message: string, suggestion?: string, severity: EditorDiagnostic["severity"] = "error"): EditorDiagnostic {
  return {
    id: `editor-command:${code}:${hashText(message)}`,
    severity,
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}
