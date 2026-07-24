import { useMemo } from "react";

import type { ExplorerResourceStatus } from "@/features/mermaid-editor/components/explorer-panel";
import type { EditorDocumentBuffer } from "@/features/mermaid-editor/lib/editor-document-session";

export function useProjectResourceStatuses(buffers: readonly EditorDocumentBuffer[]) {
  return useMemo<Record<string, ExplorerResourceStatus>>(() => {
    const statuses: Record<string, ExplorerResourceStatus> = {};
    for (const buffer of buffers) {
      const path = buffer.fileRef?.path;
      if (!path || buffer.status === "clean") continue;
      statuses[path] = buffer.status;
    }
    return statuses;
  }, [buffers]);
}
