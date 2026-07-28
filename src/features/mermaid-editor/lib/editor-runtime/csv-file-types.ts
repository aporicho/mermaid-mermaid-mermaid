import type { RuntimeDocumentFormat } from "@/features/mermaid-editor/lib/editor-runtime/document-hub-types";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime/types";

export const MAX_RUNTIME_CSV_FILE_BYTES = Number.POSITIVE_INFINITY;

export type RuntimeCsvFileSnapshot = {
  file: RuntimeFileRef;
  text: string;
  revision: string;
  modifiedAt: number;
  format?: RuntimeDocumentFormat;
};

export type RuntimeReadCsvFileResult =
  | { status: "opened"; snapshot: RuntimeCsvFileSnapshot }
  | { status: "unsupported"; message: string };

export type RuntimeWriteCsvFileResult =
  | { status: "saved"; file: RuntimeFileRef; revision: string; modifiedAt: number }
  | { status: "conflict"; revision: string; modifiedAt: number }
  | { status: "unsupported"; message: string };

export type RuntimeCreateProjectTextFileResult =
  | { status: "created"; file: RuntimeFileRef; text: string }
  | { status: "exists"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeCsvFileTarget = {
  rootPath?: string;
  file: RuntimeFileRef;
};

export type RuntimeCsvFileOperations = {
  readCsvFile: (request: RuntimeCsvFileTarget) => Promise<RuntimeReadCsvFileResult>;
  writeCsvFile: (request: RuntimeCsvFileTarget & { text: string; expectedRevision: string; format?: RuntimeDocumentFormat }) => Promise<RuntimeWriteCsvFileResult>;
  createProjectTextFile: (request: { rootPath: string; fileName: string; kind: "csv" | "text"; text: string }) => Promise<RuntimeCreateProjectTextFileResult>;
};
