import type { AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiApplyResult } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import {
  DOCUMENT_FILE_EXTENSIONS,
  ensureDocumentFileName,
  type DocumentKind
} from "@/features/mermaid-editor/lib/document-kind";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { runtimeFileRefFromPath } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export type EditorDraftState = Record<string, unknown>;

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

export type EditorRuntime = {
  kind: "web" | "desktop";
  loadDraft: () => EditorDraftState | null;
  loadSavedState: () => Promise<EditorDraftState | null>;
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
  pickImageAsset: (file: RuntimeFileRef | null) => Promise<RuntimeImageAssetResult>;
  importImageAssetPath: (file: RuntimeFileRef | null, path: string) => Promise<RuntimeImageAssetResult>;
  resolveImageAssetSrc: (file: RuntimeFileRef | null, src: string) => Promise<string>;
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

type BrowserWritableFile = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

type BrowserFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<BrowserWritableFile>;
};

type BrowserFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<BrowserFileHandle>;
};

type DesktopOpenedFile = {
  name: string;
  path: string;
  text: string;
};

type DesktopSavedFile = {
  name: string;
  path: string;
};

type DesktopPendingFile = {
  name: string;
  path: string;
};

type DesktopImageAsset = {
  src: string;
  path: string;
  copied?: boolean;
};

type AiNextCommandResponse = {
  ok: boolean;
  command?: AiEditorCommand;
  diagnostics?: EditorDiagnostic[];
};

const FILE_PICKER_TYPES = [
  {
    description: "项目文档",
    accept: {
      "text/plain": DOCUMENT_FILE_EXTENSIONS.filter((extension) => extension !== ".canvas.json"),
      "application/json": [".canvas.json"]
    }
  }
];

export const EDITOR_DRAFT_STORAGE_KEY = "mermaid-canvas-editor:v1";

export function createEditorRuntime(): EditorRuntime {
  return isTauriRuntime() ? createDesktopRuntime() : createWebRuntime();
}

export function ensureRuntimeMermaidFileName(value: string | undefined) {
  return ensureRuntimeDocumentFileName(value, "mermaid");
}

export function ensureRuntimeDocumentFileName(value: string | undefined, documentKind: DocumentKind) {
  return ensureDocumentFileName(value, documentKind);
}

