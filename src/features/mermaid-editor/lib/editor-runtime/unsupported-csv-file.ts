import type { RuntimeCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";

export function createUnsupportedCsvFileOperations(hostLabel: string): RuntimeCsvFileOperations {
  const unsupported = () => Promise.resolve({ status: "unsupported" as const, message: `${hostLabel}暂不支持项目 CSV 文件操作。` });
  return {
    readCsvFile: unsupported,
    writeCsvFile: unsupported,
    createProjectTextFile: unsupported
  };
}
