import { openExternalUrl } from "@/features/mermaid-editor/lib/editor-runtime/shared";
import { createWebRuntime } from "@/features/mermaid-editor/lib/editor-runtime/web-runtime";
import { getElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import { ensureRuntimeDocumentFileName } from "@/features/mermaid-editor/lib/editor-runtime/shared";
import type {
  EditorRuntime,
  RuntimeImageAssetResult,
  RuntimeEmbeddedBrowserHandle,
  RuntimeEmbeddedBrowserResult
} from "@/features/mermaid-editor/lib/editor-runtime/types";
import type { ElectronImageAsset } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import { createElectronCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-csv-file";
import { createElectronMarkdownFoldOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-fold";
import { createElectronRuntimeMonitoring } from "@/features/mermaid-editor/lib/editor-runtime/electron-runtime-monitoring";
export function createElectronRuntime(): EditorRuntime {
  const bridge = getElectronBridge();
  const fallback = createWebRuntime();

  if (!bridge) return fallback;

  return {
    ...fallback,
    ...createElectronCsvFileOperations(bridge),
    ...createElectronMarkdownFoldOperations(bridge), ...createElectronRuntimeMonitoring(bridge),
    kind: "desktop",
    host: "electron",
    openExternalUrl(url) {
      void bridge.openExternalUrl(url).catch(() => openExternalUrl(url));
    },
    isDesktopWindowAvailable() {
      return true;
    },
    async startDesktopWindowDrag() {
      await bridge.startWindowDrag();
    },
    async toggleDesktopWindowMaximize() {
      await bridge.toggleWindowMaximize();
    },
    async runDesktopWindowAction(action) {
      await bridge.runWindowAction(action);
    },
    async listenForDesktopWindowCloseRequest(handler) {
      return bridge.onDesktopWindowCloseRequest(handler);
    },
    async loadSavedState() {
      return bridge.readAppState();
    },
    async listSystemFonts() {
      return bridge.listSystemFonts();
    },
    async saveDraft(draft) {
      await bridge.writeAppState(draft);
    },
    async openFile() {
      const opened = await bridge.openFile();
      if (!opened) return { status: "cancelled" };
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path },
        text: opened.text
      };
    },
    async openFilePath(path) {
      const opened = await bridge.openFilePath(path);
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path },
        text: opened.text
      };
    },
    async saveFile(file, documentText, suggestedName, documentKind) {
      if (!file?.path) return this.saveFileAs(documentText, suggestedName, documentKind);
      const saved = await bridge.saveFile(file.path, documentText);
      return {
        status: "saved",
        file: { name: ensureRuntimeDocumentFileName(saved.name, documentKind), path: saved.path }
      };
    },
    async saveFileAs(documentText, suggestedName, documentKind) {
      const saved = await bridge.saveFileAs(ensureRuntimeDocumentFileName(suggestedName, documentKind), documentText);
      if (!saved) return { status: "cancelled" };
      return {
        status: "saved",
        file: { name: ensureRuntimeDocumentFileName(saved.name, documentKind), path: saved.path }
      };
    },
    async createProjectDocument(request) {
      const result = await bridge.createProjectDocument(request);
      if (result.status === "exists") {
        return { status: "exists", file: result.file };
      }
      return {
        status: "created",
        file: result.file,
        text: result.text
      };
    },
    async createProjectFile(request) { return bridge.createProjectFile(request); },
    async moveProjectFile(request) { return bridge.moveProjectFile(request); },
    async pickImageAsset(file) {
      if (!file?.path) return { status: "needs-document" };
      const asset = await bridge.pickImageAsset(file.path);
      return asset ? electronImageAssetResult(asset) : { status: "cancelled" };
    },
    async importImageAssetPath(file, path) {
      if (!file?.path) return { status: "needs-document" };
      return electronImageAssetResult(await bridge.importImageAssetPath(file.path, path));
    },
    async importImageAssetFile(file, image) {
      if (!file?.path) return { status: "needs-document" };
      const bytes = Array.from(new Uint8Array(await image.arrayBuffer()));
      return electronImageAssetResult(await bridge.importImageAssetBytes(file.path, image.name, bytes));
    },
    async resolveImageAssetSrc(file, src) {
      return bridge.resolveImageAssetSrc(file?.path || null, src);
    },
    async resolveLinkPreview(request) {
      return bridge.resolveLinkPreview(request);
    },
    async openProjectFolder() {
      const workspace = await bridge.openProjectFolder();
      if (!workspace) return { status: "cancelled" };
      return { status: "opened", workspace };
    },
    async readProjectFolder(rootPath) {
      const workspace = await bridge.readProjectFolder(rootPath);
      return { status: "opened", workspace };
    },
    async takePendingOpenFiles() {
      return bridge.takePendingOpenFiles();
    },
    async listenForExternalFileOpen(handler) {
      return bridge.onExternalFileOpen(handler);
    },
    async listenForFileDrops(handler) {
      return bridge.onFileDrops(handler);
    },
    async startAgent(request) { return bridge.startAgent(request); },
    async sendAgentRpc(command) { return bridge.sendAgentRpc(command); },
    async runAgentControl(command) { return bridge.runAgentControl(command); },
    async respondAgentExtensionUi(response) { await bridge.respondAgentExtensionUi(response); },
    async respondAgentHost(response) { await bridge.respondAgentHost(response); },
    async stopAgent() { await bridge.stopAgent(); },
    async listenForAgentEvents(handler) { return bridge.onAgentEvent(handler); },
    async listTerminalShells() {
      return bridge.listTerminalShells();
    },
    async openTerminal(request) {
      return bridge.openTerminal(request);
    },
    async writeTerminal(sessionId, data) {
      await bridge.writeTerminal(sessionId, data);
    },
    async resizeTerminal(sessionId, cols, rows) {
      await bridge.resizeTerminal(sessionId, cols, rows);
    },
    async closeTerminal(sessionId) {
      await bridge.closeTerminal(sessionId);
    },
    async listenForTerminalData(handler) {
      return bridge.onTerminalData(handler);
    },
    async listenForTerminalExit(handler) {
      return bridge.onTerminalExit(handler);
    },
    async createEmbeddedBrowser(request): Promise<RuntimeEmbeddedBrowserResult> {
      const result = await bridge.createEmbeddedBrowser(request);
      if (result.status !== "created") return result;
      return {
        status: "created",
        browser: electronEmbeddedBrowserHandle(result.label || request.label, bridge)
      };
    },
    async openBrowserToolWindow(request) {
      return bridge.openBrowserToolWindow(request);
    }
  };
}

