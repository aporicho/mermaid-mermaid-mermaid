import { describe, expect, it } from "vitest";

import {
  browserToolWindowLabel,
  browserToolWindowTitle,
  normalizeBrowserUrl
} from "@/features/mermaid-editor/lib/browser-tool-window";

describe("browser workspace helpers", () => {
  it("normalizes only http and https browser URLs", () => {
    expect(normalizeBrowserUrl(" https://example.com ")).toBe("https://example.com");
    expect(normalizeBrowserUrl("www.example.com/path")).toBe("https://www.example.com/path");
    expect(normalizeBrowserUrl("ftp://example.com")).toBe("");
    expect(normalizeBrowserUrl("")).toBe("");
  });

  it("derives stable labels and readable titles", () => {
    expect(browserToolWindowLabel("https://example.com")).toMatch(/^browser-tool-[a-z0-9]+$/);
    expect(browserToolWindowTitle("https://example.com/path")).toBe("example.com");
    expect(browserToolWindowTitle("https://example.com/path", "Design reference")).toBe("Design reference");
  });
});
