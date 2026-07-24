import type { ElectronBridge } from "@/features/mermaid-editor/lib/editor-runtime/electron-bridge";
import type { RuntimeCsvFileOperations } from "@/features/mermaid-editor/lib/editor-runtime/csv-file-types";

export function createElectronCsvFileOperations(bridge: ElectronBridge): RuntimeCsvFileOperations {
  return {
    async readCsvFile(request) {
      if (!request.rootPath || !request.file.path) return unsupported();
      const snapshot = await bridge.readCsvFile({ rootPath: request.rootPath, path: request.file.path });
      return { status: "opened", snapshot };
    },
    async writeCsvFile(request) {
      if (!request.rootPath || !request.file.path) return unsupported();
      return bridge.writeCsvFile({
        rootPath: request.rootPath,
        path: request.file.path,
        text: request.text,
        expectedRevision: request.expectedRevision
      });
    },
    createProjectTextFile(request) {
      return bridge.createProjectTextFile(request);
    }
  };
}

function unsupported() {
  return { status: "unsupported" as const, message: "Electron 项目 CSV 操作需要项目根目录和文件路径。" };
}
