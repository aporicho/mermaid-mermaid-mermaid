import { describe, expect, it } from "vitest";

import { useEditorDocumentLifecycle } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-lifecycle";
import {
  createBlankCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import { type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import {
  createEmptyDocumentGraph,
  type StoredEditorDraftOverrides
} from "@/features/mermaid-editor/lib/editor-state";
import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FileWorkflowError, RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
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
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import { DEFAULT_VIEW_FILTERS, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";

type LifecycleState = {
  documentKind: DocumentKind;
  source: string;
  canvasDocument: CanvasDocument;
  graph: MermaidGraph;
  diagramType: DiagramType;
  editableKind: EditableKind;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
  selection: Selection;
  diagnostics: EditorDiagnostic[];
  history: EditorHistory;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView: WorkspaceView;
  viewFilters: ViewFilters;
  fileName: string;
  fileRef: RuntimeFileRef | null;
  recentFiles: RecentFileEntry[];
  projectWorkspace: ProjectWorkspace | null;
  lastSavedDocument: string;
  fileWorkflowError: FileWorkflowError | null;
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  preferences: EditorPreferences;
  status: string;
};

function createLifecycleHarness() {
  const state: LifecycleState = {
    documentKind: "mermaid",
    source: "",
    canvasDocument: createBlankCanvasDocument(),
    graph: createEmptyDocumentGraph(),
    diagramType: "unknown",
    editableKind: "render-only",
    viewport: { x: 160, y: 90, scale: 1 },
    edgeRouting: DEFAULT_EDGE_ROUTING,
    layoutMode: DEFAULT_LAYOUT_MODE,
    selection: { nodeIds: [], edgeIds: [], subgraphIds: [], primaryId: undefined },
    diagnostics: [],
    history: createHistory(),
    leftCollapsed: true,
    rightCollapsed: true,
    workspaceView: "render",
    viewFilters: DEFAULT_VIEW_FILTERS,
    fileName: "diagram.mmd",
    fileRef: null,
    recentFiles: [],
    projectWorkspace: null,
    lastSavedDocument: "",
    fileWorkflowError: null,
    themeId: "warm-paper",
    customTheme: null,
    preferences: DEFAULT_EDITOR_PREFERENCES,
    status: ""
  };
  const isDirtyRef = { current: true };
  const syncedFiles: (RuntimeFileRef | null)[] = [];
  const persistedDrafts: StoredEditorDraftOverrides[] = [];

  function setState<K extends keyof LifecycleState>(key: K) {
    return (next: LifecycleState[K] | ((current: LifecycleState[K]) => LifecycleState[K])) => {
      state[key] = typeof next === "function"
        ? (next as (current: LifecycleState[K]) => LifecycleState[K])(state[key])
        : next;
    };
  }

  // This controller does not call React hooks; direct invocation keeps the state-transition test focused.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const lifecycle = useEditorDocumentLifecycle({
    isDirtyRef,
    setDocumentKind: setState("documentKind"),
    setSource: setState("source"),
    setCanvasDocument: setState("canvasDocument"),
    setGraph: setState("graph"),
    setDiagramType: setState("diagramType"),
    setEditableKind: setState("editableKind"),
    setViewport: setState("viewport"),
    setEdgeRouting: setState("edgeRouting"),
    setLayoutMode: setState("layoutMode"),
    setSelection: setState("selection"),
    setDiagnostics: setState("diagnostics"),
    setHistory: setState("history"),
    setLeftCollapsed: setState("leftCollapsed"),
    setRightCollapsed: setState("rightCollapsed"),
    setWorkspaceView: setState("workspaceView"),
    setViewFilters: setState("viewFilters"),
    setFileName: setState("fileName"),
    setFileRef: setState("fileRef"),
    setRecentFiles: setState("recentFiles"),
    setProjectWorkspace: setState("projectWorkspace"),
    setLastSavedDocument: setState("lastSavedDocument"),
    setFileWorkflowError: setState("fileWorkflowError"),
    setThemeId: setState("themeId"),
    setCustomTheme: setState("customTheme"),
    setPreferences: setState("preferences"),
    setStatus: setState("status"),
    flushSourceHistory: () => {},
    showFileWorkflowError: () => {},
    syncWorkspaceForOpenedFile: (file) => syncedFiles.push(file),
    prepareFileSwitch: async () => true,
    persistStoredEditorDraft: async (draft = {}) => {
      persistedDrafts.push(draft);
    },
    recordRecentAction: () => {}
  });

  return { lifecycle, state, isDirtyRef, syncedFiles, persistedDrafts };
}

describe("editor document lifecycle", () => {
  it("opens Mermaid documents into the editable canvas workspace", () => {
    const { lifecycle, state, isDirtyRef, syncedFiles } = createLifecycleHarness();
    const file = { name: "diagram.mmd", path: "/project/diagram.mmd" };

    lifecycle.applyLoadedDocument("flowchart LR\nA-->B", file.name, file);

    expect(state.documentKind).toBe("mermaid");
    expect(state.workspaceView).toBe("canvas");
    expect(state.fileName).toBe("diagram.mmd");
    expect(state.fileRef).toEqual(file);
    expect(state.lastSavedDocument).toContain("flowchart LR");
    expect(isDirtyRef.current).toBe(false);
    expect(syncedFiles).toEqual([file]);
  });

  it("opens Mermaid documents without applying legacy file themes", () => {
    const { lifecycle, state } = createLifecycleHarness();
    const file = { name: "diagram.mmd", path: "/project/diagram.mmd" };

    lifecycle.applyLoadedDocument(
      `%% canvas-layout: {"version":1,"edgeRouting":"bezier","layoutMode":"manual","theme":{"themeId":"minimal-mono"},"viewport":{"x":0,"y":0,"scale":1},"nodes":{"A":{"x":10,"y":20,"fill":"#fff"}}}
flowchart LR
  A[Alpha]`,
      file.name,
      file
    );

    expect(state.themeId).toBe("warm-paper");
    expect(state.customTheme).toBeNull();
    expect(state.lastSavedDocument).not.toContain('"theme"');
  });

  it("opens Markdown documents into the Markdown workspace", () => {
    const { lifecycle, state, isDirtyRef, syncedFiles } = createLifecycleHarness();
    const file = { name: "notes.md", path: "/project/notes.md" };

    lifecycle.applyLoadedDocument("# Notes\n", file.name, file);

    expect(state.documentKind).toBe("markdown");
    expect(state.workspaceView).toBe("markdown");
    expect(state.fileName).toBe("notes.md");
    expect(state.source).toBe("# Notes\n");
    expect(state.lastSavedDocument).toBe("# Notes\n");
    expect(isDirtyRef.current).toBe(false);
    expect(syncedFiles).toEqual([file]);
  });

  it("opens canvas documents into the canvas workspace", () => {
    const { lifecycle, state, isDirtyRef, syncedFiles } = createLifecycleHarness();
    const file = { name: "board.canvas.json", path: "/project/board.canvas.json" };
    const document = createBlankCanvasDocument();
    const serializedDocument = serializeCanvasDocument(document);

    lifecycle.applyLoadedDocument(serializedDocument, file.name, file);

    expect(state.documentKind).toBe("canvas");
    expect(state.workspaceView).toBe("canvas");
    expect(state.fileName).toBe("board.canvas.json");
    expect(state.lastSavedDocument).toBe(serializedDocument);
    expect(state.canvasDocument).toEqual(document);
    expect(isDirtyRef.current).toBe(false);
    expect(syncedFiles).toEqual([file]);
  });
});
