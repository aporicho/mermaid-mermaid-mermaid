import { useState, type Dispatch, type SetStateAction } from "react";

import type { useEditorDocumentSession } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-session";
import { useEditorSessionWorkspace } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-session-workspace";
import type { ApplyLoadedDocument } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/types";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { EditorRuntime, RuntimeDocumentSnapshot, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import type { DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type DocumentSessionController = ReturnType<typeof useEditorDocumentSession>;

export function useDocumentHubWorkspace({
  runtime,
  documentSession,
  preferences,
  saveAutoSaveEligibleDocuments,
  setDetachedMarkdownWindows,
  setFileRef,
  setFileName,
  applyLoadedDocument,
  setStatus,
  showFileWorkflowError
}: {
  runtime: EditorRuntime;
  documentSession: DocumentSessionController;
  preferences: EditorPreferences;
  saveAutoSaveEligibleDocuments: () => Promise<boolean>;
  setDetachedMarkdownWindows: Dispatch<SetStateAction<DetachedMarkdownWindow[]>>;
  setFileRef: Dispatch<SetStateAction<RuntimeFileRef | null>>;
  setFileName: Dispatch<SetStateAction<string>>;
  applyLoadedDocument: ApplyLoadedDocument;
  setStatus: (message: string) => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
}) {
  const [documentConflict, setDocumentConflict] = useState<RuntimeDocumentSnapshot | null>(null);
  useEditorSessionWorkspace({
    documentSession,
    runtime,
    preferences,
    saveAutoSaveEligibleDocuments,
    setDetachedMarkdownWindows,
    applyRemoteDocument: (text, file, savedContent, status) => applyLoadedDocument(text, file.name, file, "watch", { savedContent, status }),
    onStatus: setStatus,
    onDocumentConflict: setDocumentConflict,
    onActiveFileMetadata: (file) => {
      setFileName(file.name);
      setFileRef((current) => (
        current?.path === file.path || Boolean(current?.documentId && current.documentId === file.documentId)
      ) ? { ...current, ...file } : current);
    }
  });

  async function resolveDocumentConflict(content: string, diskRevision: string | null) {
    if (!documentConflict) return;
    try {
      await runtime.resolveDocumentConflict({ documentId: documentConflict.documentId, content, diskRevision });
      const latest = await runtime.getDocumentSnapshot({ documentId: documentConflict.documentId });
      if (!latest) return setDocumentConflict(null);
      if (latest.conflict) return setDocumentConflict(latest);
      const buffer = documentSession.findFileBuffer(latest.file);
      if (buffer) documentSession.updateBuffer(buffer.id, {
        content: latest.content,
        savedContent: latest.savedContent,
        revision: latest.diskRevision,
        status: latest.dirty ? "dirty" : "clean",
        fileRef: latest.file
      });
      if (documentSession.sessionRef.current.activeBufferId === buffer?.id) {
        applyLoadedDocument(latest.content, latest.file.name, latest.file, "watch", { savedContent: latest.savedContent, status: latest.dirty ? "dirty" : "clean" });
      }
      setDocumentConflict(null);
      setStatus(`已合并并保存 ${latest.file.name}。`);
    } catch (error) {
      showFileWorkflowError(error, "保存合并结果失败。");
    }
  }

  return { documentConflict, resolveDocumentConflict };
}
