import type { RuntimeDocumentHubEvent, RuntimeDocumentSnapshot } from "@/features/mermaid-editor/lib/editor-runtime/document-hub-types";

export type ElectronOpenedFile = {
  name: string;
  path: string;
  text: string;
  revision: string;
  modifiedAt?: number;
  workingRevision?: string;
  documentId?: string;
  syncState?: string;
  saveState?: string;
};

export type ElectronSavedFile = { name: string; path: string };

export type ElectronDocumentWriteResult =
  | { status: "saved"; file: ElectronSavedFile; revision: string; modifiedAt?: number; snapshot?: RuntimeDocumentSnapshot }
  | { status: "conflict"; file: ElectronSavedFile; revision: string; modifiedAt?: number; snapshot?: RuntimeDocumentSnapshot };

export type ElectronDocumentHubBridge = {
  openFile: () => Promise<ElectronOpenedFile | null>;
  openFilePath: (path: string) => Promise<ElectronOpenedFile>;
  saveFile: (path: string, text: string, options?: {
    expectedRevision?: string;
    expectedWorkingRevision?: string;
    documentId?: string;
    overwrite?: boolean;
  }) => Promise<ElectronDocumentWriteResult>;
  saveFileAs: (suggestedName: string, text: string) => Promise<ElectronDocumentWriteResult | null>;
  getDocumentSnapshot: (request: { documentId?: string; path?: string }) => Promise<RuntimeDocumentSnapshot | null>;
  openDocumentSnapshot: (request: { path: string }) => Promise<RuntimeDocumentSnapshot | null>;
  syncDocumentWorkingCopy: (request: Record<string, unknown>) => Promise<unknown>;
  acquireDocumentEditLease: (request: { documentId?: string; path?: string }) => Promise<unknown>;
  resolveDocumentConflict: (request: Record<string, unknown>) => Promise<unknown>;
  recreateDocument: (request: { documentId: string }) => Promise<unknown>;
  undoDocumentTransaction: (request: { documentId: string }) => Promise<unknown>;
  redoDocumentTransaction: (request: { documentId: string }) => Promise<unknown>;
  onDocumentHubEvent: (handler: (event: RuntimeDocumentHubEvent) => void) => () => void;
};
