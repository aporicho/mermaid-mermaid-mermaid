import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { layoutFromGraph } from "@/features/mermaid-editor/lib/canvas-layout";
import {
  BLANK_MARKDOWN_SOURCE,
  FALLBACK_CANVAS_FILE_NAME,
  FALLBACK_FILE_NAME,
  FALLBACK_MARKDOWN_FILE_NAME,
  buildFallbackCleanDocument,
  createEmptyDocumentGraph,
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
import {
  createBlankCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
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

export type UseEditorDraftPersistenceArgs = {
  runtime: EditorRuntime;
  documentKind: DocumentKind;
  source: string;
  canvasDocument: CanvasDocument;
  graph: MermaidGraph;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
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
};

export function useEditorDraftPersistence({
  runtime,
  documentKind,
  source,
  canvasDocument,
  graph,
  viewport,
  edgeRouting,
  layoutMode,
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
  preferences
}: UseEditorDraftPersistenceArgs) {
  function buildStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}): StoredEditor {
    const draftDocumentKind = overrides.documentKind ?? documentKind;
    const draftSource = overrides.source ?? source;
    const draftCanvasDocument = overrides.canvasDocument ?? canvasDocument;
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
      source: draftDocumentKind === "canvas" ? serializeCanvasDocument(draftCanvasDocument) : draftSource,
      ...(draftDocumentKind === "canvas" ? { canvasDocument: draftCanvasDocument } : {}),
      ...(draftDocumentKind === "mermaid" ? { layout: layoutFromGraph(draftGraph, draftViewport, draftEdgeRouting, draftLayoutMode) } : {}),
      viewport: draftDocumentKind === "canvas" ? draftCanvasDocument.viewport : draftViewport,
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
      preferences
    };
  }

  async function persistStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}) {
    await runtime.saveDraft(buildStoredEditorDraft(overrides));
  }

  async function persistDiscardedCloseDraft() {
    if (documentKind === "markdown") {
      const keepCurrentFile = Boolean(lastSavedDocument?.trim());
      await persistStoredEditorDraft({
        documentKind: "markdown",
        source: keepCurrentFile ? lastSavedDocument : BLANK_MARKDOWN_SOURCE,
        graph: createEmptyDocumentGraph(),
        fileName: keepCurrentFile ? fileName : FALLBACK_MARKDOWN_FILE_NAME,
        fileRef: keepCurrentFile ? fileRef : null,
        lastSavedDocument: keepCurrentFile ? lastSavedDocument : BLANK_MARKDOWN_SOURCE,
        workspaceView: workspaceViewForDocument("render-only", workspaceView, "markdown")
      });
      return;
    }

    if (documentKind === "canvas") {
      const keepCurrentFile = Boolean(lastSavedDocument?.trim());
      const cleanDocument = keepCurrentFile ? parseCanvasDocument(lastSavedDocument) : createBlankCanvasDocument();
      const cleanSource = serializeCanvasDocument(cleanDocument);
      await persistStoredEditorDraft({
        documentKind: "canvas",
        source: cleanSource,
        canvasDocument: cleanDocument,
        graph: createEmptyDocumentGraph(),
        viewport: cleanDocument.viewport,
        fileName: keepCurrentFile ? fileName : FALLBACK_CANVAS_FILE_NAME,
        fileRef: keepCurrentFile ? fileRef : null,
        lastSavedDocument: cleanSource,
        workspaceView: "canvas"
      });
      return;
    }

    const cleanDocument = cleanCloseDocument(lastSavedDocument, buildFallbackCleanDocument());
    const loaded = loadMermaidDocument(cleanDocument);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const nextGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const normalizedDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode);
    const keepCurrentFile = Boolean(lastSavedDocument?.trim());

    await persistStoredEditorDraft({
      source: loaded.source,
      graph: nextGraph,
      viewport: nextViewport,
      edgeRouting: loaded.edgeRouting,
      layoutMode: nextLayoutMode,
      fileName: keepCurrentFile ? fileName : FALLBACK_FILE_NAME,
      fileRef: keepCurrentFile ? fileRef : null,
      lastSavedDocument: normalizedDocument,
      workspaceView: workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid")
    });
  }

  return {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft
  };
}
