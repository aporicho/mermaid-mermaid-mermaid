import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createProjectFileWatcher, ignoredProjectPath, mergeChangeKind } = require("./project-file-watcher.cjs") as {
  createProjectFileWatcher: (options: { send: (webContents: FakeWebContents, payload: unknown) => void; watch: (path: string) => FakeWatcher; batchDelayMs?: number }) => {
    setTargets: (webContents: FakeWebContents, request: { rootPath?: string; extraPaths?: string[] }) => Promise<unknown>;
    removeSubscriber: (id: number) => Promise<void>;
    closeAll: () => Promise<void>;
  };
  ignoredProjectPath: (root: string, candidate: string) => boolean;
  mergeChangeKind: (previous: "added" | "changed" | "removed" | undefined, next: "added" | "changed" | "removed") => "added" | "changed" | "removed";
};

type FakeWebContents = { id: number; isDestroyed: () => boolean };

class FakeWatcher extends EventEmitter {
  close = vi.fn(async () => undefined);
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("project file watcher", () => {
  it("batches atomic replacement events and ignores generated directories", async () => {
    vi.useFakeTimers();
    const root = await mkdtemp(join(tmpdir(), "mmm-watch-"));
    temporaryDirectories.push(root);
    const watcher = new FakeWatcher();
    const watch = vi.fn(() => watcher);
    const send = vi.fn();
    const service = createProjectFileWatcher({ send, watch, batchDelayMs: 20 });
    const webContents = { id: 1, isDestroyed: () => false };
    await service.setTargets(webContents, { rootPath: root });

    const documentPath = join(root, "notes.md");
    watcher.emit("unlink", documentPath);
    watcher.emit("add", documentPath);
    await vi.advanceTimersByTimeAsync(20);

    expect(watch).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(webContents, expect.objectContaining({
      rootPath: root,
      changes: [{ directory: false, kind: "changed", path: documentPath }]
    }));
    expect(ignoredProjectPath(root, join(root, "node_modules", "package", "index.js"))).toBe(true);
    expect(ignoredProjectPath(root, join(root, "docs", "notes.md"))).toBe(false);
    expect(mergeChangeKind("removed", "added")).toBe("changed");
    await service.closeAll();
  });

  it("shares a root watcher until its last window unsubscribes", async () => {
    const root = await mkdtemp(join(tmpdir(), "mmm-watch-"));
    temporaryDirectories.push(root);
    const watcher = new FakeWatcher();
    const watch = vi.fn(() => watcher);
    const service = createProjectFileWatcher({ send: vi.fn(), watch });
    const first = { id: 1, isDestroyed: () => false };
    const second = { id: 2, isDestroyed: () => false };

    await service.setTargets(first, { rootPath: root });
    await service.setTargets(second, { rootPath: root });
    expect(watch).toHaveBeenCalledTimes(1);

    await service.removeSubscriber(first.id);
    expect(watcher.close).not.toHaveBeenCalled();
    await service.removeSubscriber(second.id);
    expect(watcher.close).toHaveBeenCalledTimes(1);
  });

  it("serializes rapid target updates for the same window", async () => {
    vi.useFakeTimers();
    const roots = await Promise.all([0, 1, 2].map(async () => {
      const root = await mkdtemp(join(tmpdir(), "mmm-watch-"));
      temporaryDirectories.push(root);
      return root;
    }));
    const watchers: FakeWatcher[] = [];
    const send = vi.fn();
    const service = createProjectFileWatcher({
      send,
      watch: vi.fn(() => {
        const watcher = new FakeWatcher();
        watchers.push(watcher);
        return watcher;
      }),
      batchDelayMs: 20
    });
    const webContents = { id: 9, isDestroyed: () => false };
    await service.setTargets(webContents, { rootPath: roots[0] });

    await Promise.all([
      service.setTargets(webContents, { rootPath: roots[1] }),
      service.setTargets(webContents, { rootPath: roots[2] })
    ]);
    watchers[0].emit("change", join(roots[0], "old.md"));
    watchers[1].emit("change", join(roots[1], "intermediate.md"));
    watchers[2].emit("change", join(roots[2], "current.md"));
    await vi.advanceTimersByTimeAsync(20);

    expect(watchers[0].close).toHaveBeenCalledTimes(1);
    expect(watchers[1].close).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(webContents, expect.objectContaining({ rootPath: roots[2] }));
    await service.closeAll();
  });
});
