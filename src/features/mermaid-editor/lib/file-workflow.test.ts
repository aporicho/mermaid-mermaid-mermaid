import { describe, expect, it } from "vitest";

import {
  fileNameFromPath,
  isSupportedMermaidFilePath,
  normalizeFileWorkflowError,
  RECENT_FILE_LIMIT,
  upsertRecentFile,
  type RecentFileEntry
} from "@/features/mermaid-editor/lib/file-workflow";

describe("file workflow", () => {
  it("accepts Mermaid source extensions", () => {
    expect(isSupportedMermaidFilePath("diagram.mmd")).toBe(true);
    expect(isSupportedMermaidFilePath("diagram.mermaid")).toBe(true);
    expect(isSupportedMermaidFilePath("diagram.txt")).toBe(false);
  });

  it("extracts file names from Windows and POSIX paths", () => {
    expect(fileNameFromPath("/tmp/demo.mmd")).toBe("demo.mmd");
    expect(fileNameFromPath("C:\\Users\\demo\\graph.mermaid")).toBe("graph.mermaid");
  });

  it("keeps recent files newest-first and deduped by path", () => {
    const files = upsertRecentFile(
      upsertRecentFile([{ name: "old.mmd", path: "/old.mmd", openedAt: 1 }], { name: "a.mmd", path: "/a.mmd" }, 2),
      { name: "renamed.mmd", path: "/old.mmd" },
      3
    );

    expect(files).toEqual([
      { name: "renamed.mmd", path: "/old.mmd", openedAt: 3 },
      { name: "a.mmd", path: "/a.mmd", openedAt: 2 }
    ]);
  });

  it("limits recent files", () => {
    const files = Array.from({ length: RECENT_FILE_LIMIT + 2 }).reduce<RecentFileEntry[]>(
      (current, _item, index) => upsertRecentFile(current, { name: `${index}.mmd`, path: `/${index}.mmd` }, index),
      [] as RecentFileEntry[]
    );

    expect(files).toHaveLength(RECENT_FILE_LIMIT);
    expect(files[0]?.name).toBe("11.mmd");
    expect(files.at(-1)?.name).toBe("2.mmd");
  });

  it("normalizes structured file errors", () => {
    expect(normalizeFileWorkflowError({ code: "permission_denied", path: "/locked.mmd" })).toMatchObject({
      code: "permission_denied",
      path: "/locked.mmd"
    });
  });
});
