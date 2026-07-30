// @vitest-environment node

import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createMarkdownExportPreloadBridge } = require("./markdown-export-preload.cjs") as {
  createMarkdownExportPreloadBridge: (ipcRenderer: { invoke: ReturnType<typeof vi.fn> }) => {
    exportMarkdownFolder: (request: object) => Promise<unknown>;
  };
};

describe("Markdown export preload bridge", () => {
  it("forwards folder exports through the dedicated IPC channel", async () => {
    const invoke = vi.fn(async () => ({ status: "cancelled" }));
    const bridge = createMarkdownExportPreloadBridge({ invoke });
    const request = { sourcePath: "/project/readme.md", projectRoot: "/project" };

    await bridge.exportMarkdownFolder(request);

    expect(invoke).toHaveBeenCalledWith("mmm:markdown:export-folder", request);
  });
});
