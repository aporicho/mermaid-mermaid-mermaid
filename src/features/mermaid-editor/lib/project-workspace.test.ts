import { describe, expect, it } from "vitest";

import {
  buildProjectFileTree,
  buildProjectResourceTree,
  filterProjectFiles,
  isRuntimePathInsideProjectWorkspace,
  isProjectFileActive,
  normalizeProjectFiles,
  normalizeProjectWorkspace,
  parentDirectoryFromRuntimePath,
  projectTreeDirectoryIds,
  projectWorkspaceForStorage,
  PROJECT_FILE_LIMIT,
  workspaceRootForOpenedFile,
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

  it("builds a complete resource tree with empty directories and unsupported files", () => {
    const files: ProjectFileEntry[] = [
      { name: "diagram.mmd", path: "/project/docs/diagram.mmd", relativePath: "docs/diagram.mmd" }
    ];
    const tree = buildProjectResourceTree([
      { kind: "directory", name: "docs", path: "/project/docs", relativePath: "docs" },
      { kind: "directory", name: "empty", path: "/project/empty", relativePath: "empty" },
      { kind: "file", name: "diagram.mmd", path: "/project/docs/diagram.mmd", relativePath: "docs/diagram.mmd", documentKind: "mermaid" },
      { kind: "file", name: "cover.png", path: "/project/docs/cover.png", relativePath: "docs/cover.png" }
    ], files);

    expect(tree).toEqual([
      expect.objectContaining({
        kind: "directory",
        name: "docs",
        fileCount: 1,
        resourceCount: 2,
        children: [
          expect.objectContaining({ kind: "file", name: "cover.png" }),
          expect.objectContaining({ kind: "file", name: "diagram.mmd", file: files[0] })
        ]
      }),
      expect.objectContaining({ kind: "directory", name: "empty", resourceCount: 0, children: [] })
    ]);
    expect(tree[0]?.kind === "directory" ? tree[0].children[0] : null).not.toHaveProperty("file");
  });

  it("keeps full resources out of persisted workspace snapshots", () => {
    const workspace = normalizeProjectWorkspace({
      rootName: "project",
      rootPath: "/project",
      files: [{ name: "diagram.mmd", path: "/project/diagram.mmd", relativePath: "diagram.mmd" }],
      resources: [{ kind: "file", name: "cover.png", path: "/project/cover.png", relativePath: "cover.png" }],
      scannedAt: 10
    });

    expect(projectWorkspaceForStorage(workspace)?.resources).toBeUndefined();
    expect(normalizeProjectWorkspace(projectWorkspaceForStorage(workspace))?.resources).toEqual([
      expect.objectContaining({ kind: "file", name: "diagram.mmd", documentKind: "mermaid" })
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

  it("derives parent directories from runtime file paths", () => {
    expect(parentDirectoryFromRuntimePath("C:\\repo\\docs\\demo.mmd")).toBe("C:\\repo\\docs");
    expect(parentDirectoryFromRuntimePath("C:/repo/docs/demo.mermaid")).toBe("C:/repo/docs");
    expect(parentDirectoryFromRuntimePath("/repo/docs/demo.mmd")).toBe("/repo/docs");
    expect(parentDirectoryFromRuntimePath("demo.mmd")).toBeUndefined();
  });

  it("decides when an opened file should switch the workspace root", () => {
    const workspace = {
      rootName: "docs",
      rootPath: "C:\\Repo\\docs",
      scannedAt: 1,
      files: []
    };

    expect(isRuntimePathInsideProjectWorkspace("c:\\repo\\docs\\nested\\demo.mmd", workspace)).toBe(true);
    expect(workspaceRootForOpenedFile("c:\\repo\\docs\\nested\\demo.mmd", workspace)).toBeUndefined();
    expect(workspaceRootForOpenedFile("D:\\other\\demo.mmd", workspace)).toBe("D:\\other");
    expect(workspaceRootForOpenedFile("/repo/docs/demo.mmd", { ...workspace, rootPath: "/repo" })).toBeUndefined();
    expect(workspaceRootForOpenedFile("C:\\repo\\docs\\demo.mmd", { ...workspace, rootPath: "C:\\" })).toBeUndefined();
    expect(workspaceRootForOpenedFile("/repo/docs/demo.mmd", { ...workspace, rootPath: "/" })).toBeUndefined();
  });
});
