import type { RuntimeCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";
import type { RuntimeMarkdownFoldOperations } from "@/features/mermaid-editor/lib/editor-runtime/markdown-fold-types";

export function createUnsupportedProjectFileOperations(hostLabel: string): RuntimeCsvFileOperations & RuntimeMarkdownFoldOperations {
  const unsupportedCsv = () => Promise.resolve({ status: "unsupported" as const, message: `${hostLabel}暂不支持项目 CSV 文件操作。` });
  const unsupportedMarkdownFolds = () => Promise.resolve({ status: "unsupported" as const, message: `${hostLabel}不支持项目 Markdown 折叠状态持久化。` });
  return {
    readCsvFile: unsupportedCsv,
    writeCsvFile: unsupportedCsv,
    createProjectTextFile: unsupportedCsv,
    readMarkdownFoldState: unsupportedMarkdownFolds,
    writeMarkdownFoldState: unsupportedMarkdownFolds,
    moveMarkdownFoldState: unsupportedMarkdownFolds
  };
}
