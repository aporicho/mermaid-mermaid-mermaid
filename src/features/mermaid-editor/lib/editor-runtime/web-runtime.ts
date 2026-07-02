import {
  downloadTextDocument,
  FILE_PICKER_TYPES,
  type BrowserFilePickerWindow,
  writeDocumentToHandle
} from "@/features/mermaid-editor/lib/editor-runtime/browser-file";
import {
  EDITOR_DRAFT_STORAGE_KEY,
  ensureRuntimeDocumentFileName,
  openExternalUrl
} from "@/features/mermaid-editor/lib/editor-runtime/shared";
import type {
  EditorDraftState,
  EditorRuntime
} from "@/features/mermaid-editor/lib/editor-runtime/types";

export function createWebRuntime(): EditorRuntime {
  return {
    kind: "web",
    openExternalUrl(url) {
      openExternalUrl(url);
    },
    isDesktopWindowAvailable() {
      return false;
    },
    async startDesktopWindowDrag() {
      // Static web builds do not expose desktop window controls.
    },
    async toggleDesktopWindowMaximize() {
      // Static web builds do not expose desktop window controls.
    },
    async runDesktopWindowAction() {
      // Static web builds do not expose desktop window controls.
    },
    async listenForDesktopWindowCloseRequest() {
      return () => undefined;
    },
    async createEmbeddedBrowser() {
      return {
        status: "unsupported",
        message: "应用内浏览器需要桌面版 WebView2。"
      };
    },
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
    async importImageAssetFile() {
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
