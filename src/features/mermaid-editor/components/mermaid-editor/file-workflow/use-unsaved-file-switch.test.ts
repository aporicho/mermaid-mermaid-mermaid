import { describe, expect, it, vi } from "vitest";

import type { UseEditorFileWorkflowArgs } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/types";
import { useUnsavedFileSwitch } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/use-unsaved-file-switch";

describe("useUnsavedFileSwitch", () => {
  it("waits for linked CSV writes even when the Mermaid document is clean", async () => {
    const flushLinkedFileWrites = vi.fn(async () => false);
    const saveMermaidFile = vi.fn(async () => true);
    const setUnsavedPrompt = vi.fn((prompt) => {
      if (typeof prompt !== "function") prompt?.resolve("cancel");
    });
    const workflow = useUnsavedFileSwitch({
      isDirtyRef: { current: false },
      setUnsavedPrompt,
      flushLinkedFileWrites
    } as unknown as UseEditorFileWorkflowArgs, {
      persistDiscardedCloseDraft: vi.fn(async () => undefined),
      saveMermaidFile
    });

    await expect(workflow.prepareFileSwitch("other.mmd")).resolves.toBe(false);
    await expect(workflow.prepareWindowClose()).resolves.toBe(false);
    expect(flushLinkedFileWrites).toHaveBeenCalledTimes(2);
    expect(setUnsavedPrompt).toHaveBeenCalledTimes(2);
    expect(saveMermaidFile).not.toHaveBeenCalled();
  });

  it("only requests conflict overwrite after the user chooses save", async () => {
    const flushLinkedFileWrites = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const setUnsavedPrompt = vi.fn((prompt) => {
      if (typeof prompt !== "function") prompt?.resolve("save");
    });
    const workflow = useUnsavedFileSwitch({
      isDirtyRef: { current: false },
      setUnsavedPrompt,
      flushLinkedFileWrites
    } as unknown as UseEditorFileWorkflowArgs, {
      persistDiscardedCloseDraft: vi.fn(async () => undefined),
      saveMermaidFile: vi.fn(async () => true)
    });

    await expect(workflow.prepareFileSwitch("other.mmd")).resolves.toBe(true);
    expect(flushLinkedFileWrites).toHaveBeenNthCalledWith(1, { overwriteConflicts: false });
    expect(flushLinkedFileWrites).toHaveBeenNthCalledWith(2, { overwriteConflicts: true });
  });
});
