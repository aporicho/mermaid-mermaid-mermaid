import type { DocumentKind } from "@/features/mermaid-editor/lib/document-kind";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime/types";

export type RuntimeProjectFileKind = DocumentKind | "csv" | "html";

export type RuntimeCreateProjectFileRequest = {
  rootPath: string;
  directoryPath: string;
  fileName: string;
  kind: RuntimeProjectFileKind;
  text: string;
};

export type RuntimeCreateProjectFileResult =
  | { status: "created"; file: RuntimeFileRef; text: string }
  | { status: "exists"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };

export type RuntimeMoveProjectFileRequest = {
  rootPath: string;
  sourcePath: string;
  targetDirectoryPath: string;
};

export type RuntimeMoveProjectFileResult =
  | { status: "moved"; file: RuntimeFileRef; sourcePath: string }
  | { status: "exists" | "noop"; file: RuntimeFileRef }
  | { status: "unsupported"; message: string };
