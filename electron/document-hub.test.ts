import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createDocumentHub, mergeText } = require("./document-hub.cjs");
const { readDocumentFile, writeDocumentFile } = require("./document-files.cjs");

class FakeWatcher extends EventEmitter {
  close = vi.fn(async () => undefined);
}

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("document hub", () => {
  it("validates disk content every time a clean document is opened", async () => {
    const { hub, filePath, first } = await fixture("# Old\n");
    const opened = await hub.open(first, filePath);
    await writeFile(filePath, "# New\n", "utf8");

    const reopened = await hub.open(first, filePath);

    expect(opened.content).toBe("# Old\n");
    expect(reopened.content).toBe("# New\n");
    expect(reopened.diskRevision).not.toBe(opened.diskRevision);
    await hub.closeAll();
  });

  it("shares a working copy across windows and rejects stale writers", async () => {
    const { hub, filePath, first, second, events } = await fixture("one\n");
    const firstSnapshot = await hub.open(first, filePath);
    await hub.open(second, filePath);

    const update = await hub.syncWorkingCopy(first, {
      documentId: firstSnapshot.documentId,
      content: "two\n",
      expectedWorkingRevision: firstSnapshot.workingRevision
    });
    const stale = await hub.syncWorkingCopy(second, {
      documentId: firstSnapshot.documentId,
      content: "three\n",
      expectedWorkingRevision: firstSnapshot.workingRevision
    });

    expect(update.status).toBe("updated");
    expect(stale.status).toBe("stale");
    expect(stale.snapshot.content).toBe("two\n");
    expect(events).toContainEqual(expect.objectContaining({ target: 2, payload: expect.objectContaining({ reason: "working-copy" }) }));
    await hub.closeAll();
  });

  it("does not let a stale view save over the shared working copy", async () => {
    const { hub, filePath, first, second } = await fixture("base\n");
    const firstSnapshot = await hub.open(first, filePath);
    const secondSnapshot = await hub.open(second, filePath);
    await hub.syncWorkingCopy(first, {
      documentId: firstSnapshot.documentId,
      content: "first\n",
      expectedWorkingRevision: firstSnapshot.workingRevision
    });

    const staleSave = await hub.save(second, {
      path: filePath,
      text: "second\n",
      expectedRevision: secondSnapshot.diskRevision,
      expectedWorkingRevision: secondSnapshot.workingRevision
    });

    expect(staleSave.status).toBe("conflict");
    expect(staleSave.snapshot.content).toBe("first\n");
    expect(await readFile(filePath, "utf8")).toBe("base\n");
    await hub.closeAll();
  });

  it("reattaches its file watcher when a clean document is reopened", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mmm-document-hub-"));
    directories.push(directory);
    const filePath = join(directory, "notes.md");
    await writeFile(filePath, "content\n", "utf8");
    const watchers: FakeWatcher[] = [];
    const hub = createDocumentHub({
      readDocument: readDocumentFile,
      writeDocument: writeDocumentFile,
      watch: () => {
        const watcher = new FakeWatcher();
        watchers.push(watcher);
        return watcher;
      },
      send: vi.fn()
    });

    await hub.open(webContents(1), filePath);
    await hub.releaseSubscriber(1);
    await hub.open(webContents(2), filePath);

    expect(watchers).toHaveLength(2);
    expect(watchers[0].close).toHaveBeenCalledOnce();
    await hub.closeAll();
  });

  it("merges non-overlapping local and external edits and immediately saves", async () => {
    const { hub, filePath, first } = await fixture("a\nb\nc\n");
    const opened = await hub.open(first, filePath);
    await hub.syncWorkingCopy(first, {
      documentId: opened.documentId,
      content: "A\nb\nc\n",
      expectedWorkingRevision: opened.workingRevision
    });
    await writeFile(filePath, "a\nb\nC\n", "utf8");

    const refreshed = await hub.refreshPath(filePath);

    expect(refreshed.content).toBe("A\nb\nC\n");
    expect(refreshed.syncState).toBe("clean");
    expect(await readFile(filePath, "utf8")).toBe("A\nb\nC\n");
    await hub.closeAll();
  });

  it("keeps overlapping edits for explicit per-hunk resolution", async () => {
    const { hub, filePath, first } = await fixture("base\nnext\n");
    const opened = await hub.open(first, filePath);
    await hub.syncWorkingCopy(first, {
      documentId: opened.documentId,
      content: "local\nnext\n",
      expectedWorkingRevision: opened.workingRevision
    });
    await writeFile(filePath, "disk\nnext\n", "utf8");

    const conflicted = await hub.refreshPath(filePath);
    const hunk = conflicted.conflict.conflicts[0];
    const resolvedContent = conflicted.conflict.resolutionTemplate.replace(hunk.token, hunk.local);
    const resolved = await hub.resolveConflict(first, {
      documentId: opened.documentId,
      content: resolvedContent,
      diskRevision: conflicted.conflict.diskRevision
    });

    expect(conflicted.syncState).toBe("conflict");
    expect(resolved.status).toBe("saved");
    expect(await readFile(filePath, "utf8")).toBe("local\nnext\n");
    await hub.closeAll();
  });

  it("keeps content and path after an external deletion", async () => {
    const { hub, filePath, first } = await fixture("keep me\n");
    const opened = await hub.open(first, filePath);
    await rm(filePath);

    const deleted = await hub.refreshPath(filePath);

    expect(deleted.documentId).toBe(opened.documentId);
    expect(deleted.content).toBe("keep me\n");
    expect(deleted.file.path).toBe(filePath);
    expect(deleted.syncState).toBe("deleted");
    await hub.closeAll();
  });

  it("rebases a restored dirty draft onto the current disk content", async () => {
    const { hub, filePath, first } = await fixture("a\nb\nC\n");

    const restored = await hub.syncWorkingCopy(first, {
      documentId: "document-id-from-a-previous-app-process",
      path: filePath,
      baseContent: "a\nb\nc\n",
      content: "A\nb\nc\n"
    });

    expect(restored.status).toBe("updated");
    expect(restored.snapshot.content).toBe("A\nb\nC\n");
    expect(restored.snapshot.savedContent).toBe("a\nb\nC\n");
    expect(restored.snapshot.dirty).toBe(true);
    await hub.closeAll();
  });
});

