import {
  WINDOW_CLOSE_TARGET_NAME,
  resolveWindowCloseChoice,
  type UnsavedPromptChoice
} from "@/features/mermaid-editor/lib/desktop-close-workflow";
import { editorDocumentBufferIsDirty, type EditorDocumentSession } from "@/features/mermaid-editor/lib/editor-document-session";
import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";
import type { UnsavedPromptState, UseEditorFileWorkflowArgs } from "./types";
export function useUnsavedFileSwitch(
  {
    isDirtyRef,
    setUnsavedPrompt,
    flushLinkedFileWrites,
    discardLinkedFileWrites,
    captureActiveDocumentBuffer,
    discardAllDocumentChanges
  }: UseEditorFileWorkflowArgs,
  {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft,
    saveAllDocuments
  }: {
    persistStoredEditorDraft: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
    persistDiscardedCloseDraft: (editorSession?: EditorDocumentSession) => Promise<void>;
    saveAllDocuments: () => Promise<boolean>;
  }
) {

  function requestUnsavedChoice(targetNames: string[]): Promise<UnsavedPromptChoice> {
    return new Promise((resolve) => {
      setUnsavedPrompt({
        title: targetNames.length === 1 ? `保存对 ${targetNames[0]} 的修改？` : `保存 ${targetNames.length} 个文件的修改？`,
        description: "关闭此画布窗口前选择处理方式。",
        targetName: WINDOW_CLOSE_TARGET_NAME,
        targetNames,
        mode: "window-close",
        resolve
      } satisfies UnsavedPromptState);
    });
  }

  function resolveUnsavedPrompt(choice: UnsavedPromptChoice) {
    setUnsavedPrompt((current) => {
      current?.resolve(choice);
      return null;
    });
  }

  async function prepareFileSwitch() {
    captureActiveDocumentBuffer();
    return true;
  }

  async function prepareWindowClose() {
    const captured = captureActiveDocumentBuffer();
    const dirtyBuffers = captured.openOrder
      .map((id) => captured.buffers.find((buffer) => buffer.id === id))
      .filter((buffer) => buffer && editorDocumentBufferIsDirty(buffer));
    if (!dirtyBuffers.length && !isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(dirtyBuffers.map((buffer) => buffer!.fileName));
    const decision = resolveWindowCloseChoice(choice);
    if (decision.shouldSave) {
      if (flushLinkedFileWrites && !(await flushLinkedFileWrites())) return false;
      const saved = await saveAllDocuments();
      return resolveWindowCloseChoice(choice, saved).shouldClose;
    }

    if (decision.shouldPreserve) {
      try {
        await persistStoredEditorDraft({ editorSession: captured });
      } catch {
        return false;
      }
    }

    if (decision.shouldDiscard) {
      await discardLinkedFileWrites?.();
      const cleanSession = discardAllDocumentChanges();
      try {
        await persistDiscardedCloseDraft(cleanSession);
      } catch {
        // The explicit discard decision should not be blocked by best-effort state cleanup.
      }
    }

    return decision.shouldClose;
  }

  return {
    resolveUnsavedPrompt,
    prepareFileSwitch,
    prepareWindowClose
  };
}
