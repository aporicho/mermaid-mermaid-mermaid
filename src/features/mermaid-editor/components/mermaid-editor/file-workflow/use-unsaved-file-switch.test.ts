import { describe, expect, it, vi } from "vitest";

import type { UseEditorFileWorkflowArgs } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/types";
import { useUnsavedFileSwitch } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/use-unsaved-file-switch";
import {
  createEditorDocumentBuffer,
  createEmptyEditorDocumentSession,
  createFileDocumentIdentity,
  upsertEditorDocumentBuffer
} from "@/features/mermaid-editor/lib/editor-document-session";
import type { StoredEditorDraftOverrides } from "@/features/mermaid-editor/lib/editor-state";

describe("useUnsavedFileSwitch", () => {
  it("switches documents without prompting while retaining the dirty buffer", async () => {
    const session = dirtySession();
    const setUnsavedPrompt = vi.fn();
    const captureActiveDocumentBuffer = vi.fn(() => session);
    const workflow = createWorkflow({ session, setUnsavedPrompt, captureActiveDocumentBuffer });

    await expect(workflow.prepareFileSwitch()).resolves.toBe(true);
    expect(captureActiveDocumentBuffer).toHaveBeenCalledOnce();
    expect(setUnsavedPrompt).not.toHaveBeenCalled();
  });

  it("keeps dirty documents as recoverable drafts when closing", async () => {
    const session = dirtySession();
    const persistStoredEditorDraft = vi.fn(async () => undefined);
    const workflow = createWorkflow({
      session,
      persistStoredEditorDraft,
      choice: "preserve"
    });

    await expect(workflow.prepareWindowClose()).resolves.toBe(true);
    expect(persistStoredEditorDraft).toHaveBeenCalledWith({ editorSession: session });
  });

  it("closes only after every dirty document saves successfully", async () => {
    const session = dirtySession();
    const flushLinkedFileWrites = vi.fn(async () => true);
    const saveAllDocuments = vi.fn(async () => true);
    const workflow = createWorkflow({
      session,
      choice: "save",
      flushLinkedFileWrites,
      saveAllDocuments
    });

    await expect(workflow.prepareWindowClose()).resolves.toBe(true);
    expect(flushLinkedFileWrites).toHaveBeenCalledOnce();
    expect(saveAllDocuments).toHaveBeenCalledOnce();
  });
});

function createWorkflow({
  session,
  choice = "cancel",
  setUnsavedPrompt = vi.fn((next) => {
    if (typeof next !== "function") next?.resolve(choice);
  }),
  captureActiveDocumentBuffer = vi.fn(() => session),
  persistStoredEditorDraft = vi.fn(async () => undefined),
  flushLinkedFileWrites = vi.fn(async () => true),
  saveAllDocuments = vi.fn(async () => true)
}: {
  session: ReturnType<typeof dirtySession>;
  choice?: "save" | "preserve" | "discard" | "cancel";
  setUnsavedPrompt?: ReturnType<typeof vi.fn>;
  captureActiveDocumentBuffer?: ReturnType<typeof vi.fn>;
  persistStoredEditorDraft?: (overrides?: StoredEditorDraftOverrides) => Promise<void>;
  flushLinkedFileWrites?: ReturnType<typeof vi.fn>;
  saveAllDocuments?: () => Promise<boolean>;
}) {
  // The controller is a pure factory despite its historical hook-style name.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useUnsavedFileSwitch({
    isDirtyRef: { current: true },
    setUnsavedPrompt,
    flushLinkedFileWrites,
    discardLinkedFileWrites: vi.fn(async () => undefined),
    captureActiveDocumentBuffer,
    discardAllDocumentChanges: vi.fn(() => session)
  } as unknown as UseEditorFileWorkflowArgs, {
    persistStoredEditorDraft,
    persistDiscardedCloseDraft: vi.fn(async () => undefined),
    saveAllDocuments
  });
}

function dirtySession() {
  const session = createEmptyEditorDocumentSession("test-window");
  const buffer = createEditorDocumentBuffer({
    identity: createFileDocumentIdentity("/project/notes.md"),
    documentKind: "markdown",
    fileName: "notes.md",
    fileRef: { name: "notes.md", path: "/project/notes.md" },
    content: "# Local edit",
    savedContent: "# Disk"
  });
  return upsertEditorDocumentBuffer(session, buffer, { activate: true });
}