export function isRuntimeAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function createWebRuntime(): EditorRuntime {
  return {
    kind: "web",
    loadDraft() {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(EDITOR_DRAFT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EditorDraftState) : null;
    },
    async loadSavedState() {
      return this.loadDraft();
    },
    async saveDraft(draft) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    },
    async openFile() {
      const picker = window as BrowserFilePickerWindow;
      if (!picker.showOpenFilePicker) return { status: "fallback" };

      const [handle] = await picker.showOpenFilePicker({
        multiple: false,
        types: FILE_PICKER_TYPES,
        excludeAcceptAllOption: false
      });
      if (!handle) return { status: "cancelled" };

      const file = await handle.getFile();
      return {
        status: "opened",
        file: { name: file.name, handle },
        text: await file.text()
      };
    },
    async openFilePath() {
      return { status: "cancelled" };
    },
    async saveFile(file, documentText, suggestedName, documentKind) {
      if (!file?.handle) return this.saveFileAs(documentText, suggestedName, documentKind);
      await writeDocumentToHandle(file.handle, documentText);
      return {
        status: "saved",
        file: { ...file, name: ensureRuntimeDocumentFileName(file.handle.name, documentKind) }
      };
    },
    async saveFileAs(documentText, suggestedName, documentKind) {
      const normalizedName = ensureRuntimeDocumentFileName(suggestedName, documentKind);
      const picker = window as BrowserFilePickerWindow;

      if (!picker.showSaveFilePicker) {
        downloadTextDocument(documentText, normalizedName, documentKind);
        return {
          status: "saved",
          downloaded: true,
          file: { name: normalizedName }
        };
      }

      const handle = await picker.showSaveFilePicker({
        suggestedName: normalizedName,
        types: FILE_PICKER_TYPES,
        excludeAcceptAllOption: false
      });
      await writeDocumentToHandle(handle, documentText);
      return {
        status: "saved",
        file: { name: ensureRuntimeDocumentFileName(handle.name || normalizedName, documentKind), handle }
      };
    },
    async pickImageAsset() {
      return {
        status: "unsupported",
        message: "网页版暂不支持稳定保存本地图片，请使用图片 URL 或桌面版。"
      };
    },
    async importImageAssetPath() {
      return {
        status: "unsupported",
        message: "网页版暂不支持稳定保存本地图片，请使用图片 URL 或桌面版。"
      };
    },
    async resolveImageAssetSrc(_file, src) {
      return src;
    },
    async openProjectFolder() {
      return {
        status: "unsupported",
        message: "网页版暂不支持浏览本地项目文件夹，请使用桌面版。"
      };
    },
    async readProjectFolder() {
      return {
        status: "unsupported",
        message: "网页版暂不支持刷新本地项目文件夹，请使用桌面版。"
      };
    },
    async takePendingOpenFiles() {
      return [];
    },
    async listenForExternalFileOpen() {
      return () => undefined;
    },
    async listenForFileDrops() {
      return () => undefined;
    },
    async openTerminal() {
      return {
        status: "unsupported",
        message: "网页版不支持本地终端，请使用桌面版。"
      };
    },
    async listTerminalShells() {
      return [
        {
          id: "default",
          label: "默认",
          command: "desktop",
          available: false
        }
      ];
    },
    async writeTerminal() {
      // Static web builds intentionally do not expose local terminal access.
    },
    async resizeTerminal() {
      // Static web builds intentionally do not expose local terminal access.
    },
    async closeTerminal() {
      // Static web builds intentionally do not expose local terminal access.
    },
    async listenForTerminalData() {
      return () => undefined;
    },
    async listenForTerminalExit() {
      return () => undefined;
    },
    async publishAiContext() {
      // Static web builds intentionally do not expose the live AI bridge.
    },
    async pollAiCommand() {
      return null;
    },
    async finishAiCommand() {
      // Static web builds intentionally do not expose the live AI bridge.
    }
  };
}

