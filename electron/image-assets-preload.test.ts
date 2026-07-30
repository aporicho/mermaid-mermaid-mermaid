// @vitest-environment node

import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createImageAssetPreloadBridge, isMarkdownImageFileDrop } = require("./image-assets-preload.cjs") as {
  createImageAssetPreloadBridge: (
    ipcRenderer: { invoke: ReturnType<typeof vi.fn> },
    webUtils: { getPathForFile: (file: File) => string }
  ) => { importImageAssetFile: (documentPath: string, file: File, context: object) => Promise<unknown> };
  isMarkdownImageFileDrop: (event: unknown) => boolean;
};

describe("image asset preload bridge", () => {
  it("imports a native Electron file by path without reading its bytes", async () => {
    const invoke = vi.fn(async () => ({ status: "ready" }));
    const file = { name: "cover.png", arrayBuffer: vi.fn() } as unknown as File;
    const bridge = createImageAssetPreloadBridge({ invoke }, { getPathForFile: () => "/repo/cover.png" });

    await bridge.importImageAssetFile("/repo/readme.md", file, { storageScope: "project" });

    expect(invoke).toHaveBeenCalledWith("mmm:image:import-path", {
      documentPath: "/repo/readme.md",
      imagePath: "/repo/cover.png",
      context: { storageScope: "project" }
    });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it("falls back to bytes and identifies native Markdown image drops", async () => {
    const invoke = vi.fn(async () => ({ status: "ready" }));
    const file = { name: "cover.png", arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2]).buffer) } as unknown as File;
    const bridge = createImageAssetPreloadBridge({ invoke }, { getPathForFile: () => "" });

    await bridge.importImageAssetFile("/repo/readme.md", file, {});

    expect(invoke).toHaveBeenCalledWith("mmm:image:import-bytes", expect.objectContaining({ bytes: [1, 2] }));
    expect(isMarkdownImageFileDrop({
      target: { closest: () => ({}) },
      dataTransfer: { files: [{ name: "cover.png" }, { name: "photo.jpg" }] }
    })).toBe(true);
    expect(isMarkdownImageFileDrop({
      target: { closest: () => ({}) },
      dataTransfer: { files: [{ name: "notes.txt" }] }
    })).toBe(false);
  });
});
