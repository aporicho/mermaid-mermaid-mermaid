import { describe, expect, it, vi } from "vitest";

import { createActiveFileSaveWorkflow } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/create-active-file-save-workflow";
import type { UseEditorFileWorkflowArgs } from "@/features/mermaid-editor/components/mermaid-editor/file-workflow/types";
import {
  createEditorDocumentBuffer,
  createEmptyEditorDocumentSession,
  createFileDocumentIdentity,
  upsertEditorDocumentBuffer
} from "@/features/mermaid-editor/lib/editor-document-session";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";

describe("active file save conflicts", () => {
  it("keeps the last accepted revision when a conflict is cancelled", async () => {
    const buffer = createEditorDocumentBuffer({
      identity: createFileDocumentIdentity("/project/notes.md"),
      documentKind: "markdown",
      fileName: "notes.md",
      fileRef: { name: "notes.md", path: "/project/notes.md" },
      content: "local",
      savedContent: "disk",
      revision: "revision-old"
    });
    const session = upsertEditorDocumentBuffer(createEmptyEditorDocumentSession("window"), buffer, { activate: true });
    const updateDocumentBuffer = vi.fn(() => session);
    const runtime = {
      saveFile: vi.fn(async () => ({
        status: "conflict" as const,
        file: { name: "notes.md", path: "/project/notes.md", revision: "revision-new" },
        revision: "revision-new",
        modifiedAt: 1
      }))
    } as unknown as EditorRuntime;
    const workflow = createActiveFileSaveWorkflow({
      runtime,
      documentKind: "markdown",
      fileRef: { name: "notes.md", path: "/project/notes.md", revision: "revision-old" },
      fileName: "notes.md",
      currentDocument: "local",
      recentFiles: [],
      isDirtyRef: { current: true },
      captureActiveDocumentBuffer: () => session,
      updateDocumentBuffer,
      flushSourceHistory: vi.fn()
    } as unknown as UseEditorFileWorkflowArgs, {
      persistStoredEditorDraft: vi.fn(async () => undefined),
      showFileWorkflowError: vi.fn(),
      syncWorkspaceForOpenedFile: vi.fn(async () => undefined),
      requestConflictChoice: vi.fn(async () => "cancel" as const)
    });

    await expect(workflow.saveMermaidFile()).resolves.toBe(false);
    expect(updateDocumentBuffer).toHaveBeenCalledWith(buffer.id, { status: "conflict" });
    expect(updateDocumentBuffer).not.toHaveBeenCalledWith(buffer.id, expect.objectContaining({ revision: "revision-new" }));
  });
});
