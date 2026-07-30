import type { ElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import type { RuntimeMarkdownExportOperations } from "@/features/mermaid-editor/lib/editor-runtime/markdown-export-types";

export function createElectronMarkdownExportOperations(bridge: ElectronBridge): RuntimeMarkdownExportOperations {
  return {
    async exportMarkdownFolder(request) { return bridge.exportMarkdownFolder(request); }
  };
}
