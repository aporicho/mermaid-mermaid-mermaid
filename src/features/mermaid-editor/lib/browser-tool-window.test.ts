import { describe, expect, it } from "vitest";

import {
  browserToolShellUrl,
  browserToolWindowLabel,
  browserToolWindowTitle,
  normalizeBrowserUrl,
  parseBrowserToolWindowRequest
} from "@/features/mermaid-editor/lib/browser-tool-window";

describe("browser tool window helpers", () => {
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

  it("builds and parses the local shell URL without leaking unrelated query state", () => {
    const shellUrl = browserToolShellUrl(
      {
        url: "https://example.com",
        title: "Example",
        sourceNodeId: "node-1",
        sourceLabel: "Reference"
      },
      "file:///opt/mermaid-canvas-editor/index.html?stale=true#main"
    );
    const parsedUrl = new URL(shellUrl);

    expect(parsedUrl.searchParams.get("stale")).toBeNull();
    expect(parsedUrl.hash).toBe("");
    expect(parseBrowserToolWindowRequest({ search: parsedUrl.search })).toEqual({
      url: "https://example.com",
      title: "Example",
      sourceNodeId: "node-1",
      sourceLabel: "Reference"
    });
  });

  it("ignores non browser-tool routes and invalid URLs", () => {
    expect(parseBrowserToolWindowRequest({ search: "?url=https://example.com" })).toBeNull();
    expect(parseBrowserToolWindowRequest({ search: "?mmmWindow=browser-tool&url=mailto:test@example.com" })).toBeNull();
  });
});
