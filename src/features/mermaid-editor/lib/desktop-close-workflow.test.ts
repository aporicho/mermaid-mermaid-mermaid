import { describe, expect, it } from "vitest";

import {
  WINDOW_CLOSE_TARGET_NAME,
  cleanCloseDocument,
  resolveWindowCloseChoice,
  unsavedPromptDescription
} from "@/features/mermaid-editor/lib/desktop-close-workflow";

describe("desktop close workflow", () => {
  it("keeps the window open when closing is cancelled", () => {
    expect(resolveWindowCloseChoice("cancel")).toEqual({
      shouldClose: false,
      shouldSave: false,
      shouldPreserve: false,
      shouldDiscard: false
    });
  });

  it("requires a successful save before closing on save choice", () => {
    expect(resolveWindowCloseChoice("save")).toMatchObject({ shouldClose: false, shouldSave: true });
    expect(resolveWindowCloseChoice("save", true)).toMatchObject({ shouldClose: true, shouldSave: true });
  });

  it("closes and discards drafts when changes are discarded", () => {
    expect(resolveWindowCloseChoice("discard")).toEqual({
      shouldClose: true,
      shouldSave: false,
      shouldPreserve: false,
      shouldDiscard: true
    });
  });

  it("closes while preserving hot-exit drafts", () => {
    expect(resolveWindowCloseChoice("preserve")).toEqual({
      shouldClose: true,
      shouldSave: false,
      shouldPreserve: true,
      shouldDiscard: false
    });
  });

  it("uses close-specific unsaved copy for the desktop window", () => {
    expect(unsavedPromptDescription(WINDOW_CLOSE_TARGET_NAME)).toContain("关闭应用前");
    expect(unsavedPromptDescription("next.mmd")).toContain("切换文件前");
  });

  it("falls back to a clean default document when there is no saved document", () => {
    expect(cleanCloseDocument("", "fallback")).toBe("fallback");
    expect(cleanCloseDocument("saved", "fallback")).toBe("saved");
  });
});
