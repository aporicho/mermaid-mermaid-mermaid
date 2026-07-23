import type { EmbeddedBrowserLogicalRect } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import type { BrowserToolWindowRequest } from "@/features/mermaid-editor/lib/browser-tool-window";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { AiApplyResult, AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import type {
  EditorDraftState,
  RuntimeBrowserToolWindowResult,
  RuntimeDesktopWindowAction,
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
import type { RuntimeCreateProjectFileRequest, RuntimeCreateProjectFileResult, RuntimeMoveProjectFileRequest, RuntimeMoveProjectFileResult } from "@/features/mermaid-editor/lib/editor-runtime/project-file-types";
import type { ElectronMarkdownFoldBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-fold";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
import type {
  RuntimeCreateProjectTextFileResult,
  RuntimeCsvFileSnapshot,
  RuntimeWriteCsvFileResult
} from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";

export type ElectronEmbeddedBrowserCreateResult =
  | {
      status: "created";
      label: string;
    }
  | {
      status: "unsupported" | "error";
      message: string;
    };

export type ElectronEmbeddedBrowserErrorEvent = {
  label: string;
  message: string;
};

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

export type ElectronBridge = ElectronMarkdownFoldBridge & {
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
  publishAiContext: (context: AiEditorContext) => Promise<void>;
  pollAiCommand: () => Promise<{ ok: boolean; command?: AiEditorCommand | null; diagnostics?: unknown[] }>;
  finishAiCommand: (result: AiApplyResult) => Promise<void>;
  listTerminalShells: () => Promise<RuntimeTerminalShellOption[]>;
  openTerminal: (request: { cwd?: string; shellId?: string; cols: number; rows: number }) => Promise<RuntimeTerminalOpenResult>;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (sessionId: string) => Promise<void>;
  onTerminalData: (handler: (event: RuntimeTerminalDataEvent) => void) => () => void;
  onTerminalExit: (handler: (event: RuntimeTerminalExitEvent) => void) => () => void;
  openProjectFolder: () => Promise<ProjectWorkspace | null>;
  readProjectFolder: (rootPath: string) => Promise<ProjectWorkspace>;
  createEmbeddedBrowser: (request: {
    label: string;
    url: string;
    rect: EmbeddedBrowserLogicalRect;
  }) => Promise<ElectronEmbeddedBrowserCreateResult>;
  closeEmbeddedBrowser: (label: string) => Promise<void>;
  hideEmbeddedBrowser: (label: string) => Promise<void>;
  showEmbeddedBrowser: (label: string) => Promise<void>;
  focusEmbeddedBrowser: (label: string) => Promise<void>;
  setEmbeddedBrowserRect: (label: string, rect: EmbeddedBrowserLogicalRect) => Promise<void>;
  onEmbeddedBrowserError: (handler: (event: ElectronEmbeddedBrowserErrorEvent) => void) => () => void;
  openBrowserToolWindow: (request: BrowserToolWindowRequest) => Promise<RuntimeBrowserToolWindowResult>;
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
