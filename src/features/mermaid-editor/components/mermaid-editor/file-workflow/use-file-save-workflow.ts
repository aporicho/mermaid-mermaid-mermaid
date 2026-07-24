import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import type { EditorDocumentBuffer } from "@/features/mermaid-editor/lib/editor-document-session";

import { createActiveFileSaveWorkflow } from "./create-active-file-save-workflow";
import { createDocumentBufferSaveWorkflow } from "./create-document-buffer-save-workflow";
import type { ShowFileWorkflowError, SyncWorkspaceForOpenedFile, UseEditorFileWorkflowArgs } from "./types";

export function useFileSaveWorkflow(
  args: UseEditorFileWorkflowArgs,
  dependencies: {
    persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
    showFileWorkflowError: ShowFileWorkflowError;
    syncWorkspaceForOpenedFile: SyncWorkspaceForOpenedFile;
  }
) {
  function requestConflictChoice(buffer: EditorDocumentBuffer) {
    return new Promise<"overwrite" | "reload" | "save-as" | "cancel">((resolve) => {
      args.setFileConflictPrompt({ fileName: buffer.fileName, path: buffer.fileRef?.path, resolve });
    });
  }

  function resolveFileConflictPrompt(choice: "overwrite" | "reload" | "save-as" | "cancel") {
    args.setFileConflictPrompt((current) => {
      current?.resolve(choice);
      return null;
    });
  }

  const active = createActiveFileSaveWorkflow(args, { ...dependencies, requestConflictChoice });
  const buffers = createDocumentBufferSaveWorkflow(args, {
    ...dependencies,
    requestConflictChoice,
    saveActiveDocument: active.saveMermaidFile,
    finishActiveSave: active.finishActiveSave
  });

  return {
    saveMermaidFile: active.saveMermaidFile,
    saveMermaidFileAs: active.saveMermaidFileAs,
    saveMermaidFileAsResult: active.saveMermaidFileAsResult,
    ...buffers,
    resolveFileConflictPrompt
  };
}
