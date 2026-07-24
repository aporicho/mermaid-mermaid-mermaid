import { useCallback } from "react";

import { normalizeFileWorkflowError } from "@/features/mermaid-editor/lib/file-workflow";

import { useEditorDocumentLifecycle } from "./use-editor-document-lifecycle";
import { useEditorDraftPersistence } from "./use-editor-draft-persistence";
import type { UseEditorFileWorkflowArgs } from "./file-workflow/types";
import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import { useFileDropWorkflow } from "./file-workflow/use-file-drop-workflow";
import { useFileOpenWorkflow } from "./file-workflow/use-file-open-workflow";
import { useFileSaveWorkflow } from "./file-workflow/use-file-save-workflow";
import { useProjectWorkspaceWorkflow } from "./file-workflow/use-project-workspace-workflow";
import { useUnsavedFileSwitch } from "./file-workflow/use-unsaved-file-switch";

export type { FileConflictChoice, FileConflictPromptState, FileOpenSource, UnsavedPromptState } from "./file-workflow/types";

export function useEditorFileWorkflow(args: UseEditorFileWorkflowArgs) {
  const { setFileWorkflowError } = args;
  const showFileWorkflowError = useCallback((error: unknown, fallbackMessage = "文件操作失败。") => {
    setFileWorkflowError(normalizeFileWorkflowError(error, fallbackMessage));
  }, [setFileWorkflowError]);

  const {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft
  } = useEditorDraftPersistence(args);

  const {
    syncWorkspaceForOpenedFile,
    openProjectFolder,
    refreshProjectWorkspace,
    closeProjectWorkspace
  } = useProjectWorkspaceWorkflow(args, {
    persistStoredEditorDraft: persistStoredEditorDraft as (overrides?: StoredEditorDraftOverrides) => Promise<void>,
    showFileWorkflowError
  });

  const {
    saveMermaidFile,
    saveMermaidFileAs,
    saveMermaidFileAsResult,
    saveAllDocuments,
    saveDocumentBufferById,
    saveAutoSaveEligibleDocuments,
    handleExternalDocumentChange,
    resolveFileConflictPrompt
  } = useFileSaveWorkflow(args, {
    persistStoredEditorDraft: persistStoredEditorDraft as (overrides?: StoredEditorDraftOverrides) => Promise<void>,
    showFileWorkflowError,
    syncWorkspaceForOpenedFile
  });

  const {
    resolveUnsavedPrompt,
    prepareFileSwitch,
    prepareWindowClose
  } = useUnsavedFileSwitch(args, {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft,
    saveAllDocuments
  });

  const {
    applyLoadedDocument,
    applyStoredEditorState,
    newMermaidFile,
    newMarkdownFile,
    newCanvasFile
  } = useEditorDocumentLifecycle({
    ...args,
    showFileWorkflowError,
    syncWorkspaceForOpenedFile,
    prepareFileSwitch,
    persistStoredEditorDraft: persistStoredEditorDraft as (overrides?: StoredEditorDraftOverrides) => Promise<void>
  });

  const {
    openMermaidFile,
    openFallbackFile,
    openRuntimeFileRequest,
    openRecentFile,
    openProjectFile
  } = useFileOpenWorkflow(args, {
    applyLoadedDocument,
    prepareFileSwitch,
    showFileWorkflowError
  });

  const {
    updateBrowserFileDragFeedback,
    handleBrowserFileDragLeave,
    handleBrowserFileDrop,
    importImageAssetRequest,
    handleRuntimeFileDropRequest
  } = useFileDropWorkflow(args, {
    applyLoadedDocument,
    openRuntimeFileRequest,
    prepareFileSwitch,
    saveMermaidFileAsResult,
    showFileWorkflowError
  });

  return {
    showFileWorkflowError,
    resolveUnsavedPrompt,
    resolveFileConflictPrompt,
    prepareWindowClose,
    applyLoadedDocument,
    applyStoredEditorState,
    openMermaidFile,
    newMermaidFile,
    newMarkdownFile,
    newCanvasFile,
    openFallbackFile,
    openRuntimeFileRequest,
    openProjectFolder,
    refreshProjectWorkspace,
    closeProjectWorkspace,
    updateBrowserFileDragFeedback,
    handleBrowserFileDragLeave,
    handleBrowserFileDrop,
    importImageAssetRequest,
    handleRuntimeFileDropRequest,
    openRecentFile,
    openProjectFile,
    saveMermaidFile,
    saveMermaidFileAs,
    saveMermaidFileAsResult,
    saveAllDocuments,
    saveDocumentBufferById,
    saveAutoSaveEligibleDocuments,
    handleExternalDocumentChange
  };
}
