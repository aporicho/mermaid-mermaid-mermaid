import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { layoutFromGraph } from "@/features/mermaid-editor/lib/canvas-layout";
import {
  BLANK_MARKDOWN_SOURCE,
  FALLBACK_FILE_NAME,
  buildFallbackCleanDocument,
  createEmptyDocumentGraph,
  fallbackFileNameForKind,
  serializableRuntimeFileRef,
  type StoredEditor,
  type StoredEditorDraftOverrides
} from "@/features/mermaid-editor/lib/editor-state";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type {
  EditorRuntime,
  RuntimeFileRef
} from "@/features/mermaid-editor/lib/editor-runtime";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import type {
  EdgeRouting,
  LayoutMode,
  MermaidGraph,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTheme, EditorThemeId } from "@/features/mermaid-editor/lib/editor-theme";
import type { RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { projectWorkspaceForStorage } from "@/features/mermaid-editor/lib/project-workspace";
import type { StoredExplorerTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import { cleanCloseDocument } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import type { EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { DetachedCsvWindow, DetachedMarkdownWindow, DetachedTextWindow } from "@/features/mermaid-editor/lib/workspace-panels";

export type UseEditorDraftPersistenceArgs = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  source: string;
  graph: MermaidGraph;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  nodeGeometrySpec?: NodeGeometrySpec;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView: WorkspaceView;
  viewFilters: ViewFilters;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  recentFiles: RecentFileEntry[];
  projectWorkspace: ProjectWorkspace | null;
  explorerTreeState: StoredExplorerTreeState;
  lastSavedDocument: string;
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  preferences: EditorPreferences;
  editorSession: EditorDocumentSession;
  detachedMarkdownWindows: DetachedMarkdownWindow[];
  detachedTextWindows: DetachedTextWindow[];
  detachedCsvWindows: DetachedCsvWindow[];
};

export function useEditorDraftPersistence({
  runtime,
  documentKind,
  source,
  graph,
  viewport,
  edgeRouting,
  layoutMode,
  nodeGeometrySpec,
  leftCollapsed,
  rightCollapsed,
  workspaceView,
  viewFilters,
  fileName,
  fileRef,
  recentFiles,
  projectWorkspace,
  explorerTreeState,
  lastSavedDocument,
  themeId,
  customTheme,
  preferences,
  editorSession,
  detachedMarkdownWindows,
  detachedTextWindows,
  detachedCsvWindows
}: UseEditorDraftPersistenceArgs) {
  function buildStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}): StoredEditor {
    const draftDocumentKind = overrides.documentKind ?? documentKind;
    const draftSource = overrides.source ?? source;
    const draftGraph = overrides.graph ?? graph;
    const draftViewport = overrides.viewport ?? viewport;
    const draftEdgeRouting = overrides.edgeRouting ?? edgeRouting;
    const draftLayoutMode = overrides.layoutMode ?? layoutMode;
    const draftFileRef = "fileRef" in overrides ? overrides.fileRef : fileRef;
    const draftThemeId = overrides.themeId ?? themeId;
    const draftCustomTheme = "customTheme" in overrides ? overrides.customTheme : customTheme;
    const draftProjectWorkspace = "projectWorkspace" in overrides ? overrides.projectWorkspace : projectWorkspace;

    return {
      documentKind: draftDocumentKind,
      source: draftSource,
      ...(draftDocumentKind === "mermaid" ? { layout: layoutFromGraph(draftGraph, draftViewport, draftEdgeRouting, draftLayoutMode) } : {}),
      viewport: draftViewport,
      edgeRouting: draftEdgeRouting,
      layoutMode: draftLayoutMode,
      leftCollapsed,
      rightCollapsed,
      workspaceView: overrides.workspaceView ?? workspaceView,
      viewFilters,
      fileName: overrides.fileName ?? fileName,
      fileRef: serializableRuntimeFileRef(draftFileRef ?? null),
      recentFiles: overrides.recentFiles ?? recentFiles,
      projectWorkspace: projectWorkspaceForStorage(draftProjectWorkspace ?? null),
      explorerTreeState,
      lastSavedDocument: overrides.lastSavedDocument ?? lastSavedDocument,
      themeId: draftThemeId,
      customTheme: draftCustomTheme ?? null,
      editorSession: overrides.editorSession ?? editorSession,
      detachedMarkdownWindows: detachedMarkdownWindows.map((window) => ({
        ...window,
        file: serializableRuntimeFileRef(window.file) || { name: window.title }
      })),
      detachedTextWindows: detachedTextWindows.map((window) => ({
        ...window,
        file: { ...(serializableRuntimeFileRef(window.file) || { name: window.title }), path: window.file.path }
      })),
      detachedCsvWindows: detachedCsvWindows.map((window) => ({
        ...window,
        file: { ...(serializableRuntimeFileRef(window.file) || { name: window.title }), path: window.file.path }
      })),
      preferences
    };
  }

  async function persistStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}) {
    await runtime.saveDraft(buildStoredEditorDraft(overrides));
  }

  async function persistDiscardedCloseDraft(editorSessionOverride?: EditorDocumentSession) {
    if (documentKind !== "mermaid") {
      const keepCurrentFile = Boolean(fileRef || lastSavedDocument?.trim());
      const fallbackSource = documentKind === "markdown" ? BLANK_MARKDOWN_SOURCE : "";
      const fallbackFileName = fallbackFileNameForKind(documentKind);
      await persistDiscardedEditorDraft({
        documentKind,
        source: keepCurrentFile ? lastSavedDocument : fallbackSource,
        graph: createEmptyDocumentGraph(),
        fileName: keepCurrentFile ? fileName : fallbackFileName,
        fileRef: keepCurrentFile ? fileRef : null,
        lastSavedDocument: keepCurrentFile ? lastSavedDocument : fallbackSource,
        editorSession: editorSessionOverride,
        workspaceView: workspaceViewForDocument("render-only", workspaceView, documentKind)
      });
      return;
    }

    const cleanDocument = cleanCloseDocument(lastSavedDocument, buildFallbackCleanDocument());
    const loaded = loadMermaidDocument(cleanDocument);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const nextGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph, { spec: nodeGeometrySpec }) : loaded.graph;
    const normalizedDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode);
    const keepCurrentFile = Boolean(lastSavedDocument?.trim());

    await persistDiscardedEditorDraft({
      source: loaded.source,
      graph: nextGraph,
      viewport: nextViewport,
      edgeRouting: loaded.edgeRouting,
      layoutMode: nextLayoutMode,
      fileName: keepCurrentFile ? fileName : FALLBACK_FILE_NAME,
      fileRef: keepCurrentFile ? fileRef : null,
      lastSavedDocument: normalizedDocument,
      editorSession: editorSessionOverride,
      workspaceView: workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid")
    });
  }

  async function persistDiscardedEditorDraft(overrides: StoredEditorDraftOverrides) {
    const draft = buildStoredEditorDraft(overrides);
    draft.detachedTextWindows = draft.detachedTextWindows?.map((window) => ({ ...window, value: window.savedValue }));
    draft.detachedCsvWindows = draft.detachedCsvWindows?.map((window) => ({ ...window, value: window.savedValue }));
    await runtime.saveDraft(draft);
  }

  return {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft
  };
}