function electronImageAssetResult(asset: ElectronImageAsset): RuntimeImageAssetResult {
  return {
    status: "ready",
    src: asset.src,
    displaySrc: asset.displaySrc,
    path: asset.path,
    copied: asset.copied
  };
}

function electronEmbeddedBrowserHandle(label: string, bridge: NonNullable<ReturnType<typeof getElectronBridge>>): RuntimeEmbeddedBrowserHandle {
  let closed = false;
  let unlistenError: (() => void) | null = null;

  return {
    async close() {
      if (closed) return;
      closed = true;
      unlistenError?.();
      unlistenError = null;
      await bridge.closeEmbeddedBrowser(label);
    },
    async hide() {
      if (!closed) await bridge.hideEmbeddedBrowser(label);
    },
    async show() {
      if (!closed) await bridge.showEmbeddedBrowser(label);
    },
    async focus() {
      if (!closed) await bridge.focusEmbeddedBrowser(label);
    },
    async setRect(rect) {
      if (!closed) await bridge.setEmbeddedBrowserRect(label, rect);
    },
    async onCreated(handler) {
      window.requestAnimationFrame(() => {
        if (!closed) handler();
      });
    },
    async onError(handler) {
      unlistenError?.();
      unlistenError = bridge.onEmbeddedBrowserError((event) => {
        if (!closed && event.label === label) handler(event.message || event);
      });
    }
  };
}
