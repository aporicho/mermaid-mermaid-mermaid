import { describe, expect, it } from "vitest";

import { adjacentImageNavigationIndex, projectDirectoryImageNavigation } from "@/features/mermaid-editor/lib/image-window-navigation";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

describe("image window navigation", () => {
  const workspace: ProjectWorkspace = {
    rootName: "project",
    rootPath: "/project",
    files: [],
    scannedAt: 1,
    resources: [
      { kind: "file", name: "cover10.png", path: "/project/assets/cover10.png", relativePath: "assets/cover10.png" },
      { kind: "file", name: "cover2.png", path: "/project/assets/cover2.png", relativePath: "assets/cover2.png" },
      { kind: "file", name: "readme.md", path: "/project/assets/readme.md", relativePath: "assets/readme.md" },
      { kind: "file", name: "other.png", path: "/project/other.png", relativePath: "other.png" }
    ]
  };

  it("keeps explorer navigation in one directory and sorts filenames naturally", () => {
    const navigation = projectDirectoryImageNavigation(workspace, {
      name: "cover10.png",
      path: "/project/assets/cover10.png",
      relativePath: "assets/cover10.png"
    });

    expect(navigation.kind).toBe("project-directory");
    expect(navigation.items.map((item) => item.title)).toEqual(["cover2.png", "cover10.png"]);
  });

  it("wraps previous and next navigation at both ends", () => {
    const items = [
      { source: "a.png", title: "a", identity: "a" },
      { source: "b.png", title: "b", identity: "b" },
      { source: "c.png", title: "c", identity: "c" }
    ];
    expect(adjacentImageNavigationIndex({ items, index: 0 }, -1)).toBe(2);
    expect(adjacentImageNavigationIndex({ items, index: 2 }, 1)).toBe(0);
    expect(adjacentImageNavigationIndex({ items: items.slice(0, 1), index: 0 }, 1)).toBe(0);
  });
});
