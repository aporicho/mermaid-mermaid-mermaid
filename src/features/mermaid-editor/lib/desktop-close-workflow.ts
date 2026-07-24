export const WINDOW_CLOSE_TARGET_NAME = "关闭应用";

export type UnsavedPromptChoice = "save" | "preserve" | "discard" | "cancel";

export type WindowCloseDecision = {
  shouldClose: boolean;
  shouldSave: boolean;
  shouldPreserve: boolean;
  shouldDiscard: boolean;
};

export function unsavedPromptDescription(targetName?: string) {
  return targetName === WINDOW_CLOSE_TARGET_NAME ? "关闭应用前需要先决定如何处理当前修改。" : "切换文件前需要先决定如何处理当前修改。";
}

export function resolveWindowCloseChoice(choice: UnsavedPromptChoice, saveSucceeded = false): WindowCloseDecision {
  if (choice === "cancel") {
    return { shouldClose: false, shouldSave: false, shouldPreserve: false, shouldDiscard: false };
  }

  if (choice === "preserve") {
    return { shouldClose: true, shouldSave: false, shouldPreserve: true, shouldDiscard: false };
  }

  if (choice === "discard") {
    return { shouldClose: true, shouldSave: false, shouldPreserve: false, shouldDiscard: true };
  }

  return { shouldClose: saveSucceeded, shouldSave: true, shouldPreserve: false, shouldDiscard: false };
}

export function cleanCloseDocument(lastSavedDocument: string | null | undefined, fallbackDocument: string) {
  return lastSavedDocument?.trim() ? lastSavedDocument : fallbackDocument;
}
