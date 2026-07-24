import { describe, expect, it } from "vitest";

import { isExternalAssetSrc, isNativeFilePath } from "@/features/mermaid-editor/lib/editor-runtime/shared";

describe("editor runtime shared helpers", () => {
  it("distinguishes native file paths from external asset sources", () => {
    expect(isNativeFilePath("/home/demo/cover.jpg")).toBe(true);
    expect(isNativeFilePath("C:\\Users\\demo\\cover.jpg")).toBe(true);
    expect(isNativeFilePath("\\\\server\\share\\cover.jpg")).toBe(true);
    expect(isNativeFilePath("assets/demo/cover.jpg")).toBe(false);
    expect(isExternalAssetSrc("https://sns-webpic-qc.xhscdn.com/cover")).toBe(true);
    expect(isExternalAssetSrc("mmm-asset://local/cover.jpg")).toBe(true);
    expect(isExternalAssetSrc("asset://localhost/legacy-cover.jpg")).toBe(false);
  });
});