function createDesktopRuntime(): EditorRuntime {
  return {
    kind: "desktop",
    loadDraft() {
      return null;
    },
    async loadSavedState() {
      return tauriInvoke<EditorDraftState | null>("read_app_state");
    },
    async saveDraft(draft) {
      await tauriInvoke("write_app_state", { state: draft });
    },
    async openFile() {
      const opened = await tauriInvoke<DesktopOpenedFile | null>("open_mermaid_file");
      if (!opened) return { status: "cancelled" };
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path },
        text: opened.text
      };
    },
    async openFilePath(path) {
      const opened = await tauriInvoke<DesktopOpenedFile>("open_mermaid_file_path", { path });
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path },
        text: opened.text
      };
    },
    async saveFile(file, documentText, suggestedName, documentKind) {
      if (!file?.path) return this.saveFileAs(documentText, suggestedName, documentKind);
      const saved = await tauriInvoke<DesktopSavedFile>("save_mermaid_file", {
        path: file.path,
        text: documentText
      });
      return {
        status: "saved",
        file: { name: saved.name, path: saved.path }
      };
    },
    async saveFileAs(documentText, suggestedName, documentKind) {
      const saved = await tauriInvoke<DesktopSavedFile | null>("save_mermaid_file_as", {
        suggestedName: ensureRuntimeDocumentFileName(suggestedName, documentKind),
        text: documentText
      });
      if (!saved) return { status: "cancelled" };
      return {
        status: "saved",
        file: { name: saved.name, path: saved.path }
      };
    },
    async pickImageAsset(file) {
      if (!file?.path) return { status: "needs-document" };
      const asset = await tauriInvoke<DesktopImageAsset | null>("pick_image_asset", { documentPath: file.path });
      if (!asset) return { status: "cancelled" };
      return {
        status: "ready",
        src: asset.src,
        path: asset.path,
        copied: asset.copied,
        displaySrc: await filePathToDisplaySrc(asset.path)
      };
    },
    async importImageAssetPath(file, path) {
      if (!file?.path) return { status: "needs-document" };
      const asset = await tauriInvoke<DesktopImageAsset>("import_image_asset_path", { documentPath: file.path, imagePath: path });
      return {
        status: "ready",
        src: asset.src,
        path: asset.path,
        copied: asset.copied,
        displaySrc: await filePathToDisplaySrc(asset.path)
      };
    },
    async resolveImageAssetSrc(file, src) {
      if (isExternalAssetSrc(src) || !file?.path) return src;
      const path = await tauriInvoke<string | null>("resolve_image_asset_path", { documentPath: file.path, src });
      return path ? filePathToDisplaySrc(path) : src;
    },
    async openProjectFolder() {
      const workspace = await tauriInvoke<ProjectWorkspace | null>("open_mermaid_project_folder");
      if (!workspace) return { status: "cancelled" };
      return { status: "opened", workspace };
    },
    async readProjectFolder(rootPath) {
      const workspace = await tauriInvoke<ProjectWorkspace>("read_mermaid_project_folder", { rootPath });
      return { status: "opened", workspace };
    },
    async takePendingOpenFiles() {
      return tauriInvoke<DesktopPendingFile[]>("take_pending_file_opens");
    },
    async listenForExternalFileOpen(handler) {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<DesktopPendingFile[]>("file-workflow:external-open", (event) => {
        handler(event.payload);
      });
    },
    async listenForFileDrops(handler) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const windowRef = getCurrentWindow();
      const scaleFactor = await windowRef.scaleFactor().catch(() => 1);
      const unlisten = await windowRef.onDragDropEvent((event) => {
        const files =
          "paths" in event.payload
            ? event.payload.paths.map(runtimeFileRefFromPath).filter((file): file is RuntimeFileOpenRequest => Boolean(file.path))
            : [];
        handler({
          type: event.payload.type,
          files,
          ...("position" in event.payload
            ? {
                position: {
                  x: event.payload.position.x / scaleFactor,
                  y: event.payload.position.y / scaleFactor
                }
              }
            : {})
        });
      });
      return unlisten;
    },
    async openTerminal(request) {
      const session = await tauriInvoke<RuntimeTerminalSession>("terminal_open", request);
      return { status: "opened", session };
    },
    async listTerminalShells() {
      return tauriInvoke<RuntimeTerminalShellOption[]>("terminal_list_shells");
    },
    async writeTerminal(sessionId, data) {
      await tauriInvoke("terminal_write", { sessionId, data });
    },
    async resizeTerminal(sessionId, cols, rows) {
      await tauriInvoke("terminal_resize", { sessionId, cols, rows });
    },
    async closeTerminal(sessionId) {
      await tauriInvoke("terminal_close", { sessionId });
    },
    async listenForTerminalData(handler) {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<RuntimeTerminalDataEvent>("terminal:data", (event) => {
        handler(event.payload);
      });
    },
    async listenForTerminalExit(handler) {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<RuntimeTerminalExitEvent>("terminal:exit", (event) => {
        handler(event.payload);
      });
    },
    async publishAiContext(context) {
      await tauriInvoke("publish_editor_context", { context });
    },
    async pollAiCommand() {
      const response = await tauriInvoke<AiNextCommandResponse>("take_next_ai_command");
      return response.command || null;
    },
    async finishAiCommand(result) {
      await tauriInvoke("finish_ai_command", { result });
    }
  };
}

async function writeDocumentToHandle(handle: BrowserFileHandle, documentText: string) {
  const writable = await handle.createWritable();
  await writable.write(documentText);
  await writable.close();
}

function downloadTextDocument(documentText: string, name: string, documentKind: DocumentKind) {
  const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureRuntimeDocumentFileName(name, documentKind);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

async function filePathToDisplaySrc(path: string) {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
}

function isExternalAssetSrc(src: string) {
  return /^(https?:|data:|blob:|asset:|tauri:)/i.test(src);
}
