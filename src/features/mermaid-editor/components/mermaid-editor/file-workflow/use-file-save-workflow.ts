import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import { ensureEditorDocumentFileName } from "@/features/mermaid-editor/lib/editor-state";
import { hasBlockingDiagnostics } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { upsertRecentFile } from "@/features/mermaid-editor/lib/file-workflow";

import type {
  ShowFileWorkflowError,
  SyncWorkspaceForOpenedFile,
  UseEditorFileWorkflowArgs
} from "./types";
import { isAbortError } from "./utils";

export function useFileSaveWorkflow(
  args: UseEditorFileWorkflowArgs,
  {
    persistStoredEditorDraft,
    showFileWorkflowError,
    syncWorkspaceForOpenedFile
  }: {
    persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
    showFileWorkflowError: ShowFileWorkflowError;
    syncWorkspaceForOpenedFile: SyncWorkspaceForOpenedFile;
  }
) {
  const {
    runtime,
    documentKind,
    diagnostics,
    fileRef,
    currentDocument,
    fileName,
    recentFiles,
    isDirtyRef,
    setFileRef,
    setFileName,
    setLastSavedDocument,
    setRecentFiles,
    setFileWorkflowError,
    setStatus,
    flushSourceHistory,
    recordRecentAction
  } = args;

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileRef) {
      return saveMermaidFileAs();
    }
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要保存吗？")) return false;

    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName, documentKind);
      if (result.status === "cancelled") return false;
      const savedName = ensureEditorDocumentFileName(result.file.name, documentKind);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileRef(result.file);
      setFileName(savedName);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(`已保存 ${result.file.name}。`);
      recordRecentAction("document.save", { kind: "document" }, `保存 ${result.file.name}。`);
      try {
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return true;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function saveMermaidFileAsResult(): Promise<RuntimeFileRef | null> {
    flushSourceHistory();
    if (documentKind === "mermaid" && hasBlockingDiagnostics(diagnostics) && !window.confirm("当前 Mermaid 存在错误，仍要另存为吗？")) return null;
    const suggestedName = ensureEditorDocumentFileName(fileName, documentKind);
    try {
      const result = await runtime.saveFileAs(currentDocument, suggestedName, documentKind);
      if (result.status === "cancelled") return null;
      const savedName = ensureEditorDocumentFileName(result.file.name || suggestedName, documentKind);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileName(savedName);
      setFileRef(result.file);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(result.downloaded ? `已下载 ${result.file.name || suggestedName}。` : `已保存 ${result.file.name || suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, result.downloaded ? `下载 ${result.file.name || suggestedName}。` : `另存为 ${result.file.name || suggestedName}。`);
      try {
        await persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return result.file;
    } catch (error) {
      if (!isAbortError(error)) showFileWorkflowError(error, "保存文件失败。");
      return null;
    }
  }

  async function saveMermaidFileAs() {
    return Boolean(await saveMermaidFileAsResult());
  }

  return {
    saveMermaidFile,
    saveMermaidFileAs,
    saveMermaidFileAsResult
  };
}
