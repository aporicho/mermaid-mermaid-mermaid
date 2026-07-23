import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { ElectronAgentBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-agent-bridge";
import type { ElectronEmbeddedBrowserBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-embedded-browser-bridge";
import type {
  EditorDraftState,
  RuntimeFileDropRequest,
  RuntimeFileOpenRequest,
  RuntimeLinkPreviewRequest,
  RuntimeLinkPreviewResult,
  RuntimeSystemFont,
  RuntimeTerminalDataEvent,
  RuntimeTerminalExitEvent,
  RuntimeTerminalOpenResult,
  RuntimeTerminalShellOption
} from "@/features/mermaid-editor/lib/editor-runtime/types";
import type { RuntimeDesktopWindowAction } from "@/features/mermaid-editor/lib/editor-runtime/desktop-window-types";
import type { ElectronMonitoringBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-monitoring-bridge-types";
import type { RuntimeCreateProjectFileRequest, RuntimeCreateProjectFileResult, RuntimeMoveProjectFileRequest, RuntimeMoveProjectFileResult } from "@/features/mermaid-editor/lib/editor-runtime/project-file-types";
import type { ElectronMarkdownFoldBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-fold";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  RuntimeCreateProjectTextFileResult,
  RuntimeCsvFileSnapshot,
  RuntimeWriteCsvFileResult
} from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";

export type ElectronOpenedFile = {
  name: string;
  path: string;
  text: string;
};

export type ElectronSavedFile = {
  name: string;
  path: string;
};

export type ElectronCreateProjectDocumentResult =
  | { status: "created"; file: ElectronSavedFile; text: string }
  | { status: "exists"; file: ElectronSavedFile };

export type ElectronImageAsset = {
  src: string;
  displaySrc: string;
  path: string;
  copied?: boolean;
};

export type ElectronBridge = ElectronMarkdownFoldBridge & ElectronMonitoringBridge & ElectronAgentBridge & ElectronEmbeddedBrowserBridge & {
  host: "electron";
  openExternalUrl: (url: string) => Promise<void>;
  startWindowDrag: () => Promise<void>;
  toggleWindowMaximize: () => Promise<void>;
  runWindowAction: (action: RuntimeDesktopWindowAction) => Promise<void>;
  onDesktopWindowCloseRequest: (handler: () => boolean | Promise<boolean>) => () => void;
  readAppState: () => Promise<EditorDraftState | null>;
  listSystemFonts: () => Promise<RuntimeSystemFont[]>;
  writeAppState: (state: EditorDraftState) => Promise<void>;
  openFile: () => Promise<ElectronOpenedFile | null>;
  openFilePath: (path: string) => Promise<ElectronOpenedFile>;
  saveFile: (path: string, text: string) => Promise<ElectronSavedFile>;
  saveFileAs: (suggestedName: string, text: string) => Promise<ElectronSavedFile | null>;
  createProjectDocument: (request: {
    rootPath: string;
    fileName: string;
    documentKind: DocumentKind;
    text: string;
  }) => Promise<ElectronCreateProjectDocumentResult>;
  createProjectTextFile: (request: { rootPath: string; fileName: string; kind: "csv"; text: string }) => Promise<RuntimeCreateProjectTextFileResult>;
  createProjectFile: (request: RuntimeCreateProjectFileRequest) => Promise<RuntimeCreateProjectFileResult>;
  moveProjectFile: (request: RuntimeMoveProjectFileRequest) => Promise<RuntimeMoveProjectFileResult>;
  readCsvFile: (request: { rootPath: string; path: string }) => Promise<RuntimeCsvFileSnapshot>;
  writeCsvFile: (request: { rootPath: string; path: string; text: string; expectedRevision: string }) => Promise<RuntimeWriteCsvFileResult>;
  pickImageAsset: (documentPath: string | null) => Promise<ElectronImageAsset | null>;
  importImageAssetPath: (documentPath: string, imagePath: string) => Promise<ElectronImageAsset>;
  importImageAssetBytes: (documentPath: string, fileName: string, bytes: number[]) => Promise<ElectronImageAsset>;
  resolveImageAssetSrc: (documentPath: string | null, src: string) => Promise<string>;
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
