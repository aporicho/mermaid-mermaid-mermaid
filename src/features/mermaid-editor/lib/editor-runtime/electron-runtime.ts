import { ensureRuntimeDocumentFileName, openExternalUrl } from "@/features/mermaid-editor/lib/editor-runtime/shared";
import { createWebRuntime } from "@/features/mermaid-editor/lib/editor-runtime/web-runtime";
import { getElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import type {
  EditorRuntime,
  RuntimeImageAssetResult,
  RuntimeEmbeddedBrowserResult
} from "@/features/mermaid-editor/lib/editor-runtime/types";
import type { ElectronImageAsset } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import { createElectronEmbeddedBrowserHandle } from "@/features/mermaid-editor/lib/editor-runtime/electron-embedded-browser";
import { createElectronCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-csv-file";
import { createElectronMarkdownFoldOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-fold";
import { createElectronRuntimeMonitoring } from "@/features/mermaid-editor/lib/editor-runtime/electron-runtime-monitoring";
import type { EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import { createElectronDocumentHubOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-document-hub";
import { createElectronMarkdownExportOperations } from "@/features/mermaid-editor/lib/editor-runtime/electron-markdown-export";
export function createElectronRuntime(): EditorRuntime {
  const bridge = getElectronBridge();
  const fallback = createWebRuntime();
  if (!bridge) return fallback;

  return {
    ...fallback,
    ...createElectronCsvFileOperations(bridge),
    ...createElectronDocumentHubOperations(bridge),
    ...createElectronMarkdownFoldOperations(bridge), ...createElectronRuntimeMonitoring(bridge), ...createElectronMarkdownExportOperations(bridge),
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
      const [state, editorSession] = await Promise.all([bridge.readAppState(), bridge.readEditorSession()]);
      return mergeEditorSessionIntoState(state, editorSession);
    },
    async listSystemFonts() {
      return bridge.listSystemFonts();
    },
    async readSystemMemoryInfo() { return bridge.readSystemMemoryInfo(); },
    async saveDraft(draft) {
      const editorSession = draft.editorSession as EditorDocumentSession | undefined;
      await Promise.all([
        bridge.writeAppState({ ...draft, editorSession: undefined }),
        editorSession ? bridge.writeEditorSession(editorSession) : Promise.resolve()
      ]);
    },
    async openFile() {
      const opened = await bridge.openFile();
      if (!opened) return { status: "cancelled" };
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path, revision: opened.revision, documentId: opened.documentId, workingRevision: opened.workingRevision },
        text: opened.text
      };
    },
    async openFilePath(path) {
      const opened = await bridge.openFilePath(path);
      return {
        status: "opened",
        file: { name: opened.name, path: opened.path, revision: opened.revision, documentId: opened.documentId, workingRevision: opened.workingRevision },
        text: opened.text
      };
    },
    async saveFile(file, documentText, suggestedName, documentKind, options) {
      if (!file?.path) return this.saveFileAs(documentText, suggestedName, documentKind);
      const saved = await bridge.saveFile(file.path, documentText, {
        expectedRevision: file.revision,
        expectedWorkingRevision: file.workingRevision, documentId: file.documentId,
        overwrite: options?.overwrite === true
      });
      if (saved.status === "conflict") {
        return {
          status: "conflict",
          file: { name: ensureRuntimeDocumentFileName(saved.file.name, documentKind), path: saved.file.path, revision: saved.revision },
          revision: saved.revision,
          modifiedAt: saved.modifiedAt
        };
      }
      return {
        status: "saved",
        file: { name: ensureRuntimeDocumentFileName(saved.file.name, documentKind), path: saved.file.path, revision: saved.revision, documentId: saved.snapshot?.documentId, workingRevision: saved.snapshot?.workingRevision }
      };
    },
    async saveFileAs(documentText, suggestedName, documentKind) {
      const saved = await bridge.saveFileAs(ensureRuntimeDocumentFileName(suggestedName, documentKind), documentText);
      if (!saved) return { status: "cancelled" };
      if (saved.status !== "saved") return { status: "cancelled" };
      return {
        status: "saved",
        file: { name: ensureRuntimeDocumentFileName(saved.file.name, documentKind), path: saved.file.path, revision: saved.revision, documentId: saved.snapshot?.documentId, workingRevision: saved.snapshot?.workingRevision }
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
    async createProjectDirectory(request) { return bridge.createProjectDirectory(request); },
    async renameProjectResource(request) { return bridge.renameProjectResource(request); },
    async moveProjectResources(request) { return bridge.moveProjectResources(request); },
    async reorderProjectResources(request) { return bridge.reorderProjectResources(request); },
    async copyProjectResources(request) { return bridge.copyProjectResources(request); },
    async importProjectResources(request) { return bridge.importProjectResources(request); },
    async deleteProjectResources(request) { return bridge.deleteProjectResources(request); },
    async showProjectResourceInFileManager(request) { return bridge.showProjectResourceInFileManager(request); },
    async pickImageAsset(file, context) {
      if (!file?.path) return { status: "needs-document" };
      const asset = await bridge.pickImageAsset(file.path, context);
      return asset ? electronImageAssetResult(asset) : { status: "cancelled" };
    },
    async importImageAssetPath(file, path, context) {
      if (!file?.path) return { status: "needs-document" };
      return electronImageAssetResult(await bridge.importImageAssetPath(file.path, path, context));
    },
    async importImageAssetFile(file, image, context) {
      if (!file?.path) return { status: "needs-document" };
      if (bridge.importImageAssetFile) return electronImageAssetResult(await bridge.importImageAssetFile(file.path, image, context));
      const bytes = Array.from(new Uint8Array(await image.arrayBuffer()));
      return electronImageAssetResult(await bridge.importImageAssetBytes(file.path, image.name, bytes, context));
    },
    async resolveImageAssetSrc(file, src, context) { return bridge.resolveImageAssetSrc(file?.path || null, src, context); },
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
    async startAgent(request) { return bridge.startAgent(request); }, async listAgentSessions(request) { return bridge.listAgentSessions(request); }, async listAgentInstances() { return bridge.listAgentInstances(); },
    async setAgentInstanceForeground(agentInstanceId, foreground) { await bridge.setAgentInstanceForeground(agentInstanceId, foreground); }, async deleteAgentSession(request) { await bridge.deleteAgentSession(request); },
    async sendAgentRpc(command) { return bridge.sendAgentRpc(command); }, async runAgentControl(command) { return bridge.runAgentControl(command); },
    async respondAgentExtensionUi(response) { await bridge.respondAgentExtensionUi(response); },
    async respondAgentHost(response) { await bridge.respondAgentHost(response); },
    async stopAgent(agentInstanceId) { await bridge.stopAgent(agentInstanceId); },
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
        browser: createElectronEmbeddedBrowserHandle(result.label || request.label, bridge)
      };
    }
  };
}

function mergeEditorSessionIntoState(state: Record<string, unknown> | null, editorSession: EditorDocumentSession | null) {
  if (!editorSession) return state;
  const active = editorSession.buffers.find((buffer) => buffer.id === editorSession.activeBufferId);
  if (!active) return { ...(state || {}), editorSession };
  return {
    ...(state || {}),
    documentKind: active.documentKind,
    source: active.content,
    layout: undefined,
    fileName: active.fileName,
    fileRef: active.fileRef ? { ...active.fileRef, revision: active.revision || undefined } : null,
    lastSavedDocument: active.savedContent,
    editorSession
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
