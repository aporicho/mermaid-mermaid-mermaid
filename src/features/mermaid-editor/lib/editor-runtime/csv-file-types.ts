import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime/types";

export const MAX_RUNTIME_CSV_FILE_BYTES = 1_048_576;

export type RuntimeCsvFileSnapshot = {
  file: RuntimeFileRef;
  text: string;
  revision: string;
  modifiedAt: number;
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
  writeCsvFile: (request: RuntimeCsvFileTarget & { text: string; expectedRevision: string }) => Promise<RuntimeWriteCsvFileResult>;
  createProjectTextFile: (request: { rootPath: string; fileName: string; kind: "csv"; text: string }) => Promise<RuntimeCreateProjectTextFileResult>;
};
