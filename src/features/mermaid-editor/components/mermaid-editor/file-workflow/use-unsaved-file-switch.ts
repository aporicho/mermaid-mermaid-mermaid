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
    setUnsavedPrompt
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

  async function prepareFileSwitch(targetName?: string) {
    if (!isDirtyRef.current) return true;
    const choice = await requestUnsavedChoice(targetName);
    if (choice === "cancel") return false;
    if (choice === "discard") return true;
    return saveMermaidFile();
  }

  async function prepareWindowClose() {
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
