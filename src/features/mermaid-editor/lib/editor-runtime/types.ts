import type { AiApplyResult, AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import type { BrowserToolWindowRequest } from "@/features/mermaid-editor/lib/browser-tool-window";
import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { EmbeddedBrowserLogicalRect } from "@/features/mermaid-editor/lib/embedded-browser-rect";
import type { RuntimeLinkPreviewRequest, RuntimeLinkPreviewResult } from "@/features/mermaid-editor/lib/editor-runtime/link-preview-types";
import type { RuntimeCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
export type { RuntimeLinkPreviewRequest, RuntimeLinkPreviewResult } from "@/features/mermaid-editor/lib/editor-runtime/link-preview-types";

export type EditorDraftState = Record<string, unknown>;

export type RuntimeSystemFont = { family: string; monospace: boolean };

export type BrowserWritableFile = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

export type BrowserFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<BrowserWritableFile>;
};

export type RuntimeFileRef = {
  name: string;
  path?: string;
  handle?: BrowserFileHandle;
};

export type RuntimeOpenFileResult =
  | {
      status: "opened";
      file: RuntimeFileRef;
      text: string;
    }
  | {
      status: "fallback";
    }
  | {
      status: "cancelled";
    };

export type RuntimeSaveFileResult =
  | {
      status: "saved";
      file: RuntimeFileRef;
      downloaded?: boolean;
    }
  | {
      status: "cancelled";
    };

export type RuntimeCreateProjectDocumentResult =
  | { status: "created"; file: RuntimeFileRef; text: string }
  | { status: "exists"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeFileOpenRequest = {
  name: string;
  path: string;
};

export type RuntimeFileDropRequest = {
  type: "enter" | "over" | "drop" | "leave";
  files: RuntimeFileOpenRequest[];
  position?: {
    x: number;
    y: number;
  };
};

export type RuntimeImageAssetResult =
  | {
      status: "ready";
      src: string;
      displaySrc: string;
      path?: string;
      copied?: boolean;
    }
  | {
      status: "cancelled";
    }
  | {
      status: "needs-document";
    }
  | {
      status: "unsupported";
      message: string;
    };

export type RuntimeTerminalSession = {
  sessionId: string;
  cwd: string;
  shellId: string;
  shellLabel: string;
  shell: string;
};

export type RuntimeTerminalShellOption = {
  id: string;
  label: string;
  command: string;
  available: boolean;
};

export type RuntimeTerminalOpenResult =
  | {
      status: "opened";
      session: RuntimeTerminalSession;
    }
  | {
      status: "unsupported";
      message: string;
    };

export type RuntimeTerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type RuntimeTerminalExitEvent = {
  sessionId: string;
  exitCode: number | null;
};

export type RuntimeProjectFolderResult =
  | {
      status: "opened";
      workspace: ProjectWorkspace;
    }
  | {
      status: "cancelled";
    }
  | {
      status: "unsupported";
      message: string;
    };

export type RuntimeDesktopWindowAction = "minimize" | "toggleMaximize" | "close";

export type RuntimeEmbeddedBrowserHandle = {
  close: () => Promise<void>;
  hide: () => Promise<void>;
  show: () => Promise<void>;
  focus: () => Promise<void>;
  setRect: (rect: EmbeddedBrowserLogicalRect) => Promise<void>;
  onCreated: (handler: () => void) => Promise<void>;
  onError: (handler: (error: unknown) => void) => Promise<void>;
};

export type RuntimeEmbeddedBrowserResult =
  | {
      status: "created";
      browser: RuntimeEmbeddedBrowserHandle;
    }
  | {
      status: "unsupported";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type RuntimeBrowserToolWindowResult =
  | {
      status: "opened";
      reused?: boolean;
      external?: boolean;
    }
  | {
      status: "unsupported";
      message: string;
    };

export type EditorRuntimeHost = "web" | "tauri" | "electron";

export type EditorRuntime = RuntimeCsvFileOperations & {
  kind: "web" | "desktop";
  host: EditorRuntimeHost;
  openExternalUrl: (url: string) => void;
  isDesktopWindowAvailable: () => boolean;
  startDesktopWindowDrag: () => Promise<void>;
  toggleDesktopWindowMaximize: () => Promise<void>;
  runDesktopWindowAction: (action: RuntimeDesktopWindowAction) => Promise<void>;
  listenForDesktopWindowCloseRequest: (handler: () => boolean | Promise<boolean>) => Promise<() => void>;
  createEmbeddedBrowser: (request: {
    label: string;
    url: string;
    rect: EmbeddedBrowserLogicalRect;
  }) => Promise<RuntimeEmbeddedBrowserResult>;
  openBrowserToolWindow: (request: BrowserToolWindowRequest) => Promise<RuntimeBrowserToolWindowResult>;
  loadDraft: () => EditorDraftState | null;
  loadSavedState: () => Promise<EditorDraftState | null>;
  listSystemFonts: () => Promise<RuntimeSystemFont[]>;
  saveDraft: (draft: EditorDraftState) => Promise<void>;
  openFile: () => Promise<RuntimeOpenFileResult>;
  openFilePath: (path: string) => Promise<RuntimeOpenFileResult>;
  saveFile: (
    file: RuntimeFileRef | null,
    documentText: string,
    suggestedName: string,
    documentKind: DocumentKind
  ) => Promise<RuntimeSaveFileResult>;
  saveFileAs: (documentText: string, suggestedName: string, documentKind: DocumentKind) => Promise<RuntimeSaveFileResult>;
  createProjectDocument: (request: { rootPath: string; fileName: string; documentKind: DocumentKind; text: string }) => Promise<RuntimeCreateProjectDocumentResult>;
  pickImageAsset: (file: RuntimeFileRef | null) => Promise<RuntimeImageAssetResult>;
  importImageAssetPath: (file: RuntimeFileRef | null, path: string) => Promise<RuntimeImageAssetResult>;
  importImageAssetFile: (file: RuntimeFileRef | null, image: File) => Promise<RuntimeImageAssetResult>;
  resolveImageAssetSrc: (file: RuntimeFileRef | null, src: string) => Promise<string>;
  resolveLinkPreview: (request: RuntimeLinkPreviewRequest) => Promise<RuntimeLinkPreviewResult>;
  openProjectFolder: () => Promise<RuntimeProjectFolderResult>;
  readProjectFolder: (rootPath: string) => Promise<RuntimeProjectFolderResult>;
  takePendingOpenFiles: () => Promise<RuntimeFileOpenRequest[]>;
  listenForExternalFileOpen: (handler: (files: RuntimeFileOpenRequest[]) => void) => Promise<() => void>;
  listenForFileDrops: (handler: (request: RuntimeFileDropRequest) => void) => Promise<() => void>;
  listTerminalShells: () => Promise<RuntimeTerminalShellOption[]>;
  openTerminal: (request: { cwd?: string; shellId?: string; cols: number; rows: number }) => Promise<RuntimeTerminalOpenResult>;
  writeTerminal: (sessionId: string, data: string) => Promise<void>;
  resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (sessionId: string) => Promise<void>;
  listenForTerminalData: (handler: (event: RuntimeTerminalDataEvent) => void) => Promise<() => void>;
  listenForTerminalExit: (handler: (event: RuntimeTerminalExitEvent) => void) => Promise<() => void>;
  publishAiContext: (context: AiEditorContext) => Promise<void>;
  pollAiCommand: () => Promise<AiEditorCommand | null>;
  finishAiCommand: (result: AiApplyResult) => Promise<void>;
};
