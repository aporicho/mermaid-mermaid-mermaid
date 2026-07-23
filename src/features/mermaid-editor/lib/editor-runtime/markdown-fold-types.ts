import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";

export type RuntimeMarkdownFoldRequest = {
  rootPath: string;
  documentPath: string;
};

export type RuntimeMarkdownFoldReadResult =
  | { status: "loaded"; snapshot: MarkdownFoldSnapshot | null }
  | { status: "unsupported"; message: string };

export type RuntimeMarkdownFoldWriteResult =
  | { status: "saved" }
  | { status: "unsupported"; message: string };

export type RuntimeMarkdownFoldMoveResult =
  | { status: "moved" | "noop" }
  | { status: "unsupported"; message: string };

export type RuntimeMarkdownFoldOperations = {
  readMarkdownFoldState: (request: RuntimeMarkdownFoldRequest) => Promise<RuntimeMarkdownFoldReadResult>;
  writeMarkdownFoldState: (request: RuntimeMarkdownFoldRequest & { snapshot: MarkdownFoldSnapshot }) => Promise<RuntimeMarkdownFoldWriteResult>;
  moveMarkdownFoldState: (request: { rootPath: string; sourcePath: string; targetPath: string }) => Promise<RuntimeMarkdownFoldMoveResult>;
};
