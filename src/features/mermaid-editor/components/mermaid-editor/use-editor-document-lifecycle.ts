import type { Dispatch, SetStateAction } from "react";

import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { applyLayout, edgeRoutingFromLayout, layoutModeFromLayout, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { EditorRecentAction } from "@/features/mermaid-editor/lib/editor-interaction-state";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import {
  BLANK_FLOWCHART_SOURCE,
  BLANK_MARKDOWN_SOURCE,
  FALLBACK_FILE_NAME,
  FALLBACK_MARKDOWN_FILE_NAME,
  createEmptyDocumentGraph,
  ensureEditorDocumentFileName,
  fallbackFileNameForKind,
  normalizeStoredDocumentKind,
  nodeGeometrySpecForTheme,
  normalizeThemeId,
  type StoredEditor,
  type StoredEditorApplyResult,
  type StoredEditorDraftOverrides
} from "@/features/mermaid-editor/lib/editor-state";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { normalizeEditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import {
  normalizeRecentFiles,
  upsertRecentFile,
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";
import { normalizeExplorerTreeState, type StoredExplorerTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import { documentKindFromPath, documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { normalizeProjectWorkspace, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  DiagramType,
  EditableKind,
  EdgeRouting,
  EditorHistory,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorTheme, EditorThemeId } from "@/features/mermaid-editor/lib/editor-theme";
import { normalizeEditorTheme } from "@/features/mermaid-editor/lib/editor-theme";
import { DEFAULT_VIEW_FILTERS, normalizeViewFilters, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { normalizeEditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { EditorDocumentBuffer, EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";

type FileOpenSource = "picker" | "recent" | "project" | "drop" | "external" | "restore" | "watch" | "buffer";
type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseEditorDocumentLifecycleArgs = {
  nodeGeometrySpec?: NodeGeometrySpec;
  isDirtyRef: { current: boolean };
  setDocumentKind: StateSetter<DocumentKind>;
  setSource: StateSetter<string>;
  setGraph: StateSetter<MermaidGraph>;
  setDiagramType: StateSetter<DiagramType>;
  setEditableKind: StateSetter<EditableKind>;
  setViewport: StateSetter<ViewportState>;
  setEdgeRouting: StateSetter<EdgeRouting>;
  setLayoutMode: StateSetter<LayoutMode>;
  setSelection: StateSetter<Selection>;
  setDiagnostics: StateSetter<EditorDiagnostic[]>;
  setHistory: StateSetter<EditorHistory>;
  setLeftCollapsed: StateSetter<boolean>;
  setRightCollapsed: StateSetter<boolean>;
  setWorkspaceView: StateSetter<WorkspaceView>;
  setViewFilters: StateSetter<ViewFilters>;
  setFileName: StateSetter<string>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setProjectWorkspace: StateSetter<ProjectWorkspace | null>;
  setExplorerTreeState: StateSetter<StoredExplorerTreeState>;
  setLastSavedDocument: StateSetter<string>;
  beginDocumentSession: () => void;
  setFileWorkflowError: StateSetter<FileWorkflowError | null>;
  setThemeId: StateSetter<EditorThemeId>;
  setCustomTheme: StateSetter<EditorTheme | null>;
  setPreferences: StateSetter<EditorPreferences>;
  setStatus: StateSetter<string>;
  flushSourceHistory: () => void;
  syncWorkspaceForOpenedFile: (file: RuntimeFileRef | null) => void;
  prepareFileSwitch: (targetName?: string) => Promise<boolean>;
  persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
  recordRecentAction: (type: string, target?: EditorRecentAction["target"], summary?: string) => void;
  activateDocumentBuffer: (input: {
    documentKind: DocumentKind;
    fileName: string;
    fileRef: RuntimeFileRef | null;
    content: string;
    savedContent: string;
    status?: EditorDocumentBuffer["status"];
    bufferId?: string;
  }) => EditorDocumentBuffer;
  beginUntitledDocumentBuffer: (input: {
    documentKind: DocumentKind;
    fileName: string;
    content: string;
    savedContent: string;
    status?: EditorDocumentBuffer["status"];
  }) => EditorDocumentBuffer;
  replaceEditorDocumentSession: (session: EditorDocumentSession) => EditorDocumentSession;
};

export function useEditorDocumentLifecycle({
  nodeGeometrySpec,
  isDirtyRef,
  setDocumentKind,
  setSource,
  setGraph,
  setDiagramType,
  setEditableKind,
  setViewport,
  setEdgeRouting,
  setLayoutMode,
  setSelection,
  setDiagnostics,
  setHistory,
  setLeftCollapsed,
  setRightCollapsed,
  setWorkspaceView,
  setViewFilters,
  setFileName,
  setFileRef,
  setRecentFiles,
  setProjectWorkspace,
  setExplorerTreeState,
  setLastSavedDocument,
  beginDocumentSession,
  setFileWorkflowError,
  setThemeId,
  setCustomTheme,
  setPreferences,
  setStatus,
  flushSourceHistory,
  syncWorkspaceForOpenedFile,
  prepareFileSwitch,
  persistStoredEditorDraft,
  recordRecentAction,
  activateDocumentBuffer,
  beginUntitledDocumentBuffer,
  replaceEditorDocumentSession
}: UseEditorDocumentLifecycleArgs) {
  function applyLoadedDocument(
    text: string,
    name: string,
    file: RuntimeFileRef | null,
    source: FileOpenSource = "picker",
    options: { savedContent?: string; bufferId?: string; status?: EditorDocumentBuffer["status"] } = {}
  ) {
    flushSourceHistory();
    const nextDocumentKind = documentKindFromPath(file?.path || name) || "mermaid";
    if (nextDocumentKind !== "mermaid") {
      const savedDocument = text;
      const savedContent = options.savedContent ?? savedDocument;
      const nextFileName = ensureEditorDocumentFileName(name, nextDocumentKind);

      beginDocumentSession();
      activateDocumentBuffer({
        documentKind: nextDocumentKind,
        fileName: nextFileName,
        fileRef: file,
        content: savedDocument,
        savedContent,
        status: options.status,
        bufferId: options.bufferId
      });
      setDocumentKind(nextDocumentKind);
      setSource(text);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport({ x: 160, y: 90, scale: 1 });
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setWorkspaceView(workspaceViewForDocument("render-only", undefined, nextDocumentKind));
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(file);
      setLastSavedDocument(savedContent);
      isDirtyRef.current = savedDocument !== savedContent;
      setRecentFiles((current) => upsertRecentFile(current, file));
      setFileWorkflowError(null);
      setStatus(source === "watch" ? `已从磁盘刷新 ${name}。` : `已在${documentKindLabel(nextDocumentKind)}编辑器中打开 ${name}。`);
      if (source !== "watch") recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
      if (source !== "restore" && source !== "watch") void syncWorkspaceForOpenedFile(file);
      return;
    }

    const loaded = loadMermaidDocument(text);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph, { spec: nodeGeometrySpec }) : loaded.graph;
    const savedDocument = buildMermaidDocument(loaded.source, loadedGraph, nextViewport, loaded.edgeRouting, nextLayoutMode);
    const savedContent = options.savedContent ?? savedDocument;

    beginDocumentSession();
    activateDocumentBuffer({
      documentKind: "mermaid",
      fileName: ensureEditorDocumentFileName(name, "mermaid"),
      fileRef: file,
      content: savedDocument,
      savedContent,
      status: options.status,
      bufferId: options.bufferId
    });
    setDocumentKind("mermaid");
    setSource(loaded.source);
    setGraph(loadedGraph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setViewport(nextViewport);
    setEdgeRouting(loaded.edgeRouting);
    setLayoutMode(nextLayoutMode);
    setWorkspaceView(loaded.editableKind === "flowchart" ? "canvas" : "render");
    setSelection(createEmptyDocumentSelection());
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(ensureEditorDocumentFileName(name, "mermaid"));
    setFileRef(file);
    setLastSavedDocument(savedContent);
    isDirtyRef.current = savedDocument !== savedContent;
    setRecentFiles((current) => upsertRecentFile(current, file));
    setFileWorkflowError(null);
    setStatus(source === "watch"
      ? `已从磁盘刷新 ${name}。`
      : loaded.editableKind === "flowchart" ? `已打开 ${name}。` : `已打开 ${name}，当前类型仅渲染。`);
    if (source !== "watch") recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
    if (source !== "restore" && source !== "watch") void syncWorkspaceForOpenedFile(file);
  }

  function applyStoredEditorState(stored: StoredEditor): StoredEditorApplyResult {
    flushSourceHistory();
    const restoredSession = normalizeEditorDocumentSession(stored.editorSession);
    if (restoredSession) replaceEditorDocumentSession(restoredSession);
    beginDocumentSession();
    const storedDocumentKind = normalizeStoredDocumentKind(stored.documentKind, stored.fileName, stored.fileRef?.path);
    if (storedDocumentKind !== "mermaid") {
      const nextPreferences = normalizeEditorPreferences(stored.preferences);
      const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
      const nextSource = stored.source || (storedDocumentKind === "markdown" ? BLANK_MARKDOWN_SOURCE : "");
      const fallbackFileName = fallbackFileNameForKind(storedDocumentKind);
      const nextFileName = ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || fallbackFileName, storedDocumentKind);

      setDocumentKind(storedDocumentKind);
      setSource(nextSource);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(stored.viewport || { x: 160, y: 90, scale: 1 });
      setEdgeRouting(stored.edgeRouting || DEFAULT_EDGE_ROUTING);
      setLayoutMode(stored.layoutMode || DEFAULT_LAYOUT_MODE);
      setLeftCollapsed(shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace: nextProjectWorkspace,
        recentFiles: nextRecentFiles,
        fileRef: stored.fileRef || null,
        fileName: nextFileName,
        fallbackFileName
      }));
      setRightCollapsed(nextPreferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false);
      setWorkspaceView(workspaceViewForDocument("render-only", stored.workspaceView, storedDocumentKind));
      setViewFilters(nextViewFilters);
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(stored.fileRef || null);
      setRecentFiles(nextRecentFiles);
      setProjectWorkspace(nextProjectWorkspace);
      setExplorerTreeState(normalizeExplorerTreeState(stored.explorerTreeState));
      setLastSavedDocument(stored.lastSavedDocument || "");
      isDirtyRef.current = stored.fileRef ? nextSource !== (stored.lastSavedDocument || "") : !stored.lastSavedDocument || nextSource !== stored.lastSavedDocument;
      setThemeId(normalizeThemeId(stored.themeId));
      setCustomTheme(stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null);
      setPreferences(nextPreferences);
      setFileWorkflowError(null);

      return {
        documentKind: storedDocumentKind,
        currentDocument: nextSource,
        fileRef: stored.fileRef || null,
        lastSavedDocument: stored.lastSavedDocument || "",
        preferences: nextPreferences
      };
    }

    const loaded = loadMermaidDocument(stored.source);
    const legacyLayout = parseCanvasLayout(stored.source);
    const layout = stored.layout || legacyLayout;
    const parsedGraph = loaded.editableKind === "flowchart" ? parseMermaid(loaded.source) : loaded.graph;
    const nextGraph = loaded.editableKind === "flowchart" ? applyLayout(parsedGraph, layout) : parsedGraph;
    const nextViewport = stored.viewport || layout?.viewport || { x: 160, y: 90, scale: 1 };
    const nextEdgeRouting = stored.edgeRouting || edgeRoutingFromLayout(layout);
    const nextLayoutMode = stored.layoutMode || layoutModeFromLayout(layout);
    const nextThemeId = normalizeThemeId(stored.themeId);
    const nextCustomTheme = stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null;
    const resolvedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto"
      ? applyDagreAutoLayout(nextGraph, { spec: nodeGeometrySpecForTheme(nextThemeId, nextCustomTheme) })
      : nextGraph;
    const nextPreferences = normalizeEditorPreferences(stored.preferences);
    const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
    const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
    const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
    const currentStoredDocument = buildMermaidDocument(loaded.source, resolvedGraph, nextViewport, nextEdgeRouting, nextLayoutMode);

    setDocumentKind("mermaid");
    setSource(loaded.source);
    setGraph(resolvedGraph);
    setDiagramType(loaded.diagramType);
    setEditableKind(loaded.editableKind);
    setViewport(nextViewport);
    setEdgeRouting(nextEdgeRouting);
    setLayoutMode(nextLayoutMode);
    setLeftCollapsed(shouldCollapseExplorerOnStartup({
      startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
      storedCollapsed: stored.leftCollapsed,
      projectWorkspace: nextProjectWorkspace,
      recentFiles: nextRecentFiles,
      fileRef: stored.fileRef || null,
      fileName: stored.fileName,
      fallbackFileName: FALLBACK_FILE_NAME
    }));
    setRightCollapsed(nextPreferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false);
    setWorkspaceView(workspaceViewForDocument(loaded.editableKind, stored.workspaceView, "mermaid"));
    setViewFilters(nextViewFilters);
    setSelection(createEmptyDocumentSelection());
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_FILE_NAME, "mermaid"));
    setFileRef(stored.fileRef || null);
    setRecentFiles(nextRecentFiles);
    setProjectWorkspace(nextProjectWorkspace);
    setExplorerTreeState(normalizeExplorerTreeState(stored.explorerTreeState));
    setLastSavedDocument(stored.lastSavedDocument || "");
    isDirtyRef.current = stored.fileRef ? currentStoredDocument !== (stored.lastSavedDocument || "") : !stored.lastSavedDocument || currentStoredDocument !== stored.lastSavedDocument;
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
    setPreferences(nextPreferences);
    setFileWorkflowError(null);

    return {
      documentKind: "mermaid",
      currentDocument: currentStoredDocument,
      fileRef: stored.fileRef || null,
      lastSavedDocument: stored.lastSavedDocument || "",
      preferences: nextPreferences
    };
  }

  async function newMermaidFile() {
    if (!(await prepareFileSwitch(FALLBACK_FILE_NAME))) return;

    flushSourceHistory();
    const nextGraph = parseMermaid(BLANK_FLOWCHART_SOURCE);
    const nextSource = serializeMermaid(nextGraph);
    const nextViewport = { x: 160, y: 90, scale: 1 };

    beginDocumentSession();
    beginUntitledDocumentBuffer({ documentKind: "mermaid", fileName: FALLBACK_FILE_NAME, content: nextSource, savedContent: "", status: "dirty" });
    setDocumentKind("mermaid");
    setSource(nextSource);
    setGraph(nextGraph);
    setDiagramType("flowchart");
    setEditableKind("flowchart");
    setViewport(nextViewport);
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("canvas");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(createEmptyDocumentSelection());
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_FILE_NAME);
    setFileRef(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白 Mermaid 文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白 Mermaid 文件。");

    try {
      await persistStoredEditorDraft({
        documentKind: "mermaid",
        source: nextSource,
        graph: nextGraph,
        viewport: nextViewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileName: FALLBACK_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "canvas"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  async function newMarkdownFile() {
    if (!(await prepareFileSwitch(FALLBACK_MARKDOWN_FILE_NAME))) return;

    flushSourceHistory();
    const nextGraph = createEmptyDocumentGraph();

    beginDocumentSession();
    beginUntitledDocumentBuffer({ documentKind: "markdown", fileName: FALLBACK_MARKDOWN_FILE_NAME, content: BLANK_MARKDOWN_SOURCE, savedContent: "", status: "dirty" });
    setDocumentKind("markdown");
    setSource(BLANK_MARKDOWN_SOURCE);
    setGraph(nextGraph);
    setDiagramType("unknown");
    setEditableKind("render-only");
    setViewport({ x: 160, y: 90, scale: 1 });
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("markdown");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(createEmptyDocumentSelection());
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_MARKDOWN_FILE_NAME);
    setFileRef(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白 Markdown 文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白 Markdown 文件。");

    try {
      await persistStoredEditorDraft({
        documentKind: "markdown",
        source: BLANK_MARKDOWN_SOURCE,
        graph: nextGraph,
        viewport: { x: 160, y: 90, scale: 1 },
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileName: FALLBACK_MARKDOWN_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "markdown"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  return {
    applyLoadedDocument,
    applyStoredEditorState,
    newMermaidFile,
    newMarkdownFile
  };
}

function createEmptyDocumentSelection(): Selection {
  return { nodeIds: [], edgeIds: [], subgraphIds: [], primaryId: undefined };
}
