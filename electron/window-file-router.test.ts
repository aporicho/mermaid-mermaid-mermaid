// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createWindowFileRouter } = require("./window-file-router.cjs") as {
  createWindowFileRouter: () => {
    clear: (webContentsId: number) => void;
    enqueue: (webContentsId: number, files: Array<{ name: string; path: string }>) => Array<{ name: string; path: string }>;
    take: (webContentsId: number) => Array<{ name: string; path: string }>;
  };
};

describe("Electron window file router", () => {
  it("opens a new editor window for each subsequent application launch", () => {
    const main = readFileSync(new URL("./main.cjs", import.meta.url), "utf8");

    expect(main).toMatch(/app\.on\("second-instance",[\s\S]*?requestMainWindow\(collectDocumentFileArgs\(argv\.slice\(1\)\)\)/);
    expect(main).not.toMatch(/app\.on\("second-instance",[\s\S]*?mainWindow\.focus\(\)/);
    expect(main).toContain('ipcMain.handle("mmm:pending-files:take", (event) => takePendingOpenFiles(event.sender.id))');
  });

  it("keeps startup file requests isolated per editor window", () => {
    const router = createWindowFileRouter();
    const first = { name: "first.md", path: "/project/first.md" };
    const second = { name: "second.md", path: "/project/second.md" };

    router.enqueue(11, [first]);
    router.enqueue(22, [second]);

    expect(router.take(22)).toEqual([second]);
    expect(router.take(11)).toEqual([first]);
    expect(router.take(22)).toEqual([]);
  });

  it("deduplicates files within one window without affecting another", () => {
    const router = createWindowFileRouter();
    const file = { name: "notes.md", path: "/project/notes.md" };

    router.enqueue(11, [file, file]);
    router.enqueue(22, [file]);

    expect(router.take(11)).toEqual([file]);
    expect(router.take(22)).toEqual([file]);
  });

  it("clears requests when their owning window closes", () => {
    const router = createWindowFileRouter();
    router.enqueue(11, [{ name: "notes.md", path: "/project/notes.md" }]);

    router.clear(11);

    expect(router.take(11)).toEqual([]);
  });
});
