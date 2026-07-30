import type { RuntimeMarkdownExportOperations } from "@/features/mermaid-editor/lib/editor-runtime/markdown-export-types";

export function createUnsupportedMarkdownExportOperations(): RuntimeMarkdownExportOperations {
  return {
    async exportMarkdownFolder() {
      return { status: "unsupported", message: "网页版无法导出本地 Markdown 资源文件夹，请使用桌面版。" };
    }
  };
}
