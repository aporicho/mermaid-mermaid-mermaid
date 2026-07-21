import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";

import type { AiCanvasSize, AiRecentAction } from "@/features/mermaid-editor/lib/ai-context";
import type { CanvasDocument } from "@/features/mermaid-editor/lib/canvas-document";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { EditorTheme, EditorThemeId } from "@/features/mermaid-editor/lib/editor-theme";
import type { RuntimeFileOpenRequest, RuntimeFileRef, EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { FileWorkflowError, RecentFileEntry } from "@/features/mermaid-editor/lib/file-workflow";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type { StoredExplorerTreeState } from "@/features/mermaid-editor/lib/explorer-tree-state";
import type {
  DiagramType,
  EdgeRouting,
  EditableKind,
  EditorHistory,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { WorkspaceView } from "@/features/mermaid-editor/lib/workspace-view";
import type { FileDropFeedback } from "@/features/mermaid-editor/components/file-workflow-feedback";
import type { UnsavedPromptChoice } from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { NodeGeometrySpec } from "@/features/mermaid-editor/lib/node-geometry";

export type FileOpenSource = "picker" | "recent" | "project" | "drop" | "external" | "restore";

export type UnsavedPromptState = {
  title: string;
  description: string;
  targetName?: string;
  resolve: (choice: UnsavedPromptChoice) => void;
};

export type StateSetter<T> = Dispatch<SetStateAction<T>>;

export type CanvasLiveState = {
  canvasSize?: AiCanvasSize;
};

export type UseEditorFileWorkflowArgs = {
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
  fileRef: RuntimeFileRef | null;
  recentFiles: RecentFileEntry[];
  projectWorkspace: ProjectWorkspace | null;
  explorerTreeState: StoredExplorerTreeState;
  lastSavedDocument: string;
  documentGenerationRef: MutableRefObject<number>;
  themeId: EditorThemeId;
  customTheme: EditorTheme | null;
  preferences: EditorPreferences;
  currentDocument: string;
  canvasLiveState: CanvasLiveState;
  isCanvasEditable: boolean;
  nodeGeometrySpec: NodeGeometrySpec;
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
  setFileRef: StateSetter<RuntimeFileRef | null>;
  setRecentFiles: StateSetter<RecentFileEntry[]>;
  setProjectWorkspace: StateSetter<ProjectWorkspace | null>;
  setExplorerTreeState: StateSetter<StoredExplorerTreeState>;
  setProjectBusy: StateSetter<boolean>;
  setLastSavedDocument: StateSetter<string>;
  beginDocumentSession: () => void;
  setFileMenuOpen: StateSetter<boolean>;
  setFileWorkflowError: StateSetter<FileWorkflowError | null>;
  setUnsavedPrompt: StateSetter<UnsavedPromptState | null>;
  setThemeId: StateSetter<EditorThemeId>;
  setCustomTheme: StateSetter<EditorTheme | null>;
  setPreferences: StateSetter<EditorPreferences>;
  setStatus: StateSetter<string>;
  setFileDropFeedback: StateSetter<FileDropFeedback | null>;
  flushSourceHistory: () => void;
  flushLinkedFileWrites?: (options?: { overwriteConflicts?: boolean }) => Promise<boolean>;
  discardLinkedFileWrites?: () => Promise<void>;
  applyCanvasDocument: (document: CanvasDocument, message?: string) => void;
  applyEditorCommand: (command: EditorCommand) => void;
  recordRecentAction: (type: string, target?: AiRecentAction["target"], summary?: string) => void;
};

export type ApplyLoadedDocument = (
  text: string,
  name: string,
  file: RuntimeFileRef | null,
  source?: FileOpenSource
) => void;

export type ShowFileWorkflowError = (error: unknown, fallbackMessage?: string) => void;

export type SyncWorkspaceForOpenedFile = (
  file: RuntimeFileRef | null,
  options?: { announce?: boolean; revealExplorer?: boolean }
) => Promise<void>;

export type PrepareFileSwitch = (targetName?: string) => Promise<boolean>;

export type OpenRuntimeFileRequest = (
  file: RuntimeFileOpenRequest,
  source: FileOpenSource
) => Promise<void>;
