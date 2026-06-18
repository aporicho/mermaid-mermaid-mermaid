export const WINDOW_CLOSE_TARGET_NAME = "关闭应用";

export type UnsavedPromptChoice = "save" | "discard" | "cancel";

export type WindowCloseDecision = {
  shouldClose: boolean;
  shouldSave: boolean;
  shouldPersistDiscard: boolean;
};

export function unsavedPromptDescription(targetName?: string) {
  return targetName === WINDOW_CLOSE_TARGET_NAME ? "关闭应用前需要先决定如何处理当前修改。" : "切换文件前需要先决定如何处理当前修改。";
}

export function resolveWindowCloseChoice(choice: UnsavedPromptChoice, saveSucceeded = false): WindowCloseDecision {
  if (choice === "cancel") {
    return { shouldClose: false, shouldSave: false, shouldPersistDiscard: false };
  }

  if (choice === "discard") {
    return { shouldClose: true, shouldSave: false, shouldPersistDiscard: true };
  }

  return { shouldClose: saveSucceeded, shouldSave: true, shouldPersistDiscard: false };
}

export function cleanCloseDocument(lastSavedDocument: string | null | undefined, fallbackDocument: string) {
  return lastSavedDocument?.trim() ? lastSavedDocument : fallbackDocument;
}
