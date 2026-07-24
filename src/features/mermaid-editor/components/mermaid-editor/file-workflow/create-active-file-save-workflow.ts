import { ensureEditorDocumentFileName, type StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import type { EditorDocumentBuffer } from "@/features/mermaid-editor/lib/editor-document-session";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { upsertRecentFile } from "@/features/mermaid-editor/lib/file-workflow";

import type { ShowFileWorkflowError, SyncWorkspaceForOpenedFile, UseEditorFileWorkflowArgs } from "./types";
import { isAbortError } from "./utils";

type ActiveFileSaveDependencies = {
  persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
  showFileWorkflowError: ShowFileWorkflowError;
  syncWorkspaceForOpenedFile: SyncWorkspaceForOpenedFile;
  requestConflictChoice: (buffer: EditorDocumentBuffer) => Promise<"overwrite" | "reload" | "save-as" | "cancel">;
};

export function createActiveFileSaveWorkflow(args: UseEditorFileWorkflowArgs, dependencies: ActiveFileSaveDependencies) {
  const {
    runtime, documentKind, fileRef, currentDocument, fileName, recentFiles, isDirtyRef,
    captureActiveDocumentBuffer, markActiveDocumentBufferSaved, updateDocumentBuffer,
    reloadDocumentFromDisk, setFileRef, setFileName, setLastSavedDocument, setRecentFiles,
    setFileWorkflowError, setStatus, flushSourceHistory, recordRecentAction
  } = args;

  async function saveMermaidFile() {
    flushSourceHistory();
    if (!fileRef) return saveMermaidFileAs();
    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName, documentKind);
      if (result.status === "cancelled") return false;
      if (result.status === "conflict") {
        const session = captureActiveDocumentBuffer();
        const buffer = session.buffers.find((candidate) => candidate.id === session.activeBufferId);
        if (!buffer) return false;
        updateDocumentBuffer(buffer.id, { status: "conflict" });
        const choice = await dependencies.requestConflictChoice({ ...buffer, status: "conflict" });
        if (choice === "cancel") return false;
        if (choice === "save-as") return saveMermaidFileAs();
        if (choice === "reload") return reloadActiveBuffer(buffer);
        return saveActiveDocument({ overwrite: true });
      }
      return finishActiveSave(result.file);
    } catch (error) {
      if (!isAbortError(error)) dependencies.showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function saveActiveDocument(options?: { overwrite?: boolean }) {
    if (!fileRef) return saveMermaidFileAs();
    try {
      const result = await runtime.saveFile(fileRef, currentDocument, fileName, documentKind, options);
      return result.status === "saved" ? finishActiveSave(result.file) : false;
    } catch (error) {
      if (!isAbortError(error)) dependencies.showFileWorkflowError(error, "保存文件失败。");
      return false;
    }
  }

  async function finishActiveSave(savedFile: RuntimeFileRef) {
    const savedName = ensureEditorDocumentFileName(savedFile.name, documentKind);
    const nextRecentFiles = upsertRecentFile(recentFiles, savedFile);
    setFileRef(savedFile);
    setFileName(savedName);
    setLastSavedDocument(currentDocument);
    isDirtyRef.current = false;
    const nextSession = markActiveDocumentBufferSaved(savedFile, currentDocument);
    setRecentFiles((current) => upsertRecentFile(current, savedFile));
    setFileWorkflowError(null);
    setStatus(`已保存 ${savedFile.name}。`);
    recordRecentAction("document.save", { kind: "document" }, `保存 ${savedFile.name}。`);
    try {
      await dependencies.persistStoredEditorDraft({ documentKind, fileRef: savedFile, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument, editorSession: nextSession });
    } catch {
      // File save succeeded; draft persistence is best-effort.
    }
    void dependencies.syncWorkspaceForOpenedFile(savedFile, { announce: false, revealExplorer: false });
    return true;
  }

  async function saveMermaidFileAsResult(): Promise<RuntimeFileRef | null> {
    flushSourceHistory();
    const suggestedName = ensureEditorDocumentFileName(fileName, documentKind);
    try {
      const result = await runtime.saveFileAs(currentDocument, suggestedName, documentKind);
      if (result.status !== "saved") return null;
      const savedName = ensureEditorDocumentFileName(result.file.name || suggestedName, documentKind);
      const nextRecentFiles = upsertRecentFile(recentFiles, result.file);
      setFileName(savedName);
      setFileRef(result.file);
      setLastSavedDocument(currentDocument);
      isDirtyRef.current = false;
      const nextSession = markActiveDocumentBufferSaved(result.file, currentDocument);
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      setFileWorkflowError(null);
      setStatus(result.downloaded ? `已下载 ${result.file.name || suggestedName}。` : `已保存 ${result.file.name || suggestedName}。`);
      recordRecentAction("document.save-as", { kind: "document" }, result.downloaded ? `下载 ${result.file.name || suggestedName}。` : `另存为 ${result.file.name || suggestedName}。`);
      try {
        await dependencies.persistStoredEditorDraft({ documentKind, fileRef: result.file, fileName: savedName, recentFiles: nextRecentFiles, lastSavedDocument: currentDocument, editorSession: nextSession });
      } catch {
        // File save succeeded; draft persistence is best-effort.
      }
      void dependencies.syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return result.file;
    } catch (error) {
      if (!isAbortError(error)) dependencies.showFileWorkflowError(error, "保存文件失败。");
      return null;
    }
  }

  async function saveMermaidFileAs() {
    return Boolean(await saveMermaidFileAsResult());
  }

  async function reloadActiveBuffer(buffer: EditorDocumentBuffer) {
    if (!buffer.fileRef?.path) return false;
    try {
      const opened = await runtime.openFilePath(buffer.fileRef.path);
      if (opened.status !== "opened") return false;
      updateDocumentBuffer(buffer.id, { content: opened.text, savedContent: opened.text, revision: opened.file.revision || null, status: "clean", fileRef: opened.file });
      reloadDocumentFromDisk(opened.text, opened.file.name, opened.file);
      return true;
    } catch (error) {
      dependencies.showFileWorkflowError(error, "重新载入磁盘文件失败。");
      return false;
    }
  }

  return { saveMermaidFile, saveMermaidFileAs, saveMermaidFileAsResult, finishActiveSave };
}
