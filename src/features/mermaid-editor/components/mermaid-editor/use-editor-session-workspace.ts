import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";

import { useEditorAutoSave } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-auto-save";
import type { useEditorDocumentSession } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-document-session";
import type { EditorPreferences } from "@/features/mermaid-editor/lib/editor-preferences";
import type { DetachedMarkdownWindow } from "@/features/mermaid-editor/lib/workspace-panels";

type DocumentSessionController = ReturnType<typeof useEditorDocumentSession>;

export function useEditorSessionWorkspace({
  documentSession,
  preferences,
  saveAutoSaveEligibleDocuments,
  setDetachedMarkdownWindows
}: {
  documentSession: DocumentSessionController;
  preferences: EditorPreferences;
  saveAutoSaveEligibleDocuments: () => Promise<boolean>;
  setDetachedMarkdownWindows: Dispatch<SetStateAction<DetachedMarkdownWindow[]>>;
}) {
  const autoSaveState = useMemo(() => {
    const eligible = documentSession.session.buffers.filter((buffer) => buffer.content !== buffer.savedContent && Boolean(buffer.fileRef));
    return {
      dirty: eligible.length > 0,
      revisionKey: eligible.map((buffer) => `${buffer.id}:${buffer.updatedAt}`).join("|")
    };
  }, [documentSession.session.buffers]);
  useEditorAutoSave({
    preferences,
    dirty: autoSaveState.dirty,
    fileBacked: autoSaveState.dirty,
    documentRevisionKey: autoSaveState.revisionKey,
    save: saveAutoSaveEligibleDocuments
  });

  const findDocumentBuffer = documentSession.findFileBuffer;
  useEffect(() => {
    setDetachedMarkdownWindows((current) => {
      let changed = false;
      const next = current.map((window) => {
        const buffer = findDocumentBuffer(window.file);
        if (!buffer || (buffer.content === window.value && buffer.savedContent === window.savedValue && (buffer.revision || undefined) === window.file.revision)) return window;
        changed = true;
        return {
          ...window,
          file: { ...window.file, revision: buffer.revision || undefined },
          value: buffer.content,
          savedValue: buffer.savedContent
        };
      });
      return changed ? next : current;
    });
  }, [documentSession.session, findDocumentBuffer, setDetachedMarkdownWindows]);

}
