// @vitest-environment node

import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { registerMarkdownExportIpc } = require("./markdown-export-ipc.cjs") as {
  registerMarkdownExportIpc: (dependencies: Record<string, unknown>) => void;
};

describe("Markdown export IPC", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("exports the Document Hub working copy instead of stale disk text", async () => {
    const root = await temporaryDirectory("mmm-markdown-export-ipc-");
    const documentPath = path.join(root, "note.md");
    const outputParent = path.join(root, "exports");
    await writeFile(documentPath, "# stale\n");
    await mkdir(outputParent);
    let handler: ((event: unknown, request: unknown) => Promise<Record<string, unknown>>) | undefined;
    const ipcMain = { handle: vi.fn((_channel, value) => { handler = value; }) };
    registerMarkdownExportIpc({
      ipcMain,
      dialog: { showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: [outputParent] })) },
      BrowserWindow: { fromWebContents: vi.fn(() => null) },
      documentHub: { get: vi.fn(() => ({ content: "# current working copy\n" })) }
    });

    const result = await handler?.({ sender: {} }, { sourcePath: documentPath, projectRoot: root });

    expect(ipcMain.handle).toHaveBeenCalledWith("mmm:markdown:export-folder", expect.any(Function));
    expect(result?.status).toBe("exported");
    await expect(readFile(path.join(String(result?.directoryPath), "note.md"), "utf8")).resolves.toBe("# current working copy\n");
  });

  it("returns cancelled without creating an export folder", async () => {
    let handler: ((event: unknown, request: unknown) => Promise<Record<string, unknown>>) | undefined;
    registerMarkdownExportIpc({
      ipcMain: { handle: (_channel: string, value: typeof handler) => { handler = value; } },
      dialog: { showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })) },
      BrowserWindow: { fromWebContents: vi.fn(() => null) },
      documentHub: { get: vi.fn() }
    });

    await expect(handler?.({ sender: {} }, { sourcePath: "/project/readme.md" })).resolves.toEqual({ status: "cancelled" });
  });

  async function temporaryDirectory(prefix: string) {
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
  }
});
