import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { applyLayout, edgeRoutingFromLayout, layoutModeFromLayout, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import {
  createBlankCanvasDocument,
  normalizeCanvasDocument,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { documentKindFromPath, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { ensureRuntimeDocumentFileName, createEditorRuntime, type RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import {
  DEFAULT_EDGE_ROUTING,
  DEFAULT_LAYOUT_MODE,
  type CanvasLayout,
  type DiagramType,
  type EditableKind,
  type EdgeRouting,
  type LayoutMode,
  type MermaidGraph,
  type ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import {
  DEFAULT_EDITOR_THEME,
  compileEditorTheme,
  isBuiltInThemeId,
  normalizeEditorTheme,
  resolveEditorTheme,
  type EditorTheme,
  type EditorThemeId
} from "@/features/mermaid-editor/lib/editor-theme";
import { themedNodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";
import { DEFAULT_EDITOR_PREFERENCES, normalizeEditorPreferences, type EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";
import {
  EMPTY_EXPLORER_TREE_STATE,
  normalizeExplorerTreeState,
  type StoredExplorerTreeState
} from "@/features/mermaid-editor/lib/explorer-tree-state";
import { normalizeRecentFiles, type RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { initialMermaidSource, parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import { normalizeProjectWorkspace, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { DEFAULT_VIEW_FILTERS, normalizeViewFilters, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

export const FALLBACK_FILE_NAME = "diagram.mmd";
export const FALLBACK_MARKDOWN_FILE_NAME = "document.md";
export const FALLBACK_CANVAS_FILE_NAME = "board.canvas.json";
export const BLANK_FLOWCHART_SOURCE = "flowchart LR";
export const BLANK_MARKDOWN_SOURCE = "# 未命名文档\n\n";

export type StoredEditor = {
  documentKind?: DocumentKind;
  source: string;
  canvasDocument?: CanvasDocument;
  layout?: CanvasLayout;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  viewport: ViewportState;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView?: WorkspaceView;
  showGrid?: boolean;
  showEdges?: boolean;
  viewFilters?: ViewFilters;
  fileName?: string;
  fileRef?: RuntimeFileRef | null;
  recentFiles?: RecentFileEntry[];
  projectWorkspace?: ProjectWorkspace | null;
  explorerTreeState?: StoredExplorerTreeState;
  lastSavedDocument?: string;
  themeId?: EditorThemeId;
  customTheme?: EditorTheme | null;
  preferences?: Partial<EditorPreferences>;
};

export type StoredEditorApplyResult = {
  documentKind: DocumentKind;
  currentDocument: string;
  fileRef: RuntimeFileRef | null;
  lastSavedDocument: string;
  preferences: EditorPreferences;
};

export type StoredEditorDraftOverrides = {
  documentKind?: DocumentKind;
  source?: string;
  canvasDocument?: CanvasDocument;
  graph?: MermaidGraph;
  viewport?: ViewportState;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  fileName?: string;
  fileRef?: RuntimeFileRef | null;
  recentFiles?: RecentFileEntry[];
  projectWorkspace?: ProjectWorkspace | null;
  lastSavedDocument?: string;
  workspaceView?: WorkspaceView;
  themeId?: EditorThemeId;
  customTheme?: EditorTheme | null;
};

export function createEmptyDocumentGraph(): MermaidGraph {
  return {
    direction: "LR",
    nodes: [],
    edges: [],
    subgraphs: [],
    diagramType: "unknown",
    editableKind: "render-only",
    parseStatus: "render-only"
  };
}

export function canvasDocumentFromStored(stored: Pick<StoredEditor, "canvasDocument" | "source">): CanvasDocument {
  if (stored.canvasDocument) return normalizeCanvasDocument(stored.canvasDocument);
  try {
    return parseCanvasDocument(stored.source || "");
  } catch {
    return createBlankCanvasDocument();
  }
}

export function fallbackFileNameForKind(documentKind: DocumentKind) {
  if (documentKind === "markdown") return FALLBACK_MARKDOWN_FILE_NAME;
  if (documentKind === "canvas") return FALLBACK_CANVAS_FILE_NAME;
  return FALLBACK_FILE_NAME;
}

export function normalizeStoredDocumentKind(value: unknown, fileName?: string, filePath?: string): DocumentKind {
  if (value === "markdown" || value === "mermaid" || value === "canvas") return value;
  return documentKindFromPath(filePath || fileName) || "mermaid";
}

export function loadInitialState() {
  const fallbackGraph = parseMermaid(initialMermaidSource);
  const fallbackViewport = { x: 160, y: 90, scale: 1 };
  const fallbackSource = serializeMermaid(fallbackGraph);
  const fallbackDocument = loadMermaidDocument(fallbackSource);
  const fallbackPreferences = DEFAULT_EDITOR_PREFERENCES;

  if (typeof window === "undefined") {
    return {
      documentKind: "mermaid" as DocumentKind,
      source: fallbackSource,
      canvasDocument: createBlankCanvasDocument(),
      graph: fallbackGraph,
      diagramType: fallbackDocument.diagramType,
      editableKind: fallbackDocument.editableKind,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      layoutMode: DEFAULT_LAYOUT_MODE,
      leftCollapsed: true,
      rightCollapsed: true,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      fileRef: null,
      recentFiles: [] as RecentFileEntry[],
      projectWorkspace: null,
      explorerTreeState: EMPTY_EXPLORER_TREE_STATE,
      lastSavedDocument: "",
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null,
      preferences: fallbackPreferences
    };
  }

  try {
    const stored = createEditorRuntime().loadDraft() as StoredEditor | null;
    if (!stored) throw new Error("No saved editor state");
    const explorerTreeState = normalizeExplorerTreeState(stored.explorerTreeState);
    const storedDocumentKind = normalizeStoredDocumentKind(stored.documentKind, stored.fileName, stored.fileRef?.path);
    if (storedDocumentKind === "markdown") {
      const preferences = normalizeEditorPreferences(stored.preferences);
      const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const recentFiles = normalizeRecentFiles(stored.recentFiles);
      const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const fileName = ensureRuntimeDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_MARKDOWN_FILE_NAME, "markdown");
      const themeId = normalizeThemeId(stored.themeId);
      const customTheme = stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null;

      return {
        documentKind: "markdown" as DocumentKind,
        source: stored.source || BLANK_MARKDOWN_SOURCE,
        canvasDocument: createBlankCanvasDocument(),
        graph: createEmptyDocumentGraph(),
        diagramType: "unknown" as DiagramType,
        editableKind: "render-only" as EditableKind,
        viewport: stored.viewport || fallbackViewport,
        edgeRouting: stored.edgeRouting || DEFAULT_EDGE_ROUTING,
        layoutMode: stored.layoutMode || DEFAULT_LAYOUT_MODE,
        leftCollapsed: shouldCollapseExplorerOnStartup({
          startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
          storedCollapsed: stored.leftCollapsed,
          projectWorkspace,
          recentFiles,
          fileRef: stored.fileRef || null,
          fileName,
          fallbackFileName: FALLBACK_MARKDOWN_FILE_NAME
        }),
        rightCollapsed: preferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false,
        workspaceView: workspaceViewForDocument("render-only", stored.workspaceView, "markdown"),
        viewFilters,
        fileName,
        fileRef: stored.fileRef || null,
        recentFiles,
        projectWorkspace,
        explorerTreeState,
        lastSavedDocument: stored.lastSavedDocument || "",
        themeId,
        customTheme,
        preferences
      };
    }

    if (storedDocumentKind === "canvas") {
      const preferences = normalizeEditorPreferences(stored.preferences);
      const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const recentFiles = normalizeRecentFiles(stored.recentFiles);
      const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const canvasDocument = canvasDocumentFromStored(stored);
      const fileName = ensureRuntimeDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_CANVAS_FILE_NAME, "canvas");

      return {
        documentKind: "canvas" as DocumentKind,
        source: serializeCanvasDocument(canvasDocument),
        canvasDocument,
        graph: createEmptyDocumentGraph(),
        diagramType: "unknown" as DiagramType,
        editableKind: "render-only" as EditableKind,
        viewport: canvasDocument.viewport || fallbackViewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        leftCollapsed: shouldCollapseExplorerOnStartup({
          startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
          storedCollapsed: stored.leftCollapsed,
          projectWorkspace,
          recentFiles,
          fileRef: stored.fileRef || null,
          fileName,
          fallbackFileName: FALLBACK_CANVAS_FILE_NAME
        }),
        rightCollapsed: true,
        workspaceView: "canvas" as WorkspaceView,
        viewFilters,
        fileName,
        fileRef: stored.fileRef || null,
        recentFiles,
        projectWorkspace,
        explorerTreeState,
        lastSavedDocument: stored.lastSavedDocument || "",
        themeId: normalizeThemeId(stored.themeId),
        customTheme: stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null,
        preferences
      };
    }

    const loaded = loadMermaidDocument(stored.source);
    const legacyLayout = parseCanvasLayout(stored.source);
    const source = loaded.source;
    const layout = stored.layout || legacyLayout;
    const parsedGraph = loaded.editableKind === "flowchart" ? parseMermaid(source) : loaded.graph;
    const graph = loaded.editableKind === "flowchart" ? applyLayout(parsedGraph, layout) : parsedGraph;
    const viewport = stored.viewport || layout?.viewport || fallbackViewport;
    const edgeRouting = stored.edgeRouting || edgeRoutingFromLayout(layout);
    const layoutMode = stored.layoutMode || layoutModeFromLayout(layout);
    const themeId = normalizeThemeId(stored.themeId);
    const customTheme = stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null;
    const resolvedGraph = loaded.editableKind === "flowchart" && layoutMode === "auto"
      ? applyDagreAutoLayout(graph, { spec: nodeGeometrySpecForTheme(themeId, customTheme) })
      : graph;
    const viewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
    const preferences = normalizeEditorPreferences(stored.preferences);
    const projectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
    const recentFiles = normalizeRecentFiles(stored.recentFiles);

    return {
      documentKind: "mermaid" as DocumentKind,
      source,
      canvasDocument: createBlankCanvasDocument(),
      graph: resolvedGraph,
      diagramType: loaded.diagramType,
      editableKind: loaded.editableKind,
      viewport,
      edgeRouting,
      layoutMode,
      leftCollapsed: shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: preferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace,
        recentFiles,
        fileRef: stored.fileRef || null,
        fileName: stored.fileName,
        fallbackFileName: FALLBACK_FILE_NAME
      }),
      rightCollapsed: preferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false,
      workspaceView: workspaceViewForDocument(loaded.editableKind, stored.workspaceView, "mermaid"),
      viewFilters,
      fileName: stored.fileName || FALLBACK_FILE_NAME,
      fileRef: stored.fileRef || null,
      recentFiles,
      projectWorkspace,
      explorerTreeState,
      lastSavedDocument: stored.lastSavedDocument || "",
      themeId,
      customTheme,
      preferences
    };
  } catch {
    return {
      documentKind: "mermaid" as DocumentKind,
      source: fallbackSource,
      canvasDocument: createBlankCanvasDocument(),
      graph: fallbackGraph,
      diagramType: fallbackDocument.diagramType,
      editableKind: fallbackDocument.editableKind,
      viewport: fallbackViewport,
      edgeRouting: DEFAULT_EDGE_ROUTING,
      layoutMode: DEFAULT_LAYOUT_MODE,
      leftCollapsed: true,
      rightCollapsed: true,
      workspaceView: "canvas" as WorkspaceView,
      viewFilters: DEFAULT_VIEW_FILTERS,
      fileName: FALLBACK_FILE_NAME,
      fileRef: null,
      recentFiles: [] as RecentFileEntry[],
      projectWorkspace: null,
      explorerTreeState: EMPTY_EXPLORER_TREE_STATE,
      lastSavedDocument: "",
      themeId: DEFAULT_EDITOR_THEME.id,
      customTheme: null,
      preferences: fallbackPreferences
    };
  }
}

export function buildFallbackCleanDocument() {
  const graph = parseMermaid(initialMermaidSource);
  const source = serializeMermaid(graph);
  return buildMermaidDocument(source, graph, { x: 160, y: 90, scale: 1 }, DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE);
}

export function ensureEditorDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  return ensureRuntimeDocumentFileName(value || fallbackFileNameForKind(documentKind), documentKind);
}

export function comparableDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  const name = value?.split(/[\\/]/).pop();
  return ensureEditorDocumentFileName(name, documentKind).toLowerCase();
}

export function serializableRuntimeFileRef(file: RuntimeFileRef | null): RuntimeFileRef | null {
  if (!file) return null;
  return {
    name: file.name,
    ...(file.path ? { path: file.path } : {})
  };
}

export function normalizeThemeId(value: unknown): EditorThemeId {
  return isBuiltInThemeId(value) || value === "custom" ? value : DEFAULT_EDITOR_THEME.id;
}

export function nodeGeometrySpecForTheme(themeId: EditorThemeId, customTheme: EditorTheme | null) {
  const compiled = compileEditorTheme(resolveEditorTheme(themeId, customTheme));
  return themedNodeGeometrySpec(compiled.geometry.node, compiled.specialNode, compiled.typography.tableNode.cell);
}
