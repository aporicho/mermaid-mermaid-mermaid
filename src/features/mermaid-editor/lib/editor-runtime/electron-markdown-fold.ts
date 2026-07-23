import type { RuntimeMarkdownFoldMoveResult, RuntimeMarkdownFoldOperations, RuntimeMarkdownFoldRequest, RuntimeMarkdownFoldWriteResult } from "@/features/mermaid-editor/lib/editor-runtime/markdown-fold-types";
import type { MarkdownFoldSnapshot } from "@/features/mermaid-editor/lib/markdown-fold-state";

export type ElectronMarkdownFoldBridge = {
  readMarkdownFoldState: (request: RuntimeMarkdownFoldRequest) => Promise<MarkdownFoldSnapshot | null>;
  writeMarkdownFoldState: (request: RuntimeMarkdownFoldRequest & { snapshot: MarkdownFoldSnapshot }) => Promise<RuntimeMarkdownFoldWriteResult>;
  moveMarkdownFoldState: (request: { rootPath: string; sourcePath: string; targetPath: string }) => Promise<RuntimeMarkdownFoldMoveResult>;
};

export function createElectronMarkdownFoldOperations(bridge: ElectronMarkdownFoldBridge): RuntimeMarkdownFoldOperations {
  return {
    async readMarkdownFoldState(request) {
      return { status: "loaded", snapshot: await bridge.readMarkdownFoldState(request) };
    },
    async writeMarkdownFoldState(request) {
      return bridge.writeMarkdownFoldState(request);
    },
    async moveMarkdownFoldState(request) {
      return bridge.moveMarkdownFoldState(request);
    }
  };
}
