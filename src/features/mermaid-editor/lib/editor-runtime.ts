import type { AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiApplyResult } from "@/features/mermaid-editor/lib/ai-command-types";
import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";

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

export type EditorRuntime = {
  kind: "web" | "desktop";
  loadDraft: () => EditorDraftState | null;
  saveDraft: (draft: EditorDraftState) => Promise<void>;
  openFile: () => Promise<RuntimeOpenFileResult>;
  saveFile: (file: RuntimeFileRef | null, documentText: string, suggestedName: string) => Promise<RuntimeSaveFileResult>;
  saveFileAs: (documentText: string, suggestedName: string) => Promise<RuntimeSaveFileResult>;
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

type AiNextCommandResponse = {
  ok: boolean;
  command?: AiEditorCommand;
  diagnostics?: EditorDiagnostic[];
};

const FILE_PICKER_TYPES = [
  {
    description: "Mermaid 文件",
    accept: {
      "text/plain": [".mmd", ".mermaid", ".txt"]
    }
  }
];

export const EDITOR_DRAFT_STORAGE_KEY = "mermaid-canvas-editor:v1";

export function createEditorRuntime(): EditorRuntime {
  return isTauriRuntime() ? createDesktopRuntime() : createWebRuntime();
}

export function ensureRuntimeMermaidFileName(value: string | undefined) {
  const name = value?.trim() || "diagram.mmd";
  return /\.(mmd|mermaid)$/i.test(name) ? name : `${name.replace(/\.[^.]+$/, "")}.mmd`;
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
    async saveFile(file, documentText, suggestedName) {
      if (!file?.handle) return this.saveFileAs(documentText, suggestedName);
      await writeDocumentToHandle(file.handle, documentText);
      return {
        status: "saved",
        file: { ...file, name: ensureRuntimeMermaidFileName(file.handle.name) }
      };
    },
    async saveFileAs(documentText, suggestedName) {
      const normalizedName = ensureRuntimeMermaidFileName(suggestedName);
      const picker = window as BrowserFilePickerWindow;

      if (!picker.showSaveFilePicker) {
        downloadMermaidDocument(documentText, normalizedName);
        return {
          status: "saved",
          downloaded: true,
          file: { name: normalizedName }
        };
      }

      const handle = await picker.showSaveFilePicker({
        suggestedName: normalizedName,
        types: [
          {
            description: "Mermaid 文件",
            accept: {
              "text/plain": [".mmd", ".mermaid"]
            }
          }
        ],
        excludeAcceptAllOption: false
      });
      await writeDocumentToHandle(handle, documentText);
      return {
        status: "saved",
        file: { name: ensureRuntimeMermaidFileName(handle.name || normalizedName), handle }
      };
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
    async saveFile(file, documentText, suggestedName) {
      if (!file?.path) return this.saveFileAs(documentText, suggestedName);
      const saved = await tauriInvoke<DesktopSavedFile>("save_mermaid_file", {
        path: file.path,
        text: documentText
      });
      return {
        status: "saved",
        file: { name: saved.name, path: saved.path }
      };
    },
    async saveFileAs(documentText, suggestedName) {
      const saved = await tauriInvoke<DesktopSavedFile | null>("save_mermaid_file_as", {
        suggestedName: ensureRuntimeMermaidFileName(suggestedName),
        text: documentText
      });
      if (!saved) return { status: "cancelled" };
      return {
        status: "saved",
        file: { name: saved.name, path: saved.path }
      };
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

function downloadMermaidDocument(documentText: string, name: string) {
  const blob = new Blob([documentText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ensureRuntimeMermaidFileName(name);
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
