import { describe, expect, it } from "vitest";

import {
  buildProjectFileTree,
  filterProjectFiles,
  isProjectFileActive,
  normalizeProjectFiles,
  normalizeProjectWorkspace,
  projectTreeDirectoryIds,
  PROJECT_FILE_LIMIT,
  type ProjectFileEntry
} from "@/features/mermaid-editor/lib/project-workspace";

describe("project workspace", () => {
  it("normalizes a persisted workspace with sorted, deduped files", () => {
    const workspace = normalizeProjectWorkspace({
      rootName: "docs",
      rootPath: "C:\\repo\\docs",
      scannedAt: 10,
      files: [
        { name: "b.mmd", path: "C:\\repo\\docs\\b.mmd", relativePath: "b.mmd" },
        { path: "C:\\repo\\docs\\a.mmd", relativePath: "nested\\a.mmd", modifiedAt: "20" },
        { name: "duplicate.mmd", path: "C:\\repo\\docs\\b.mmd", relativePath: "duplicate.mmd" },
        { name: "bad.mmd" }
      ]
    });

    expect(workspace).toMatchObject({
      rootName: "docs",
      rootPath: "C:\\repo\\docs",
      scannedAt: 10,
      files: [
        { name: "b.mmd", path: "C:\\repo\\docs\\b.mmd", relativePath: "b.mmd" },
        { name: "a.mmd", path: "C:\\repo\\docs\\a.mmd", relativePath: "nested/a.mmd", modifiedAt: 20 }
      ]
    });
  });

  it("limits normalized project files", () => {
    const files = normalizeProjectFiles(
      Array.from({ length: PROJECT_FILE_LIMIT + 5 }, (_item, index) => ({
        name: `${index}.mmd`,
        path: `/project/${index}.mmd`,
        relativePath: `${String(index).padStart(3, "0")}.mmd`
      }))
    );

    expect(files).toHaveLength(PROJECT_FILE_LIMIT);
    expect(files[0]?.relativePath).toBe("000.mmd");
    expect(files.at(-1)?.relativePath).toBe("499.mmd");
  });

  it("filters project files by relative path tokens", () => {
    const files: ProjectFileEntry[] = [
      { name: "runtime-file-assets.mmd", path: "/docs/runtime-file-assets.mmd", relativePath: "runtime-file-assets.mmd" },
      { name: "document-model.mmd", path: "/docs/document-model.mmd", relativePath: "core/document-model.mmd" }
    ];

    expect(filterProjectFiles(files, "core doc")).toEqual([files[1]]);
    expect(filterProjectFiles(files, "assets")).toEqual([files[0]]);
    expect(filterProjectFiles(files, "missing")).toEqual([]);
  });

  it("builds a sorted directory tree from project files", () => {
    const files: ProjectFileEntry[] = [
      { name: "zeta.mmd", path: "/project/zeta.mmd", relativePath: "zeta.mmd" },
      { name: "runtime.mmd", path: "/project/docs/runtime.mmd", relativePath: "docs/runtime.mmd" },
      { name: "alpha.mmd", path: "/project/docs/core/alpha.mmd", relativePath: "docs/core/alpha.mmd" },
      { name: "beta.mermaid", path: "/project/docs/core/beta.mermaid", relativePath: "docs/core/beta.mermaid" }
    ];

    const tree = buildProjectFileTree(files);

    expect(tree).toEqual([
      expect.objectContaining({
        kind: "directory",
        name: "docs",
        fileCount: 3,
        children: [
          expect.objectContaining({
            kind: "directory",
            name: "core",
            fileCount: 2,
            children: [
              expect.objectContaining({ kind: "file", name: "alpha.mmd" }),
              expect.objectContaining({ kind: "file", name: "beta.mermaid" })
            ]
          }),
          expect.objectContaining({ kind: "file", name: "runtime.mmd" })
        ]
      }),
      expect.objectContaining({ kind: "file", name: "zeta.mmd" })
    ]);
  });

  it("keeps parent directories when building a filtered tree", () => {
    const files: ProjectFileEntry[] = [
      { name: "runtime-file-assets.mmd", path: "/docs/runtime-file-assets.mmd", relativePath: "runtime-file-assets.mmd" },
      { name: "document-model.mmd", path: "/docs/document-model.mmd", relativePath: "core/document-model.mmd" }
    ];
    const tree = buildProjectFileTree(filterProjectFiles(files, "core doc"));

    expect(tree).toEqual([
      expect.objectContaining({
        kind: "directory",
        id: "dir:core",
        children: [expect.objectContaining({ kind: "file", name: "document-model.mmd" })]
      })
    ]);
    expect(projectTreeDirectoryIds(tree)).toEqual(["dir:core"]);
  });

  it("matches active project files with Windows path casing tolerance", () => {
    expect(
      isProjectFileActive(
        { name: "demo.mmd", path: "C:\\Repo\\docs\\demo.mmd", relativePath: "demo.mmd" },
        { name: "demo.mmd", path: "c:\\repo\\docs\\demo.mmd" }
      )
    ).toBe(true);
    expect(
      isProjectFileActive(
        { name: "demo.mmd", path: "/Repo/docs/demo.mmd", relativePath: "demo.mmd" },
        { name: "demo.mmd", path: "/repo/docs/demo.mmd" }
      )
    ).toBe(false);
  });
});
