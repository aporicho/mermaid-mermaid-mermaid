import type { ElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import type { RuntimeDocumentHubOperations } from "@/features/mermaid-editor/lib/editor-runtime/document-hub-types";

export function createElectronDocumentHubOperations(bridge: ElectronBridge): RuntimeDocumentHubOperations {
  return {
    async openDocumentSnapshot(path) { return bridge.openDocumentSnapshot({ path }); },
    async getDocumentSnapshot(request) { return bridge.getDocumentSnapshot(request); },
    async syncDocumentWorkingCopy(request) {
      return await bridge.syncDocumentWorkingCopy(request) as Awaited<ReturnType<RuntimeDocumentHubOperations["syncDocumentWorkingCopy"]>>;
    },
    async acquireDocumentEditLease(request) {
      return await bridge.acquireDocumentEditLease(request) as Awaited<ReturnType<RuntimeDocumentHubOperations["acquireDocumentEditLease"]>>;
    },
    async resolveDocumentConflict(request) { return bridge.resolveDocumentConflict(request); },
    async recreateDocument(request) { return bridge.recreateDocument(request); },
    async undoDocumentTransaction(request) { return bridge.undoDocumentTransaction(request); },
    async redoDocumentTransaction(request) { return bridge.redoDocumentTransaction(request); },
    async saveDocumentWorkingCopy(request) { return bridge.saveDocumentWorkingCopy(request); },
    async discardDocumentWorkingCopy(request) { return bridge.discardDocumentWorkingCopy(request); },
    async listenForDocumentHubEvents(handler) { return bridge.onDocumentHubEvent(handler); }
  };
}