describe("three-way text merge", () => {
  it("combines separate line edits", () => {
    expect(mergeText("a\nb\nc\n", "A\nb\nc\n", "a\nb\nC\n")).toMatchObject({
      text: "A\nb\nC\n",
      conflicts: []
    });
  });

  it("reports overlapping line edits", () => {
    const result = mergeText("a\nb\n", "A\nb\n", "disk\nb\n");
    expect(result.text).toBe("A\nb\n");
    expect(result.conflicts).toHaveLength(1);
  });

  it("builds a per-hunk resolution template while retaining safe edits", () => {
    const result = mergeText("a\nb\nc\n", "A\nb\nc\n", "disk\nb\nC\n");
    const hunk = result.conflicts[0];
    expect(result.resolutionTemplate.replace(hunk.token, hunk.local)).toBe("A\nb\nC\n");
    expect(result.resolutionTemplate.replace(hunk.token, hunk.disk)).toBe("disk\nb\nC\n");
  });
});

async function fixture(content: string) {
  const directory = await mkdtemp(join(tmpdir(), "mmm-document-hub-"));
  directories.push(directory);
  const filePath = join(directory, "notes.md");
  await writeFile(filePath, content, "utf8");
  const events: Array<{ target: number; payload: unknown }> = [];
  const hub = createDocumentHub({
    readDocument: readDocumentFile,
    writeDocument: writeDocumentFile,
    watch: () => new FakeWatcher(),
    send: (target: { id: number }, payload: unknown) => events.push({ target: target.id, payload })
  });
  const first = webContents(1);
  const second = webContents(2);
  return { directory, events, filePath, first, hub, second };
}

function webContents(id: number) {
  return { id, isDestroyed: () => false };
}
