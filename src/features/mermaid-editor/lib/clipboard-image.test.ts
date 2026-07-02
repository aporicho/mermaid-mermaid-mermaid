import { afterEach, describe, expect, it, vi } from "vitest";

import { imageFileFromClipboardItems, readClipboardImageFile, type ClipboardImageItem } from "@/features/mermaid-editor/lib/clipboard-image";

function clipboardItem(blobs: Record<string, Blob>): ClipboardImageItem {
  return {
    types: Object.keys(blobs),
    async getType(type) {
      const blob = blobs[type];
      if (!blob) throw new Error(`Missing ${type}`);
      return blob;
    }
  };
}

describe("clipboard image helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an image file from supported clipboard image items", async () => {
    const file = await imageFileFromClipboardItems([
      clipboardItem({
        "text/plain": new Blob(["ignored"], { type: "text/plain" }),
        "image/png": new Blob(["png"], { type: "image/png" })
      })
    ]);

    expect(file).toBeInstanceOf(File);
    expect(file?.name).toBe("clipboard-image.png");
    expect(file?.type).toBe("image/png");
    expect(await file?.text()).toBe("png");
  });

  it("returns null when no supported image type exists", async () => {
    const file = await imageFileFromClipboardItems([
      clipboardItem({
        "text/html": new Blob(["<img>"], { type: "text/html" })
      })
    ]);

    expect(file).toBeNull();
  });

  it("reports clipboard read failures without throwing", async () => {
    vi.stubGlobal("navigator", {
      clipboard: {
        read: vi.fn().mockRejectedValue(new Error("blocked"))
      }
    });

    await expect(readClipboardImageFile()).resolves.toMatchObject({ status: "error" });
  });
});
