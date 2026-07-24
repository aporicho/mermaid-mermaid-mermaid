import { describe, expect, it } from "vitest";

import {
  activateEditorDocumentBuffer,
  closeEditorDocumentBuffer,
  createEditorDocumentBuffer,
  createEmptyEditorDocumentSession,
  createFileDocumentIdentity,
  createUntitledDocumentIdentity,
  editorDocumentBufferId,
  editorDocumentBufferIsDirty,
  migrateLegacySingleDocumentDraft,
  normalizeEditorDocumentSession,
  upsertEditorDocumentBuffer
} from "@/features/mermaid-editor/lib/editor-document-session";

describe("editor document session", () => {
  it("creates stable file and untitled identities", () => {
    const windowsFile = createFileDocumentIdentity("C:\\Project\\Notes.md");
    expect(windowsFile).toEqual({ kind: "file", path: "c:/project/notes.md" });
    expect(editorDocumentBufferId(windowsFile)).toBe("file:c:/project/notes.md");
    expect(editorDocumentBufferId(createUntitledDocumentIdentity("draft-1"))).toBe("untitled:draft-1");
  });

  it("derives clean and dirty states from the saved content baseline", () => {
    const clean = createEditorDocumentBuffer({
      identity: createUntitledDocumentIdentity("clean"),
      documentKind: "markdown",
      fileName: "document.md",
      content: "same",
      savedContent: "same",
      status: "conflict"
    });
    const dirty = createEditorDocumentBuffer({
      identity: createUntitledDocumentIdentity("dirty"),
      documentKind: "markdown",
      fileName: "document.md",
      content: "changed",
      savedContent: "saved"
    });
    const conflict = createEditorDocumentBuffer({ ...dirty, status: "conflict" });

    expect(clean.status).toBe("clean");
    expect(editorDocumentBufferIsDirty(clean)).toBe(false);
    expect(dirty.status).toBe("dirty");
    expect(editorDocumentBufferIsDirty(dirty)).toBe(true);
    expect(conflict.status).toBe("conflict");
  });

  it("normalizes open order, duplicate buffers, stale active ids and serializable file refs", () => {
    const normalized = normalizeEditorDocumentSession({
      version: 99,
      windowId: " window-1 ",
      buffers: [
        {
          id: "old-notes-id",
          identity: { kind: "file", path: "/project/notes.md" },
          documentKind: "markdown",
          fileName: "notes.md",
          fileRef: { name: "notes.md", path: "/project/notes.md", handle: { omitted: true } },
          content: "changed",
          savedContent: "saved",
          revision: "sha256:one",
          status: "conflict",
          updatedAt: 12.4
        },
        {
          identity: { kind: "untitled", id: "draft" },
          documentKind: "mermaid",
          fileName: "diagram.mmd",
          content: "flowchart LR",
          savedContent: ""
        },
        {
          identity: { kind: "file", path: "/project/notes.md" },
          documentKind: "markdown",
          fileName: "duplicate.md"
        },
        { identity: { kind: "unknown" } }
      ],
      openOrder: ["missing", "untitled:draft", "old-notes-id", "untitled:draft"],
      activeBufferId: "old-notes-id"
    });

    expect(normalized).not.toBeNull();
    expect(normalized).toMatchObject({
      version: 1,
      windowId: "window-1",
      openOrder: ["untitled:draft", "file:/project/notes.md"],
      activeBufferId: "file:/project/notes.md"
    });
    expect(normalized?.buffers).toHaveLength(2);
    expect(normalized?.buffers[0]).toMatchObject({
      id: "file:/project/notes.md",
      fileRef: { name: "notes.md", path: "/project/notes.md" },
      revision: "sha256:one",
      status: "conflict",
      updatedAt: 12
    });
  });

  it("rejects malformed sessions without inventing window or document identities", () => {
    expect(normalizeEditorDocumentSession(null)).toBeNull();
    expect(normalizeEditorDocumentSession({ windowId: "window-1" })).toBeNull();
    expect(normalizeEditorDocumentSession({ windowId: "", buffers: [] })).toBeNull();
  });

  it("migrates the legacy single-file draft into an active file buffer", () => {
    const session = migrateLegacySingleDocumentDraft({
      documentKind: "markdown",
      source: "# Local edit",
      lastSavedDocument: "# Saved",
      fileName: "notes.md",
      fileRef: { name: "notes.md", path: "/project/notes.md", handle: { browserOnly: true } },
      revision: "rev-1"
    }, { windowId: "window-1" });

    expect(session.activeBufferId).toBe("file:/project/notes.md");
    expect(session.openOrder).toEqual(["file:/project/notes.md"]);
    expect(session.buffers[0]).toMatchObject({
      identity: { kind: "file", path: "/project/notes.md" },
      documentKind: "markdown",
      content: "# Local edit",
      savedContent: "# Saved",
      revision: "rev-1",
      status: "dirty"
    });
  });

  it("migrates an unsaved legacy draft with a caller-owned untitled identity", () => {
    const session = migrateLegacySingleDocumentDraft({
      source: "flowchart LR\n  A --> B",
      fileName: "draft.mmd"
    }, { windowId: "window-2", untitledId: "restored-7" });

    expect(session.activeBufferId).toBe("untitled:restored-7");
    expect(session.buffers[0]).toMatchObject({
      identity: { kind: "untitled", id: "restored-7" },
      status: "dirty"
    });
  });

  it("upserts, activates and closes buffers without mutating their open order", () => {
    const first = createEditorDocumentBuffer({
      identity: createUntitledDocumentIdentity("one"),
      documentKind: "mermaid",
      fileName: "one.mmd"
    });
    const second = createEditorDocumentBuffer({
      identity: createUntitledDocumentIdentity("two"),
      documentKind: "markdown",
      fileName: "two.md"
    });
    let session = createEmptyEditorDocumentSession("window-1");
    session = upsertEditorDocumentBuffer(session, first);
    session = upsertEditorDocumentBuffer(session, second);
    session = upsertEditorDocumentBuffer(session, { ...first, content: "updated" });

    expect(session.openOrder).toEqual([first.id, second.id]);
    expect(session.activeBufferId).toBe(first.id);
    expect(session.buffers.find((buffer) => buffer.id === first.id)?.content).toBe("updated");

    session = activateEditorDocumentBuffer(session, second.id);
    expect(session.activeBufferId).toBe(second.id);
    session = closeEditorDocumentBuffer(session, second.id);
    expect(session.openOrder).toEqual([first.id]);
    expect(session.activeBufferId).toBe(first.id);
  });
});
