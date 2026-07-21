import {
  WINDOW_CLOSE_TARGET_NAME,
  resolveWindowCloseChoice,
  unsavedPromptDescription,
  type UnsavedPromptChoice
} from "@/features/mermaid-editor/lib/desktop-close-workflow";
import type { UnsavedPromptState, UseEditorFileWorkflowArgs } from "./types";
export function useUnsavedFileSwitch(
  {
    isDirtyRef,
    setUnsavedPrompt,
    flushLinkedFileWrites,
    discardLinkedFileWrites
  }: UseEditorFileWorkflowArgs,
  {
    persistDiscardedCloseDraft,
    saveMermaidFile
  }: {
    persistDiscardedCloseDraft: () => Promise<void>;
    saveMermaidFile: () => Promise<boolean>;
  }
) {
  function requestUnsavedChoice(targetName?: string): Promise<UnsavedPromptChoice> {
    if (!isDirtyRef.current) return Promise.resolve("discard");
    return new Promise((resolve) => {
      setUnsavedPrompt({
        title: "当前文件有未保存修改",
        description: unsavedPromptDescription(targetName),
        targetName,
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

  async function prepareLinkedFileWrites(targetName?: string) {
    if (!flushLinkedFileWrites) return true;
    let overwriteConflicts = false;
    while (true) {
      const flushed = await flushLinkedFileWrites({ overwriteConflicts });
      overwriteConflicts = false;
      if (flushed) return true;
      const choice = await new Promise<UnsavedPromptChoice>((resolve) => setUnsavedPrompt({
        title: "CSV 表格尚未写回",
        description: "CSV 文件已在外部发生变化或写入失败。重试保存会以画布内容覆盖外部版本；也可以丢弃本次画布编辑或取消当前操作。",
        targetName,
        resolve
      }));
      if (choice === "cancel") return false;
      if (choice === "discard") {
        await discardLinkedFileWrites?.();
        return true;
      }
      overwriteConflicts = true;
    }
  }

  async function prepareFileSwitch(targetName?: string) {
    if (!(await prepareLinkedFileWrites(targetName))) return false;
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(targetName);
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    return saveMermaidFile();
  }

  async function prepareWindowClose() {
    if (!(await prepareLinkedFileWrites(WINDOW_CLOSE_TARGET_NAME))) return false;
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(WINDOW_CLOSE_TARGET_NAME);
    const decision = resolveWindowCloseChoice(choice);
    if (decision.shouldSave) {
      const saved = await saveMermaidFile();
      return resolveWindowCloseChoice(choice, saved).shouldClose;
    }

    if (decision.shouldPersistDiscard) {
      try {
        await persistDiscardedCloseDraft();
      } catch {
        // Closing should not be blocked by best-effort draft cleanup.
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
