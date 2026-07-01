import { useEffect, useRef } from "react";

import { incrementPerformanceCounter } from "@/features/mermaid-editor/lib/editor-performance";
import { useEditorDraftPersistence, type UseEditorDraftPersistenceArgs } from "@/features/mermaid-editor/components/mermaid-editor/use-editor-draft-persistence";

type UseEditorDraftAutosaveArgs = UseEditorDraftPersistenceArgs & {
  ready: boolean;
};

export function useEditorDraftAutosave({ ready, ...draftPersistenceArgs }: UseEditorDraftAutosaveArgs) {
  const storageWriteTimerRef = useRef<number | null>(null);
  const { persistStoredEditorDraft } = useEditorDraftPersistence(draftPersistenceArgs);

  useEffect(() => {
    if (!ready) return;
    if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);

    storageWriteTimerRef.current = window.setTimeout(() => {
      incrementPerformanceCounter("local-storage-write");
      void persistStoredEditorDraft();
      storageWriteTimerRef.current = null;
    }, 160);

    return () => {
      if (storageWriteTimerRef.current) window.clearTimeout(storageWriteTimerRef.current);
    };
  }, [persistStoredEditorDraft, ready]);
}
