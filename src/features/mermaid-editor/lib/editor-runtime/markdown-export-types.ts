export type RuntimeMarkdownExportWarning = {
  reference: string;
  reason: string;
};

export type RuntimeMarkdownExportRequest = {
  sourcePath: string;
  projectRoot?: string;
  documentText?: string;
};

export type RuntimeMarkdownExportResult =
  | {
      status: "exported";
      directoryPath: string;
      copiedFiles: number;
      warnings: RuntimeMarkdownExportWarning[];
    }
  | { status: "cancelled" }
  | { status: "unsupported"; message: string }
  | { status: "error"; message: string };

export type RuntimeMarkdownExportOperations = {
  exportMarkdownFolder: (request: RuntimeMarkdownExportRequest) => Promise<RuntimeMarkdownExportResult>;
};
