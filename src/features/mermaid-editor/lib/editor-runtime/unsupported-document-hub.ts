import type { RuntimeDocumentHubOperations } from "@/features/mermaid-editor/lib/editor-runtime/document-hub-types";

export function createUnsupportedDocumentHubOperations(): RuntimeDocumentHubOperations {
  return {
    async openDocumentSnapshot() { return null; },
    async getDocumentSnapshot() { return null; },
    async syncDocumentWorkingCopy() { return { status: "missing" }; },
    async acquireDocumentEditLease() { return { status: "missing" }; },
    async resolveDocumentConflict() { return { status: "missing" }; },
    async recreateDocument() { return { status: "missing" }; },
    async undoDocumentTransaction() { return { status: "empty" }; },
    async redoDocumentTransaction() { return { status: "empty" }; },
    async saveDocumentWorkingCopy() { return { status: "missing" }; },
    async discardDocumentWorkingCopy() { return { status: "missing" }; },
    async listenForDocumentHubEvents() { return () => undefined; }
  };
}
