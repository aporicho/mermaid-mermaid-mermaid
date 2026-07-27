import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import { editorDocumentBufferIsDirty, type EditorDocumentBuffer, type EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";
import { upsertRecentFile } from "@/features/mermaid-editor/lib/file-workflow";

import type { ShowFileWorkflowError, SyncWorkspaceForOpenedFile, UseEditorFileWorkflowArgs } from "./types";
import { isAbortError } from "./utils";

type BufferSaveDependencies = {
  persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
  showFileWorkflowError: ShowFileWorkflowError;
  syncWorkspaceForOpenedFile: SyncWorkspaceForOpenedFile;
  requestConflictChoice: (buffer: EditorDocumentBuffer) => Promise<"overwrite" | "reload" | "save-as" | "cancel">;
  saveActiveDocument: () => Promise<boolean>;
};

export function createDocumentBufferSaveWorkflow(args: UseEditorFileWorkflowArgs, dependencies: BufferSaveDependencies) {
  const {
    runtime, captureActiveDocumentBuffer, markDocumentBufferSaved,
    updateDocumentBuffer, reloadDocumentFromDisk, setRecentFiles
  } = args;

  async function reloadBufferFromDisk(buffer: EditorDocumentBuffer, active: boolean) {
    if (!buffer.fileRef?.path) return false;
    try {
      const opened = await runtime.openFilePath(buffer.fileRef.path);
      if (opened.status !== "opened") return false;
      updateDocumentBuffer(buffer.id, {
        content: opened.text, savedContent: opened.text, revision: opened.file.revision || null,
        status: "clean", fileRef: opened.file
      });
      if (active) reloadDocumentFromDisk(opened.text, opened.file.name, opened.file);
      return true;
    } catch (error) {
      dependencies.showFileWorkflowError(error, "重新载入磁盘文件失败。");
      return false;
    }
  }

  async function saveDocumentBuffer(buffer: EditorDocumentBuffer) {
    const file: RuntimeFileRef | null = buffer.fileRef ? { ...buffer.fileRef, revision: buffer.revision || undefined } : null;
    try {
      let result = file?.path
        ? await runtime.saveFile(file, buffer.content, buffer.fileName, buffer.documentKind)
        : await runtime.saveFileAs(buffer.content, buffer.fileName, buffer.documentKind);
      if (result.status === "cancelled") return false;
      if (result.status === "conflict") {
        updateDocumentBuffer(buffer.id, { status: "conflict" });
        const choice = await dependencies.requestConflictChoice({ ...buffer, status: "conflict" });
        if (choice === "cancel") return false;
        if (choice === "reload") return reloadBufferFromDisk(buffer, false);
        if (choice === "save-as") result = await runtime.saveFileAs(buffer.content, buffer.fileName, buffer.documentKind);
        else result = await runtime.saveFile({ ...file!, revision: result.revision }, buffer.content, buffer.fileName, buffer.documentKind, { overwrite: true });
        if (result.status !== "saved") return false;
      }
      markDocumentBufferSaved(buffer.id, result.file, buffer.content);
      setRecentFiles((current) => upsertRecentFile(current, result.file));
      void dependencies.syncWorkspaceForOpenedFile(result.file, { announce: false, revealExplorer: false });
      return true;
    } catch (error) {
      if (!isAbortError(error)) dependencies.showFileWorkflowError(error, `保存 ${buffer.fileName} 失败。`);
      updateDocumentBuffer(buffer.id, { status: "error" });
      return false;
    }
  }

  async function saveAllDocuments() {
    const captured = captureActiveDocumentBuffer();
    const dirtyBuffers = orderedDirtyBuffers(captured);
    for (const buffer of dirtyBuffers) {
      if (buffer.id === captured.activeBufferId) {
        if (!(await dependencies.saveActiveDocument())) return false;
      } else if (!(await saveDocumentBuffer(buffer))) return false;
    }
    try {
      await dependencies.persistStoredEditorDraft({ editorSession: captureActiveDocumentBuffer() });
    } catch {
      // Disk files are already saved; session persistence remains best-effort.
    }
    return true;
  }

  async function saveDocumentBufferById(bufferId: string) {
    const captured = captureActiveDocumentBuffer();
    const buffer = captured.buffers.find((candidate) => candidate.id === bufferId);
    if (!buffer) return false;
    return buffer.id === captured.activeBufferId ? dependencies.saveActiveDocument() : saveDocumentBuffer(buffer);
  }

  async function saveAutoSaveEligibleDocuments() {
    const captured = captureActiveDocumentBuffer();
    const buffers = orderedDirtyBuffers(captured).filter((buffer) => Boolean(buffer.fileRef));
    for (const buffer of buffers) {
      if (buffer.id === captured.activeBufferId) {
        if (!(await dependencies.saveActiveDocument())) return false;
      } else if (!(await saveDocumentBuffer(buffer))) return false;
    }
    return true;
  }

  return { saveAllDocuments, saveDocumentBufferById, saveAutoSaveEligibleDocuments };
}

function orderedDirtyBuffers(session: EditorDocumentSession) {
  return session.openOrder
    .map((id) => session.buffers.find((buffer) => buffer.id === id))
    .filter((buffer): buffer is EditorDocumentBuffer => Boolean(buffer && editorDocumentBufferIsDirty(buffer)));
}
