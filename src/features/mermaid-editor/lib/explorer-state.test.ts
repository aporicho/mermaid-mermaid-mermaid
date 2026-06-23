import { describe, expect, it } from "vitest";

import { shouldCollapseExplorerOnStartup } from "@/features/mermaid-editor/lib/explorer-state";

const fallbackFileName = "diagram.mmd";

describe("explorer startup state", () => {
  it("honors the preference to start with panels collapsed", () => {
    expect(
      shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: true,
        storedCollapsed: false,
        recentFiles: [{ name: "demo.mmd", path: "/docs/demo.mmd", openedAt: 1 }],
        fallbackFileName
      })
    ).toBe(true);
  });

  it("stays collapsed for a blank default draft without file context", () => {
    expect(
      shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: false,
        fileName: fallbackFileName,
        fallbackFileName
      })
    ).toBe(true);
  });

  it("opens by default when there is useful file context and no stored preference", () => {
    expect(
      shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: false,
        fileRef: { name: "demo.mmd", path: "/docs/demo.mmd" },
        fileName: "demo.mmd",
        fallbackFileName
      })
    ).toBe(false);
  });

  it("treats a name-only file reference as useful context for web file handles", () => {
    expect(
      shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: false,
        fileRef: { name: fallbackFileName },
        fileName: fallbackFileName,
        fallbackFileName
      })
    ).toBe(false);
  });

  it("preserves the stored collapsed state when explorer context exists", () => {
    expect(
      shouldCollapseExplorerOnStartup({
        startWithPanelsCollapsed: false,
        storedCollapsed: true,
        projectWorkspace: {
          rootName: "docs",
          rootPath: "/docs",
          scannedAt: 1,
          files: []
        },
        fallbackFileName
      })
    ).toBe(true);
  });
});
