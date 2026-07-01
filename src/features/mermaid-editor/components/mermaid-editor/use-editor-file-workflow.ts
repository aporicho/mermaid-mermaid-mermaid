import { useCallback, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from "react";

import { applyDagreAutoLayout } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import { applyLayout, edgeRoutingFromLayout, layoutFromGraph, layoutModeFromLayout, parseCanvasLayout } from "@/features/mermaid-editor/lib/canvas-layout";
import type { AiCanvasSize, AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import { hasBlockingDiagnostics, type EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { createHistory } from "@/features/mermaid-editor/lib/editor-history";
import {
  BLANK_FLOWCHART_SOURCE,
  BLANK_MARKDOWN_SOURCE,
  FALLBACK_CANVAS_FILE_NAME,
  FALLBACK_FILE_NAME,
  FALLBACK_MARKDOWN_FILE_NAME,
  buildFallbackCleanDocument,
  canvasDocumentFromStored,
  createEmptyDocumentGraph,
  ensureEditorDocumentFileName,
  normalizeStoredDocumentKind,
  normalizeThemeId,
  serializableRuntimeFileRef,
  type StoredEditor,
  type StoredEditorApplyResult,
  type StoredEditorDraftOverrides
} from "@/features/mermaid-editor/lib/editor-state";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import { normalizeEditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import {
  createImageAsset,
  DEFAULT_IMAGE_ASSET_HEIGHT,
  DEFAULT_IMAGE_ASSET_WIDTH,
  isSupportedImagePath
} from "@/features/mermaid-editor/lib/node-assets";
import { buildMermaidDocument, loadMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { parseMermaid, serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import {
  createBlankCanvasDocument,
  createCanvasImageElement,
  parseCanvasDocument,
  serializeCanvasDocument,
  type CanvasDocument
} from "@/features/mermaid-editor/lib/canvas-document";
import {
  isRuntimeAbortError,
  type EditorRuntime,
  type RuntimeFileDropRequest,
  type RuntimeFileOpenRequest,
  type RuntimeFileRef,
  type RuntimeImageAssetResult
} from "@/features/mermaid-editor/lib/editor-runtime";
import {
  isSupportedDocumentFilePath,
  normalizeFileWorkflowError,
  normalizeRecentFiles,
  upsertRecentFile,
  type FileWorkflowError,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";
import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";
import { documentKindFromPath, documentKindLabel, type DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import { normalizeProjectWorkspace, workspaceRootForOpenedFile, type ProjectFileEntry, type ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
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
import type { CanvasLayoutTheme } from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_EDGE_ROUTING, DEFAULT_LAYOUT_MODE } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { EditorTheme, EditorThemeId } from "@/features/mermaid-editor/lib/editor-theme";
import { normalizeEditorTheme } from "@/features/mermaid-editor/lib/editor-theme";
import { DEFAULT_VIEW_FILTERS, normalizeViewFilters, type ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import { workspaceViewForDocument, type WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import {
  WINDOW_CLOSE_TARGET_NAME,
  cleanCloseDocument,
  resolveWindowCloseChoice,
  unsavedPromptDescription,
  type UnsavedPromptChoice
} from "@/features/mermaid-editor/lib/desktop-close-workflow";
import { canvasScreenToWorldPoint, classifyFileDrop, windowPointToSurfacePoint, type DropPoint, type FileDropCandidate } from "@/features/mermaid-editor/lib/file-drop";
import type { FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";

import { browserDroppedFiles, dragEventDropPoint, isExternalFileDrag, type BrowserDroppedFile } from "./use-editor-drop-import";

export type FileOpenSource = "picker" | "recent" | "project" | "drop" | "external" | "restore";

export type UnsavedPromptState = {
  title: string;
  description: string;
  targetName?: string;
  resolve: (choice: UnsavedPromptChoice) => void;
};

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
};

type UseEditorFileWorkflowArgs = {
  runtime: EditorRuntime;
  fileInputRef: RefObject<HTMLInputElement | null>;
  workspaceSurfaceRef: RefObject<HTMLDivElement | null>;
  isDirtyRef: { current: boolean };
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
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  workspaceView: WorkspaceView;
  viewFilters: ViewFilters;
  fileName: string;
  fileTheme: CanvasLayoutTheme | null;
  fileRef: RuntimeFileRef | null;
  recentFiles: RecentFileEntry[];
  projectWorkspace: ProjectWorkspace | null;
  lastSavedDocument: string;
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  preferences: EditorPreferences;
  currentDocument: string;
  canvasLiveState: CanvasLiveState;
  isCanvasEditable: boolean;
  setDocumentKind: StateSetter<DocumentKind>;
  setSource: StateSetter<string>;
  setCanvasDocument: StateSetter<CanvasDocument>;
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
  setFileTheme: StateSetter<CanvasLayoutTheme | null>;
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setProjectWorkspace: StateSetter<ProjectWorkspace | null>;
  setProjectBusy: StateSetter<boolean>;
  setLastSavedDocument: StateSetter<string>;
  setFileMenuOpen: StateSetter<boolean>;
  setFileWorkflowError: StateSetter<FileWorkflowError | null>;
  setUnsavedPrompt: StateSetter<UnsavedPromptState | null>;
  setThemeId: StateSetter<EditorThemeId>;
  setCustomTheme: StateSetter<EditorTheme | null>;
  setPreferences: StateSetter<EditorPreferences>;
  setStatus: StateSetter<string>;
  setFileDropFeedback: StateSetter<FileDropFeedback | null>;
  flushSourceHistory: () => void;
  applyCanvasDocument: (document: CanvasDocument, message?: string) => void;
  applyEditorCommand: (command: EditorCommand) => void;
  recordRecentAction: (type: string, target?: AiRecentAction["target"], summary?: string) => void;
};

export function useEditorFileWorkflow(args: UseEditorFileWorkflowArgs) {
  const {
    runtime,
    fileInputRef,
    workspaceSurfaceRef,
    isDirtyRef,
    documentKind,
    source,
    canvasDocument,
    graph,
    viewport,
    edgeRouting,
    layoutMode,
    diagnostics,
    leftCollapsed,
    rightCollapsed,
    workspaceView,
    viewFilters,
    fileName,
    fileTheme,
    fileRef,
    recentFiles,
    projectWorkspace,
    lastSavedDocument,
    themeId,
    customTheme,
    preferences,
    currentDocument,
    canvasLiveState,
    isCanvasEditable,
    setDocumentKind,
    setSource,
    setCanvasDocument,
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
    setFileTheme,
    setFileRef,
    setRecentFiles,
    setProjectWorkspace,
    setProjectBusy,
    setLastSavedDocument,
    setFileMenuOpen,
    setFileWorkflowError,
    setUnsavedPrompt,
    setThemeId,
    setCustomTheme,
    setPreferences,
    setStatus,
    setFileDropFeedback,
    flushSourceHistory,
    applyCanvasDocument,
    applyEditorCommand,
    recordRecentAction
  } = args;

  const showFileWorkflowError = useCallback((error: unknown, fallbackMessage = "文件操作失败。") => {
    setFileWorkflowError(normalizeFileWorkflowError(error, fallbackMessage));
  }, [setFileWorkflowError]);

  function buildStoredEditorDraft(overrides: StoredEditorDraftOverrides = {}): StoredEditor {
    const draftDocumentKind = overrides.documentKind ?? documentKind;
    const draftSource = overrides.source ?? source;
    const draftCanvasDocument = overrides.canvasDocument ?? canvasDocument;
    const draftGraph = overrides.graph ?? graph;
    const draftViewport = overrides.viewport ?? viewport;
    const draftEdgeRouting = overrides.edgeRouting ?? edgeRouting;
    const draftLayoutMode = overrides.layoutMode ?? layoutMode;
    const draftFileTheme = "fileTheme" in overrides ? overrides.fileTheme : fileTheme;
    const draftFileRef = "fileRef" in overrides ? overrides.fileRef : fileRef;
    const draftThemeId = overrides.themeId ?? themeId;
    const draftCustomTheme = "customTheme" in overrides ? overrides.customTheme : customTheme;
    const draftProjectWorkspace = "projectWorkspace" in overrides ? overrides.projectWorkspace : projectWorkspace;

    return {
      documentKind: draftDocumentKind,
      source: draftDocumentKind === "canvas" ? serializeCanvasDocument(draftCanvasDocument) : draftSource,
      ...(draftDocumentKind === "canvas" ? { canvasDocument: draftCanvasDocument } : {}),
      ...(draftDocumentKind === "mermaid" ? { layout: layoutFromGraph(draftGraph, draftViewport, draftEdgeRouting, draftLayoutMode, draftFileTheme) } : {}),
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
      projectWorkspace: draftProjectWorkspace ?? null,
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
    const nextFileTheme = loaded.fileTheme ?? null;
    const normalizedDocument = buildMermaidDocument(loaded.source, nextGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, nextFileTheme);
    const keepCurrentFile = Boolean(lastSavedDocument?.trim());
    const nextThemeId = normalizeThemeId(nextFileTheme?.themeId);
    const nextCustomTheme = nextFileTheme?.customTheme ? normalizeEditorTheme(nextFileTheme.customTheme) : null;

    await persistStoredEditorDraft({
      source: loaded.source,
      graph: nextGraph,
      viewport: nextViewport,
      edgeRouting: loaded.edgeRouting,
      layoutMode: nextLayoutMode,
      fileTheme: nextFileTheme,
      fileName: keepCurrentFile ? fileName : FALLBACK_FILE_NAME,
      fileRef: keepCurrentFile ? fileRef : null,
      lastSavedDocument: normalizedDocument,
      workspaceView: workspaceViewForDocument(loaded.editableKind, workspaceView, "mermaid"),
      themeId: nextThemeId,
      customTheme: nextCustomTheme
    });
  }

  function requestUnsavedChoice(targetName?: string): Promise<UnsavedPromptChoice> {
    if (!isDirtyRef.current) return Promise.resolve("discard");
    return new Promise((resolve) => {
      setUnsavedPrompt({
        title: "当前文件有未保存修改",
        description: unsavedPromptDescription(targetName),
        targetName,
        resolve
      });
    });
  }

  function resolveUnsavedPrompt(choice: UnsavedPromptChoice) {
    setUnsavedPrompt((current) => {
      current?.resolve(choice);
      return null;
    });
  }

  async function prepareFileSwitch(targetName?: string) {
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(targetName);
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    return saveMermaidFile();
  }

  async function prepareWindowClose() {
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(WINDOW_CLOSE_TARGET_NAME);
    const decision = resolveWindowCloseChoice(choice);

    if (decision.shouldSave) {
      const saved = await saveMermaidFile();
      return resolveWindowCloseChoice(choice, saved).shouldClose;
    }

    if (decision.shouldPersistDiscard) {
      try {
        await persistDiscardedCloseDraft();
      } catch {
        // Closing should not be blocked by best-effort draft cleanup.
      }
    }

    return decision.shouldClose;
  }

  function applyLoadedDocument(text: string, name: string, file: RuntimeFileRef | null, source: FileOpenSource = "picker") {
    flushSourceHistory();
    const nextDocumentKind = documentKindFromPath(file?.path || name) || "mermaid";
    if (nextDocumentKind === "canvas") {
      let nextCanvasDocument = createBlankCanvasDocument();
      try {
        nextCanvasDocument = parseCanvasDocument(text);
      } catch (error) {
        showFileWorkflowError({ code: "read_failed", message: `画布 JSON 解析失败：${readableError(error)}`, path: file?.path }, "打开画布失败。");
        return;
      }
      const savedDocument = serializeCanvasDocument(nextCanvasDocument);

      setDocumentKind("canvas");
      setSource(savedDocument);
      setCanvasDocument(nextCanvasDocument);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(nextCanvasDocument.viewport);
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setWorkspaceView("canvas");
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(ensureEditorDocumentFileName(name, "canvas"));
      setFileTheme(null);
      setFileRef(file);
      setLastSavedDocument(savedDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, file));
      setFileWorkflowError(null);
      setStatus(`已打开 ${name}。`);
      recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
      if (source !== "restore") void syncWorkspaceForOpenedFile(file);
      return;
    }

    if (nextDocumentKind === "markdown") {
      const savedDocument = text;

      setDocumentKind("markdown");
      setSource(text);
      setCanvasDocument(createBlankCanvasDocument());
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport({ x: 160, y: 90, scale: 1 });
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setWorkspaceView("markdown");
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(ensureEditorDocumentFileName(name, "markdown"));
      setFileTheme(null);
      setFileRef(file);
      setLastSavedDocument(savedDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, file));
      setFileWorkflowError(null);
      setStatus(`已打开 ${name}。`);
      recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
      if (source !== "restore") void syncWorkspaceForOpenedFile(file);
      return;
    }

    const loaded = loadMermaidDocument(text);
    const nextViewport = loaded.viewport || { x: 160, y: 90, scale: 1 };
    const nextLayoutMode = loaded.layoutMode;
    const loadedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(loaded.graph) : loaded.graph;
    const nextThemeId = normalizeThemeId(loaded.fileTheme?.themeId ?? themeId);
    const nextCustomTheme = loaded.fileTheme?.customTheme ? normalizeEditorTheme(loaded.fileTheme.customTheme) : customTheme;
    const savedDocument = buildMermaidDocument(loaded.source, loadedGraph, nextViewport, loaded.edgeRouting, nextLayoutMode, loaded.fileTheme ?? null);

    setDocumentKind("mermaid");
    setSource(loaded.source);
    setCanvasDocument(createBlankCanvasDocument());
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
    setFileTheme(loaded.fileTheme ?? null);
    setThemeId(nextThemeId);
    setCustomTheme(nextCustomTheme);
    setFileRef(file);
    setLastSavedDocument(savedDocument);
    isDirtyRef.current = false;
    setRecentFiles((current) => upsertRecentFile(current, file));
    setFileWorkflowError(null);
    setStatus(loaded.editableKind === "flowchart" ? `已打开 ${name}。` : `已打开 ${name}，当前类型仅渲染。`);
    recordRecentAction(source === "restore" ? "document.restore" : "document.open", { kind: "document" }, `打开 ${name}。`);
    if (source !== "restore") void syncWorkspaceForOpenedFile(file);
  }

  async function syncWorkspaceForOpenedFile(file: RuntimeFileRef | null, options: { announce?: boolean; revealExplorer?: boolean } = {}) {
    if (runtime.kind !== "desktop" || !file?.path) return;

    const revealExplorer = options.revealExplorer ?? true;
    const rootPath = workspaceRootForOpenedFile(file.path, projectWorkspace);
    if (!rootPath) {
      if (projectWorkspace && revealExplorer) setLeftCollapsed(false);
      return;
    }

    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status !== "opened") return;
      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "同步文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      if (revealExplorer) setLeftCollapsed(false);
      if (options.announce ?? true) setStatus(`已显示 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "同步文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  function applyStoredEditorState(stored: StoredEditor): StoredEditorApplyResult {
    flushSourceHistory();
    const storedDocumentKind = normalizeStoredDocumentKind(stored.documentKind, stored.fileName, stored.fileRef?.path);
    if (storedDocumentKind === "canvas") {
      const nextPreferences = normalizeEditorPreferences(stored.preferences);
      const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
      const nextCanvasDocument = canvasDocumentFromStored(stored);
      const nextSource = serializeCanvasDocument(nextCanvasDocument);
      const nextFileName = ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_CANVAS_FILE_NAME, "canvas");

      setDocumentKind("canvas");
      setSource(nextSource);
      setCanvasDocument(nextCanvasDocument);
      setGraph(createEmptyDocumentGraph());
      setDiagramType("unknown");
      setEditableKind("render-only");
      setViewport(nextCanvasDocument.viewport);
      setEdgeRouting(DEFAULT_EDGE_ROUTING);
      setLayoutMode(DEFAULT_LAYOUT_MODE);
      setLeftCollapsed(shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: nextPreferences.startWithPanelsCollapsed,
        storedCollapsed: stored.leftCollapsed,
        projectWorkspace: nextProjectWorkspace,
        recentFiles: nextRecentFiles,
        fileRef: stored.fileRef || null,
        fileName: nextFileName,
        fallbackFileName: FALLBACK_CANVAS_FILE_NAME
      }));
      setRightCollapsed(true);
      setWorkspaceView("canvas");
      setViewFilters(nextViewFilters);
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(stored.fileRef || null);
      setRecentFiles(nextRecentFiles);
      setProjectWorkspace(nextProjectWorkspace);
      setLastSavedDocument(stored.lastSavedDocument || "");
      isDirtyRef.current = !stored.lastSavedDocument || nextSource !== stored.lastSavedDocument;
      setFileTheme(null);
      setThemeId(normalizeThemeId(stored.themeId));
      setCustomTheme(stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null);
      setPreferences(nextPreferences);
      setFileWorkflowError(null);

      return {
        documentKind: "canvas",
        currentDocument: nextSource,
        fileRef: stored.fileRef || null,
        lastSavedDocument: stored.lastSavedDocument || "",
        preferences: nextPreferences
      };
    }

    if (storedDocumentKind === "markdown") {
      const nextPreferences = normalizeEditorPreferences(stored.preferences);
      const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
      const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
      const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
      const nextSource = stored.source || BLANK_MARKDOWN_SOURCE;
      const nextFileName = ensureEditorDocumentFileName(stored.fileName || stored.fileRef?.name || FALLBACK_MARKDOWN_FILE_NAME, "markdown");

      setDocumentKind("markdown");
      setSource(nextSource);
      setCanvasDocument(createBlankCanvasDocument());
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
        fallbackFileName: FALLBACK_MARKDOWN_FILE_NAME
      }));
      setRightCollapsed(nextPreferences.startWithPanelsCollapsed ? true : stored.rightCollapsed || false);
      setWorkspaceView(workspaceViewForDocument("render-only", stored.workspaceView, "markdown"));
      setViewFilters(nextViewFilters);
      setSelection(createEmptyDocumentSelection());
      setDiagnostics([]);
      setHistory(createHistory());
      setFileName(nextFileName);
      setFileRef(stored.fileRef || null);
      setRecentFiles(nextRecentFiles);
      setProjectWorkspace(nextProjectWorkspace);
      setLastSavedDocument(stored.lastSavedDocument || "");
      isDirtyRef.current = !stored.lastSavedDocument || nextSource !== stored.lastSavedDocument;
      setFileTheme(null);
      setThemeId(normalizeThemeId(stored.themeId));
      setCustomTheme(stored.customTheme ? normalizeEditorTheme(stored.customTheme) : null);
      setPreferences(nextPreferences);
      setFileWorkflowError(null);

      return {
        documentKind: "markdown",
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
    const resolvedGraph = loaded.editableKind === "flowchart" && nextLayoutMode === "auto" ? applyDagreAutoLayout(nextGraph) : nextGraph;
    const nextFileTheme = layout?.theme ?? loaded.fileTheme ?? null;
    const nextThemeId = normalizeThemeId(nextFileTheme?.themeId ?? stored.themeId);
    const nextCustomTheme = nextFileTheme?.customTheme
      ? normalizeEditorTheme(nextFileTheme.customTheme)
      : stored.customTheme
        ? normalizeEditorTheme(stored.customTheme)
        : null;
    const nextPreferences = normalizeEditorPreferences(stored.preferences);
    const nextViewFilters = normalizeViewFilters(stored.viewFilters, { showGrid: stored.showGrid, showEdges: stored.showEdges });
    const nextProjectWorkspace = normalizeProjectWorkspace(stored.projectWorkspace);
    const nextRecentFiles = normalizeRecentFiles(stored.recentFiles);
    const currentStoredDocument = buildMermaidDocument(loaded.source, resolvedGraph, nextViewport, nextEdgeRouting, nextLayoutMode, nextFileTheme);

    setDocumentKind("mermaid");
    setSource(loaded.source);
    setCanvasDocument(createBlankCanvasDocument());
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
    setLastSavedDocument(stored.lastSavedDocument || "");
    isDirtyRef.current = !stored.lastSavedDocument || currentStoredDocument !== stored.lastSavedDocument;
    setFileTheme(nextFileTheme);
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

  async function openMermaidFile() {
    try {
      const result = await runtime.openFile();
      if (result.status === "fallback") {
        fileInputRef.current?.click();
        return;
      }
      if (result.status === "cancelled") return;
      if (!(await prepareFileSwitch(result.file.name))) return;
      applyLoadedDocument(result.text, result.file.name, result.file);
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function newMermaidFile() {
    if (!(await prepareFileSwitch(FALLBACK_FILE_NAME))) return;

    flushSourceHistory();
    const nextGraph = parseMermaid(BLANK_FLOWCHART_SOURCE);
    const nextSource = serializeMermaid(nextGraph);
    const nextViewport = { x: 160, y: 90, scale: 1 };

    setDocumentKind("mermaid");
    setSource(nextSource);
    setCanvasDocument(createBlankCanvasDocument());
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
    setFileTheme(null);
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
        fileTheme: null,
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

    setDocumentKind("markdown");
    setSource(BLANK_MARKDOWN_SOURCE);
    setCanvasDocument(createBlankCanvasDocument());
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
    setFileTheme(null);
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
        fileTheme: null,
        fileName: FALLBACK_MARKDOWN_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "markdown"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  async function newCanvasFile() {
    if (!(await prepareFileSwitch(FALLBACK_CANVAS_FILE_NAME))) return;

    flushSourceHistory();
    const nextCanvasDocument = createBlankCanvasDocument();
    const nextSource = serializeCanvasDocument(nextCanvasDocument);

    setDocumentKind("canvas");
    setSource(nextSource);
    setCanvasDocument(nextCanvasDocument);
    setGraph(createEmptyDocumentGraph());
    setDiagramType("unknown");
    setEditableKind("render-only");
    setViewport(nextCanvasDocument.viewport);
    setEdgeRouting(DEFAULT_EDGE_ROUTING);
    setLayoutMode(DEFAULT_LAYOUT_MODE);
    setWorkspaceView("canvas");
    setViewFilters(DEFAULT_VIEW_FILTERS);
    setSelection(createEmptyDocumentSelection());
    setDiagnostics([]);
    setHistory(createHistory());
    setFileName(FALLBACK_CANVAS_FILE_NAME);
    setFileRef(null);
    setFileTheme(null);
    setLastSavedDocument("");
    isDirtyRef.current = true;
    setFileWorkflowError(null);
    setStatus("已新建空白无限画布文件。");
    recordRecentAction("document.new", { kind: "document" }, "新建空白无限画布文件。");

    try {
      await persistStoredEditorDraft({
        documentKind: "canvas",
        source: nextSource,
        canvasDocument: nextCanvasDocument,
        graph: createEmptyDocumentGraph(),
        viewport: nextCanvasDocument.viewport,
        edgeRouting: DEFAULT_EDGE_ROUTING,
        layoutMode: DEFAULT_LAYOUT_MODE,
        fileTheme: null,
        fileName: FALLBACK_CANVAS_FILE_NAME,
        fileRef: null,
        lastSavedDocument: "",
        workspaceView: "canvas"
      });
    } catch {
      // New document state is already applied; draft persistence is best-effort.
    }
  }

  async function openFallbackFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      if (!(await prepareFileSwitch(file.name))) return;
      applyLoadedDocument(await file.text(), file.name, { name: file.name });
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openRuntimeFileRequest(file: RuntimeFileOpenRequest, source: FileOpenSource) {
    if (!isSupportedDocumentFilePath(file.path)) {
      showFileWorkflowError({ code: "unsupported_type", path: file.path }, "文件类型不支持。");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      const result = await runtime.openFilePath(file.path);
      if (result.status !== "opened") return;
      applyLoadedDocument(result.text, result.file.name, result.file, source);
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function openProjectFolder() {
    setProjectBusy(true);
    try {
      const result = await runtime.openProjectFolder();
      if (result.status === "cancelled") return;
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message }, "工作区文件夹不可用。");
        return;
      }

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。" }, "打开工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setLeftCollapsed(false);
      setStatus(`已打开工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "打开工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function refreshProjectWorkspace(rootPath = projectWorkspace?.rootPath) {
    if (!rootPath) return;
    setProjectBusy(true);
    try {
      const result = await runtime.readProjectFolder(rootPath);
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }
      if (result.status === "cancelled") return;

      const workspace = normalizeProjectWorkspace(result.workspace);
      if (!workspace) {
        showFileWorkflowError({ code: "read_failed", message: "工作区文件夹扫描结果无效。", path: rootPath }, "刷新工作区文件夹失败。");
        return;
      }

      setProjectWorkspace(workspace);
      setStatus(`已刷新工作区 ${workspace.rootName}，发现 ${workspace.files.length} 个项目文档。`);
      try {
        await persistStoredEditorDraft({ projectWorkspace: workspace });
      } catch {
        // Project scanning succeeded; draft persistence is best-effort.
      }
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "刷新工作区文件夹失败。");
    } finally {
      setProjectBusy(false);
    }
  }

  async function closeProjectWorkspace() {
    setProjectWorkspace(null);
    setStatus("已关闭工作区文件夹。");
    try {
      await persistStoredEditorDraft({ projectWorkspace: null });
    } catch {
      // Closing a project only affects draft metadata.
    }
  }

  function windowPointToWorkspacePoint(point: DropPoint | undefined): DropPoint | undefined {
    const surface = workspaceSurfaceRef.current;
    if (!surface || !point) return undefined;
    return windowPointToSurfacePoint(point, surface.getBoundingClientRect());
  }

  function windowPointToCanvasWorldPoint(point: DropPoint | undefined): DropPoint | undefined {
    const workspacePoint = windowPointToWorkspacePoint(point);
    if (!workspacePoint) return undefined;
    return canvasScreenToWorldPoint(workspacePoint, viewport);
  }

  function dropFeedbackForFiles(files: FileDropCandidate[], position?: DropPoint): FileDropFeedback {
    const localPosition = windowPointToWorkspacePoint(position);
    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      return { message: `释放以打开 ${documentKindLabel(classification.documentKind)} 文件`, tone: "ready", position: localPosition };
    }
    if (classification.kind === "image") {
      if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
        return { message: "请切换到无限画布后拖入图片", tone: "blocked", position: localPosition };
      }
      return {
        message: fileRef?.path ? "释放以添加图片节点" : "释放后先保存文档再添加图片",
        tone: "ready",
        position: localPosition
      };
    }
    return { message: "不支持的文件类型", tone: "blocked", position: localPosition };
  }

  function updateBrowserFileDragFeedback(event: React.DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    if (files.length) {
      setFileDropFeedback(dropFeedbackForFiles(files, position));
      return;
    }
    setFileDropFeedback((current) =>
      current
        ? { ...current, position: windowPointToWorkspacePoint(position) || current.position }
        : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(position) }
    );
  }

  function handleBrowserFileDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setFileDropFeedback(null);
  }

  function handleBrowserFileDrop(event: React.DragEvent<HTMLElement>) {
    if (!isExternalFileDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    const position = dragEventDropPoint(event);
    const files = browserDroppedFiles(event.dataTransfer);
    setFileDropFeedback(null);
    void handleBrowserDroppedFiles(files, position);
  }

  async function ensureDocumentFileForImageImport(): Promise<RuntimeFileRef | null> {
    if (fileRef?.path) return fileRef;
    const savedFile = await saveMermaidFileAsResult();
    if (savedFile?.path) return savedFile;
    if (savedFile && !savedFile.path) {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "网页版下载保存后没有稳定文件路径，无法复制本地图片资源。请使用桌面版保存到磁盘文件后再拖入图片。"
        },
        "无法导入图片。"
      );
    }
    return null;
  }

  async function handleBrowserDroppedFiles(files: BrowserDroppedFile[], dropPosition?: DropPoint) {
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
      await openBrowserDroppedDocumentFile(classification.file);
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      await importBrowserDroppedImageAsset(classification.file, dropPosition);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path || classification.file?.name }, "文件类型不支持。");
  }

  async function openBrowserDroppedDocumentFile(file: BrowserDroppedFile) {
    const identity = file.path || file.name;
    if (!isSupportedDocumentFilePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return;
    }
    if (file.path) {
      await openRuntimeFileRequest({ name: file.name, path: file.path }, "drop");
      return;
    }
    if (!(await prepareFileSwitch(file.name))) return;

    try {
      applyLoadedDocument(await file.file.text(), file.name, { name: file.name }, "drop");
    } catch (error) {
      showFileWorkflowError(error, "打开文件失败。");
    }
  }

  async function importBrowserDroppedImageAsset(file: BrowserDroppedFile, dropPosition?: DropPoint) {
    const identity = file.path || file.name;
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: identity
        },
        "无法导入图片。"
      );
      return;
    }
    if (!isSupportedImagePath(identity)) {
      showFileWorkflowError({ code: "unsupported_type", path: identity }, "文件类型不支持。");
      return;
    }

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = file.path ? await runtime.importImageAssetPath(targetFile, file.path) : await runtime.importImageAssetFile(targetFile, file.file);
      await applyImportedImageAssetResult(result, identity, dropPosition);
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
  }

  async function applyImportedImageAssetResult(result: RuntimeImageAssetResult, sourcePath: string, dropPosition?: DropPoint) {
    if (result.status !== "ready") {
      if (result.status === "unsupported") {
        showFileWorkflowError({ code: "unsupported_type", message: result.message, path: sourcePath }, "文件类型不支持。");
      }
      if (result.status === "needs-document") {
        showFileWorkflowError({ code: "unsupported_type", message: "请先保存当前文档，再拖入本地图片。", path: sourcePath }, "无法导入图片。");
      }
      return;
    }

    const dimensions = await loadImageDimensions(result.displaySrc);
    const point = windowPointToCanvasWorldPoint(dropPosition) || viewportCenterPoint(viewport, canvasLiveState.canvasSize);
    if (documentKind === "canvas") {
      const element = createCanvasImageElement(
        canvasDocument.elements,
        point.x - dimensions.width / 2,
        point.y - dimensions.height / 2,
        result.src,
        dimensions.width,
        dimensions.height
      );
      applyCanvasDocument({ ...canvasDocument, elements: [...canvasDocument.elements, element] }, result.copied ? "已复制并添加拖入的图片。" : "已添加拖入的图片。");
      return;
    }
    applyEditorCommand({
      type: "graph.addImageNodeAt",
      point,
      asset: createImageAsset({
        src: result.src,
        width: dimensions.width,
        height: dimensions.height,
        preserveAspectRatio: true,
        labelPosition: "bottom"
      }),
      label: imageLabelFromSrc(result.src),
      message: result.copied ? "已复制并添加拖入的图片节点。" : "已添加拖入的图片节点。",
      source: "api"
    });
  }

  async function importImageAssetRequest(file: RuntimeFileOpenRequest, dropPosition?: DropPoint) {
    if ((!isCanvasEditable && documentKind !== "canvas") || workspaceView !== "canvas") {
      showFileWorkflowError(
        {
          code: "unsupported_type",
          message: "请切换到无限画布后拖入图片。",
          path: file.path
        },
        "无法导入图片。"
      );
      return;
    }
    if (!isSupportedImagePath(file.path)) {
      showFileWorkflowError({ code: "unsupported_type", path: file.path }, "文件类型不支持。");
      return;
    }

    const targetFile = await ensureDocumentFileForImageImport();
    if (!targetFile?.path) {
      setStatus("已取消图片导入。");
      return;
    }

    try {
      const result = await runtime.importImageAssetPath(targetFile, file.path);
      await applyImportedImageAssetResult(result, file.path, dropPosition);
    } catch (error) {
      showFileWorkflowError(error, "导入图片失败。");
    }
  }

  function handleRuntimeFileDropRequest(request: RuntimeFileDropRequest) {
    if (request.type === "leave") {
      setFileDropFeedback(null);
      return;
    }

    if (request.type === "enter" || request.type === "over") {
      if (request.files.length) {
        setFileDropFeedback(dropFeedbackForFiles(request.files, request.position));
        return;
      }
      setFileDropFeedback((current) =>
        current
          ? { ...current, position: windowPointToWorkspacePoint(request.position) || current.position }
          : { message: "释放以导入文件", tone: "ready", position: windowPointToWorkspacePoint(request.position) }
      );
      return;
    }

    setFileDropFeedback(null);
    const files = request.files;
    if (!files.length) return;

    const classification = classifyFileDrop(files);
    if (classification.kind === "document") {
      if (files.length > 1) setStatus(`已使用拖拽的第一个 ${documentKindLabel(classification.documentKind)} 文件。`);
      void openRuntimeFileRequest(classification.file, "drop");
      return;
    }

    if (classification.kind === "image") {
      if (files.length > 1) setStatus("已使用拖拽的第一张图片。");
      void importImageAssetRequest(classification.file, request.position);
      return;
    }

    showFileWorkflowError({ code: "unsupported_type", path: classification.file?.path }, "文件类型不支持。");
  }

  async function openRecentFile(file: RecentFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "recent");
  }

  async function openProjectFile(file: ProjectFileEntry) {
    setFileMenuOpen(false);
    await openRuntimeFileRequest(file, "project");
  }

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileRef) {
      return saveMermaidFileAs();
    }
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要保存吗？")) return false;

    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName, documentKind);
      if (result.status === "cancelled") return false;
      const savedName = ensureEditorDocumentFileName(result.file.name, documentKind);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileRef(result.file);
      setFileName(savedName);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(`已保存 ${result.file.name}。`);
      recordRecentAction("document.save", { kind: "document" }, `保存 ${result.file.name}。`);
      try {
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return true;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function saveMermaidFileAsResult(): Promise<RuntimeFileRef | null> {
    flushSourceHistory();
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要另存为吗？")) return null;
    const suggestedName = ensureEditorDocumentFileName(fileName, documentKind);
    try {
      const result = await runtime.saveFileAs(currentDocument, suggestedName, documentKind);
      if (result.status === "cancelled") return null;
      const savedName = ensureEditorDocumentFileName(result.file.name || suggestedName, documentKind);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileName(savedName);
      setFileRef(result.file);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(result.downloaded ? `已下载 ${result.file.name || suggestedName}。` : `已保存 ${result.file.name || suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, result.downloaded ? `下载 ${result.file.name || suggestedName}。` : `另存为 ${result.file.name || suggestedName}。`);
      try {
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return result.file;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return null;
    }
  }

  async function saveMermaidFileAs() {
    return Boolean(await saveMermaidFileAsResult());
  }

  return {
    showFileWorkflowError,
    resolveUnsavedPrompt,
    prepareWindowClose,
    applyLoadedDocument,
    applyStoredEditorState,
    openMermaidFile,
    newMermaidFile,
    newMarkdownFile,
    newCanvasFile,
    openFallbackFile,
    openRuntimeFileRequest,
    openProjectFolder,
    refreshProjectWorkspace,
    closeProjectWorkspace,
    updateBrowserFileDragFeedback,
    handleBrowserFileDragLeave,
    handleBrowserFileDrop,
    importImageAssetRequest,
    handleRuntimeFileDropRequest,
    openRecentFile,
    openProjectFile,
    saveMermaidFile,
    saveMermaidFileAs,
    saveMermaidFileAsResult
  };
}

function createEmptyDocumentSelection(): Selection {
  return { nodeIds: [], edgeIds: [], subgraphIds: [], primaryId: undefined };
}

function isAbortError(error: unknown) {
  return isRuntimeAbortError(error);
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

function imageLabelFromSrc(src: string) {
  return src.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.[^.]+$/, "") || "图片";
}

function viewportCenterPoint(viewport: ViewportState, canvasSize?: AiCanvasSize) {
  const width = canvasSize?.width || 840;
  const height = canvasSize?.height || 520;
  return {
    x: (width / 2 - viewport.x) / viewport.scale,
    y: (height / 2 - viewport.y) / viewport.scale
  };
}

async function loadImageDimensions(src: string) {
  if (typeof window === "undefined" || !src) return { width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT };

  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => {
      const width = image.naturalWidth || DEFAULT_IMAGE_ASSET_WIDTH;
      const height = image.naturalHeight || DEFAULT_IMAGE_ASSET_HEIGHT;
      const maxSide = Math.max(width, height, 1);
      const scale = maxSide > 360 ? 360 / maxSide : 1;
      resolve({
        width: Math.max(48, Math.round(width * scale)),
        height: Math.max(48, Math.round(height * scale))
      });
    };
    image.onerror = () => resolve({ width: DEFAULT_IMAGE_ASSET_WIDTH, height: DEFAULT_IMAGE_ASSET_HEIGHT });
    image.src = src;
  });
}
