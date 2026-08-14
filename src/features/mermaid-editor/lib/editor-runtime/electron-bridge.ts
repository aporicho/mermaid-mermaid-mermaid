import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { ElectronAgentBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-agent-bridge";
import type { ElectronEmbeddedBrowserBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-embedded-browser-bridge";
import type {
  EditorDraftState,
  RuntimeFileDropRequest,
  RuntimeFileOpenRequest,
  RuntimeImageAssetContext,
  RuntimeLinkPreviewRequest,
  RuntimeLinkPreviewResult,
  RuntimeSystemMemoryInfo,
  RuntimeSystemFont,
  RuntimeTerminalDataEvent,
  RuntimeTerminalExitEvent,
  RuntimeTerminalOpenResult,
  RuntimeTerminalShellOption
} from "@/features/mermaid-editor/lib/editor-runtime/types";
import type { RuntimeDesktopWindowAction } from "@/features/mermaid-editor/lib/editor-runtime/desktop-window-types";
import type { ElectronMonitoringBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-monitoring-bridge-types";
import type {
  RuntimeCreateProjectDirectoryRequest,
  RuntimeCreateProjectDirectoryResult,
  RuntimeCreateProjectFileRequest,
  RuntimeCreateProjectFileResult,
  RuntimeDeleteProjectResourcesRequest,
  RuntimeDeleteProjectResourcesResult,
  RuntimeImportProjectResourcesRequest,
  RuntimeMoveProjectFileRequest,
  RuntimeMoveProjectFileResult,
  RuntimeProjectResourceMutationRequest,
  RuntimeProjectResourceMutationResult,
  RuntimeReorderProjectResourcesRequest,
  RuntimeReorderProjectResourcesResult,
  RuntimeRenameProjectResourceRequest,
  RuntimeRenameProjectResourceResult,
  RuntimeShowProjectResourceRequest,
  RuntimeShowProjectResourceResult
} from "@/features/mermaid-editor/lib/editor-runtime/project-file-types";
import type { ElectronMarkdownFoldBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-fold";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  RuntimeCreateProjectTextFileResult,
  RuntimeCsvFileSnapshot,
  RuntimeWriteCsvFileResult
} from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";
import type { EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { RuntimeDocumentFormat } from "@/features/mermaid-editor/lib/editor-runtime/document-hub-types";
import type { RuntimeMarkdownExportRequest, RuntimeMarkdownExportResult } from "@/features/mermaid-editor/lib/editor-runtime/markdown-export-types";
import type {
  ElectronDocumentHubBridge,
  ElectronSavedFile
} from "@/features/mermaid-editor/lib/editor-runtime/electron-document-hub-bridge";

export type ElectronCreateProjectDocumentResult =
  | { status: "created"; file: ElectronSavedFile; text: string }
  | { status: "exists"; file: ElectronSavedFile };

export type ElectronImageAsset = {
  src: string;
  displaySrc: string;
  path: string;
  copied?: boolean;
};

export type ElectronBridge = ElectronMarkdownFoldBridge & ElectronMonitoringBridge & ElectronAgentBridge & ElectronEmbeddedBrowserBridge & ElectronDocumentHubBridge & {
  host: "electron";
  openExternalUrl: (url: string) => Promise<void>;
  startWindowDrag: () => Promise<void>;
  toggleWindowMaximize: () => Promise<void>;
  runWindowAction: (action: RuntimeDesktopWindowAction) => Promise<void>;
  onDesktopWindowCloseRequest: (handler: () => boolean | Promise<boolean>) => () => void;
  readAppState: () => Promise<EditorDraftState | null>;
  listSystemFonts: () => Promise<RuntimeSystemFont[]>;
  readSystemMemoryInfo: () => Promise<RuntimeSystemMemoryInfo>;
  readClipboardText: () => Promise<string>; writeClipboardText: (text: string) => Promise<void>;
  writeAppState: (state: EditorDraftState) => Promise<void>;
  readEditorSession: () => Promise<EditorDocumentSession | null>;
  writeEditorSession: (session: EditorDocumentSession) => Promise<void>;
  createProjectDocument: (request: {
    rootPath: string;
    fileName: string;
    documentKind: DocumentKind;
    text: string;
  }) => Promise<ElectronCreateProjectDocumentResult>;
  createProjectTextFile: (request: { rootPath: string; fileName: string; kind: "csv" | "text"; text: string }) => Promise<RuntimeCreateProjectTextFileResult>;
  createProjectFile: (request: RuntimeCreateProjectFileRequest) => Promise<RuntimeCreateProjectFileResult>;
  moveProjectFile: (request: RuntimeMoveProjectFileRequest) => Promise<RuntimeMoveProjectFileResult>;
  createProjectDirectory: (request: RuntimeCreateProjectDirectoryRequest) => Promise<RuntimeCreateProjectDirectoryResult>;
  renameProjectResource: (request: RuntimeRenameProjectResourceRequest) => Promise<RuntimeRenameProjectResourceResult>;
  moveProjectResources: (request: RuntimeProjectResourceMutationRequest) => Promise<RuntimeProjectResourceMutationResult>;
  reorderProjectResources: (request: RuntimeReorderProjectResourcesRequest) => Promise<RuntimeReorderProjectResourcesResult>;
  copyProjectResources: (request: RuntimeProjectResourceMutationRequest) => Promise<RuntimeProjectResourceMutationResult>;
  importProjectResources: (request: RuntimeImportProjectResourcesRequest) => Promise<RuntimeProjectResourceMutationResult>;
  deleteProjectResources: (request: RuntimeDeleteProjectResourcesRequest) => Promise<RuntimeDeleteProjectResourcesResult>;
  showProjectResourceInFileManager: (request: RuntimeShowProjectResourceRequest) => Promise<RuntimeShowProjectResourceResult>;
  readCsvFile: (request: { rootPath: string; path: string }) => Promise<RuntimeCsvFileSnapshot>;
  writeCsvFile: (request: { rootPath: string; path: string; text: string; expectedRevision: string; format?: RuntimeDocumentFormat }) => Promise<RuntimeWriteCsvFileResult>;
  pickImageAsset: (documentPath: string | null, context?: RuntimeImageAssetContext) => Promise<ElectronImageAsset | null>;
  importImageAssetPath: (documentPath: string, imagePath: string, context?: RuntimeImageAssetContext) => Promise<ElectronImageAsset>;
  importImageAssetBytes: (documentPath: string, fileName: string, bytes: number[], context?: RuntimeImageAssetContext) => Promise<ElectronImageAsset>;
  importImageAssetFile?: (documentPath: string, image: File, context?: RuntimeImageAssetContext) => Promise<ElectronImageAsset>;
  resolveImageAssetSrc: (documentPath: string | null, src: string, context?: RuntimeImageAssetContext) => Promise<string>;
  exportMarkdownFolder: (request: RuntimeMarkdownExportRequest) => Promise<RuntimeMarkdownExportResult>;
  resolveLinkPreview: (request: RuntimeLinkPreviewRequest) => Promise<RuntimeLinkPreviewResult>;
  takePendingOpenFiles: () => Promise<RuntimeFileOpenRequest[]>;
  onExternalFileOpen: (handler: (files: RuntimeFileOpenRequest[]) => void) => () => void;
  onFileDrops: (handler: (request: RuntimeFileDropRequest) => void) => () => void;
  listTerminalShells: () => Promise<RuntimeTerminalShellOption[]>;
  openTerminal: (request: { cwd?: string; shellId?: string; cols: number; rows: number }) => Promise<RuntimeTerminalOpenResult>;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (sessionId: string) => Promise<void>;
  onTerminalData: (handler: (event: RuntimeTerminalDataEvent) => void) => () => void;
  onTerminalExit: (handler: (event: RuntimeTerminalExitEvent) => void) => () => void;
  openProjectFolder: () => Promise<ProjectWorkspace | null>;
  readProjectFolder: (rootPath: string) => Promise<ProjectWorkspace>;
};

declare global {
  interface Window {
    mmmElectron?: ElectronBridge;
  }
}

export function isElectronRuntime() {
  return typeof window !== "undefined" && window.mmmElectron?.host === "electron";
}

export function getElectronBridge() {
  return isElectronRuntime() ? window.mmmElectron ?? null : null;
}
