import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime/types";

export type RuntimeHubDocumentKind = "mermaid" | "markdown" | "csv" | "html" | "text";
export type RuntimeDocumentEncoding = "utf8" | "utf16le" | "utf16be" | "gb18030";
export type RuntimeDocumentFormat = {
  encoding: RuntimeDocumentEncoding;
  bom: boolean;
  lineEnding: "lf" | "crlf";
};
export type RuntimeDocumentSyncState = "clean" | "dirty" | "conflict" | "deleted";
export type RuntimeDocumentSaveState = "idle" | "saving" | "error";

export type RuntimeDocumentConflictHunk = {
  start: number;
  end: number;
  base: string;
  local: string;
  disk: string;
  token: string;
  kind?: "text" | "canvas-node-position" | "canvas-node-layout" | "canvas-edge-layout" | "canvas-setting";
  label?: string;
};

export type RuntimeDocumentConflict = {
  baseContent: string;
  localContent: string;
  diskContent: string;
  diskRevision: string | null;
  conflicts: RuntimeDocumentConflictHunk[];
  resolutionTemplate: string;
};

export type RuntimeDocumentSnapshot = {
  documentId: string;
  file: RuntimeFileRef;
  kind: RuntimeHubDocumentKind;
  content: string;
  savedContent: string;
  workingVersion: number;
  workingRevision: string;
  baseRevision: string | null;
  diskRevision: string | null;
  modifiedAt: number;
  format?: RuntimeDocumentFormat;
  exists: boolean;
  syncState: RuntimeDocumentSyncState;
  saveState: RuntimeDocumentSaveState;
  dirty: boolean;
  leaseOwnerId: number | null;
  canUndo: boolean;
  canRedo: boolean;
  error: string | null;
  conflict: RuntimeDocumentConflict | null;
};

export type RuntimeDocumentHubEvent = {
  reason: "working-copy" | "saving" | "saved" | "save-error" | "disk" | "merged" | "conflict" | "deleted" | "lease" | "undo" | "redo" | string;
  sourceId?: number;
  snapshot: RuntimeDocumentSnapshot;
};

export type RuntimeDocumentHubOperations = {
  openDocumentSnapshot: (path: string) => Promise<RuntimeDocumentSnapshot | null>;
  getDocumentSnapshot: (request: { documentId?: string; path?: string }) => Promise<RuntimeDocumentSnapshot | null>;
  syncDocumentWorkingCopy: (request: {
    documentId?: string;
    path?: string;
    content: string;
    baseContent?: string;
    baseRevision?: string;
    expectedWorkingRevision?: string;
    label?: string;
    origin?: "view" | "canvas" | "csv" | "agent";
  }) => Promise<{ status: "updated" | "unchanged" | "stale" | "missing"; snapshot?: RuntimeDocumentSnapshot }>;
  acquireDocumentEditLease: (request: { documentId?: string; path?: string }) => Promise<{ status: "acquired" | "missing"; documentId?: string; leaseOwnerId?: number }>;
  resolveDocumentConflict: (request: { documentId: string; content: string; diskRevision: string | null }) => Promise<unknown>;
  recreateDocument: (request: { documentId: string }) => Promise<unknown>;
  undoDocumentTransaction: (request: { documentId: string }) => Promise<unknown>;
  redoDocumentTransaction: (request: { documentId: string }) => Promise<unknown>;
  saveDocumentWorkingCopy: (request: {
    documentId?: string;
    path: string;
    text?: string;
    expectedRevision?: string;
    expectedWorkingRevision?: string;
    overwrite?: boolean;
    format?: RuntimeDocumentFormat;
  }) => Promise<unknown>;
  discardDocumentWorkingCopy: (request: { documentId?: string; path?: string }) => Promise<unknown>;
  listenForDocumentHubEvents: (handler: (event: RuntimeDocumentHubEvent) => void) => Promise<() => void>;
};
