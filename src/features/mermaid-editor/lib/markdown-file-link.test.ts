import { describe, expect, it } from "vitest";

import {
  createMarkdownFileLinkIndex,
  localPathFromMarkdownHref,
  resolveMarkdownFileWindowTarget
} from "@/features/mermaid-editor/lib/markdown-file-link";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

const workspace: ProjectWorkspace = {
  rootName: "project",
  rootPath: "/work/project",
  scannedAt: 1,
  files: [
    { name: "readme.md", path: "/work/project/docs/readme.md", relativePath: "docs/readme.md" },
    { name: "notes.txt", path: "/work/project/notes.txt", relativePath: "notes.txt" },
    { name: "local-notes.txt", path: "/work/project/docs/notes.txt", relativePath: "docs/notes.txt" },
    { name: "guide.md", path: "/work/project/guide.md", relativePath: "guide.md" },
    { name: "table.csv", path: "/work/project/data/table.csv", relativePath: "data/table.csv" }
  ],
  resources: [
    { kind: "file", name: "preview.html", path: "/work/project/docs/preview.html", relativePath: "docs/preview.html" },
    { kind: "file", name: "cover image.png", path: "/work/project/assets/cover image.png", relativePath: "assets/cover image.png" }
  ]
};

describe("Markdown file links", () => {
  it("resolves bare paths from the project root and explicit dot paths from the document", () => {
    const index = createMarkdownFileLinkIndex(workspace);

    expect(resolveMarkdownFileWindowTarget("assets/cover%20image.png#preview", "/work/project/docs/readme.md", index)).toEqual({
      kind: "image",
      file: {
        name: "cover image.png",
        path: "/work/project/assets/cover image.png",
        relativePath: "assets/cover image.png"
      }
    });
    expect(resolveMarkdownFileWindowTarget("notes.txt", "/work/project/docs/readme.md", index)?.file.path).toBe("/work/project/notes.txt");
    expect(resolveMarkdownFileWindowTarget("./notes.txt", "/work/project/docs/readme.md", index)?.file.path).toBe("/work/project/docs/notes.txt");
    expect(resolveMarkdownFileWindowTarget("../data/table.csv?mode=table", "/work/project/docs/readme.md", index)?.kind).toBe("csv");
    expect(resolveMarkdownFileWindowTarget("docs/preview.html", "/work/project/docs/readme.md", index)?.kind).toBe("html");
    expect(resolveMarkdownFileWindowTarget("../guide.md#intro", "/work/project/docs/readme.md", index)?.kind).toBe("markdown");
  });

  it("accepts POSIX, Windows, UNC, and file URL absolute paths", () => {
    expect(resolveMarkdownFileWindowTarget("/outside/readme.md", "/work/project/docs/readme.md", workspace)?.file.path).toBe("/outside/readme.md");
    expect(resolveMarkdownFileWindowTarget("C:\\repo\\notes.txt#one", undefined, workspace)?.file.path).toBe("C:/repo/notes.txt");
    expect(resolveMarkdownFileWindowTarget("\\\\server\\share\\table.csv", undefined, workspace)?.file.path).toBe("//server/share/table.csv");
    expect(localPathFromMarkdownHref("file:///work/project/assets/cover%20image.png#one")).toBe("/work/project/assets/cover image.png");
    expect(localPathFromMarkdownHref("file://server/share/preview.html")).toBe("//server/share/preview.html");
    expect(resolveMarkdownFileWindowTarget("file:///work/project/docs/readme.md", undefined, workspace)?.file).toEqual(workspace.files[0]);
  });

  it("ignores web URLs, anchors, protocol-relative URLs, and unsupported files", () => {
    expect(resolveMarkdownFileWindowTarget("https://example.com/guide.md", "/work/project/docs/readme.md", workspace)).toBeNull();
    expect(resolveMarkdownFileWindowTarget("#section", "/work/project/docs/readme.md", workspace)).toBeNull();
    expect(resolveMarkdownFileWindowTarget("//example.com/guide.md", "/work/project/docs/readme.md", workspace)).toBeNull();
    expect(resolveMarkdownFileWindowTarget("archive.zip", "/work/project/docs/readme.md", workspace)).toBeNull();
  });

  it("returns normalized project-root and document-relative fallbacks", () => {
    expect(resolveMarkdownFileWindowTarget("draft.md", "/work/project/notes/index.md", workspace)).toEqual({
      kind: "markdown",
      file: {
        name: "draft.md",
        path: "/work/project/draft.md",
        relativePath: "draft.md"
      }
    });
    expect(resolveMarkdownFileWindowTarget("./draft.md", "/work/project/notes/index.md", workspace)?.file.path).toBe("/work/project/notes/draft.md");
    expect(resolveMarkdownFileWindowTarget("../draft.md", "/work/project/notes/index.md", workspace)?.file.path).toBe("/work/project/draft.md");
  });

  it("uses deterministic first-entry precedence for duplicate index paths", () => {
    const duplicateWorkspace: ProjectWorkspace = {
      ...workspace,
      files: [
        { name: "preferred.md", path: "/work/project/docs/same.md", relativePath: "docs/same.md", modifiedAt: 1 }
      ],
      resources: [
        { kind: "file", name: "duplicate.md", path: "/work/project/docs/same.md", relativePath: "docs/same.md", modifiedAt: 2 },
        { kind: "file", name: "relative-collision.md", path: "/elsewhere/same.md", relativePath: "docs/same.md", modifiedAt: 3 }
      ]
    };

    expect(resolveMarkdownFileWindowTarget("docs/same.md", undefined, createMarkdownFileLinkIndex(duplicateWorkspace))?.file.name).toBe("preferred.md");
  });

  it("scans a large workspace only while creating the reusable index", () => {
    const files = Array.from({ length: 20_000 }, (_, index) => ({
      name: `file-${index}.md`,
      path: `/work/project/docs/file-${index}.md`,
      relativePath: `docs/file-${index}.md`
    }));
    let fileReads = 0;
    const largeWorkspace = {
      rootName: "project",
      rootPath: "/work/project",
      scannedAt: 1,
      get files() {
        fileReads += 1;
        return files;
      },
      resources: []
    } satisfies ProjectWorkspace;

    const index = createMarkdownFileLinkIndex(largeWorkspace);
    expect(fileReads).toBe(1);
    expect(resolveMarkdownFileWindowTarget("docs/file-19999.md", undefined, index)?.file.path).toBe("/work/project/docs/file-19999.md");
    expect(resolveMarkdownFileWindowTarget("docs/file-1.md", undefined, index)?.file.path).toBe("/work/project/docs/file-1.md");
    expect(fileReads).toBe(1);
  });
});
