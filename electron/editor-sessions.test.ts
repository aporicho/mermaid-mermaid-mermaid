import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// This test intentionally loads the CommonJS module used directly by Electron.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createEditorSessionStore } = require("./editor-sessions.cjs") as {
  createEditorSessionStore: (filePath: string) => {
    claim: (excluded?: Set<string>) => Promise<{ windowId: string } | null>;
    readAll: () => Promise<{ sessions: Record<string, { session: { windowId: string; activeBufferId?: string } }> }>;
    write: (session: { windowId: string; activeBufferId?: string }) => Promise<void>;
  };
};

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("editor session store", () => {
  it("merges serialized writes from multiple canvas windows", async () => {
    const directory = await makeDirectory();
    const store = createEditorSessionStore(path.join(directory, "editor-sessions.json"));

    await Promise.all([
      store.write({ windowId: "window-a", activeBufferId: "a" }),
      store.write({ windowId: "window-b", activeBufferId: "b" })
    ]);

    const saved = await store.readAll();
    expect(Object.keys(saved.sessions).sort()).toEqual(["window-a", "window-b"]);
  });

  it("claims the latest session not already used by another window", async () => {
    const directory = await makeDirectory();
    const store = createEditorSessionStore(path.join(directory, "editor-sessions.json"));
    await store.write({ windowId: "window-a" });
    await store.write({ windowId: "window-b" });

    await expect(store.claim(new Set(["window-b"]))).resolves.toMatchObject({ windowId: "window-a" });
  });
});

async function makeDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "mmm-sessions-"));
  directories.push(directory);
  return directory;
}
