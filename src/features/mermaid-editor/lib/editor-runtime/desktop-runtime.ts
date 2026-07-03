import type { AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { browserToolShellUrl, browserToolWindowLabel, browserToolWindowTitle } from "@/features/mermaid-editor/lib/browser-tool-window";
import { createDesktopEmbeddedBrowser } from "@/features/mermaid-editor/lib/editor-runtime/embedded-browser";
import { resolveDesktopLinkPreview } from "@/features/mermaid-editor/lib/editor-runtime/link-preview";
import { ensureRuntimeDocumentFileName, isExternalAssetSrc, isNativeFilePath, openExternalUrl } from "@/features/mermaid-editor/lib/editor-runtime/shared";
import {
  exposedNativeFilePath,
  filePathToDisplaySrc,
  getTauriCurrentWindow,
  isTauriRuntime,
  tauriInvoke
} from "@/features/mermaid-editor/lib/editor-runtime/tauri-bridge";
import type {
  EditorDraftState,
  EditorRuntime,
  RuntimeFileOpenRequest,
  RuntimeTerminalDataEvent,
  RuntimeTerminalExitEvent,
  RuntimeTerminalSession,
  RuntimeTerminalShellOption
} from "@/features/mermaid-editor/lib/editor-runtime/types";
import { runtimeFileRefFromPath } from "@/features/mermaid-editor/lib/file-workflow";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";
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

export function createDesktopRuntime(): EditorRuntime {
  return {
    kind: "desktop",
    openExternalUrl(url) {
      openExternalUrl(url);
    },
    isDesktopWindowAvailable() {
      return isTauriRuntime();
    },
    async startDesktopWindowDrag() {
      await (await getTauriCurrentWindow())?.startDragging();
    },
    async toggleDesktopWindowMaximize() {
      await (await getTauriCurrentWindow())?.toggleMaximize();
    },
    async runDesktopWindowAction(action) {
      const windowRef = await getTauriCurrentWindow();
      if (!windowRef) return;
      if (action === "minimize") await windowRef.minimize();
      if (action === "toggleMaximize") await windowRef.toggleMaximize();
      if (action === "close") await windowRef.close();
    },
    async listenForDesktopWindowCloseRequest(handler) {
      const windowRef = await getTauriCurrentWindow();
      if (!windowRef) return () => undefined;
      return windowRef.onCloseRequested(async (event: { preventDefault: () => void }) => {
        event.preventDefault();
        const canClose = await handler();
        if (canClose) await windowRef.destroy();
      });
    },
    async createEmbeddedBrowser(request) {
      return createDesktopEmbeddedBrowser(request);
    },
    async openBrowserToolWindow(request) {
      if (!isTauriRuntime()) {
        openExternalUrl(request.url);
        return { status: "opened", external: true };
      }

      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const label = browserToolWindowLabel(request.url);
      const existing = await WebviewWindow.getByLabel(label).catch(() => null);
      if (existing) {
        await existing.show().catch(() => undefined);
        await existing.setFocus().catch(() => undefined);
        return { status: "opened", reused: true };
      }

      const shellUrl = browserToolShellUrl(request, window.location.href);
      const title = `MMM Browser - ${browserToolWindowTitle(request.url, request.title)}`;
      new WebviewWindow(label, {
        url: shellUrl,
        title,
        width: 1040,
        height: 720,
        minWidth: 640,
        minHeight: 420,
        center: true,
        preventOverflow: true,
        resizable: true,
        decorations: false,
        shadow: true,
        focus: true,
        skipTaskbar: true,
        parent: "main"
      });
      return { status: "opened" };
    },
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
    async importImageAssetFile(file, image) {
      if (!file?.path) return { status: "needs-document" };
      const exposedPath = exposedNativeFilePath(image);
      if (exposedPath) return this.importImageAssetPath(file, exposedPath);

      const bytes = Array.from(new Uint8Array(await image.arrayBuffer()));
      const asset = await tauriInvoke<DesktopImageAsset>("import_image_asset_bytes", {
        documentPath: file.path,
        fileName: image.name,
        bytes
      });
      return {
        status: "ready",
        src: asset.src,
        path: asset.path,
        copied: asset.copied,
        displaySrc: await filePathToDisplaySrc(asset.path)
      };
    },
    async resolveImageAssetSrc(file, src) {
      if (isExternalAssetSrc(src)) return src;
      if (!file?.path) return isNativeFilePath(src) ? filePathToDisplaySrc(src) : src;
      const path = await tauriInvoke<string | null>("resolve_image_asset_path", { documentPath: file.path, src });
      return path ? filePathToDisplaySrc(path) : isNativeFilePath(src) ? filePathToDisplaySrc(src) : src;
    },
    resolveLinkPreview: resolveDesktopLinkPreview,
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
