import { describe, expect, it } from "vitest";

import {
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
    { name: "guide.md", path: "/work/project/guide.md", relativePath: "guide.md" },
    { name: "notes.txt", path: "/work/project/docs/notes.txt", relativePath: "docs/notes.txt" },
    { name: "table.csv", path: "/work/project/data/table.csv", relativePath: "data/table.csv" }
  ],
  resources: [
    { kind: "file", name: "preview.html", path: "/work/project/docs/preview.html", relativePath: "docs/preview.html" },
    { kind: "file", name: "cover image.png", path: "/work/project/assets/cover image.png", relativePath: "assets/cover image.png" }
  ]
};

describe("Markdown file links", () => {
  it("resolves supported links relative to the Markdown document", () => {
    expect(resolveMarkdownFileWindowTarget("../assets/cover%20image.png#preview", "/work/project/docs/readme.md", workspace)).toEqual({
      kind: "image",
      file: {
        name: "cover image.png",
        path: "/work/project/assets/cover image.png",
        relativePath: "assets/cover image.png"
      }
    });
    expect(resolveMarkdownFileWindowTarget("notes.txt", "/work/project/docs/readme.md", workspace)?.kind).toBe("text");
    expect(resolveMarkdownFileWindowTarget("../data/table.csv?mode=table", "/work/project/docs/readme.md", workspace)?.kind).toBe("csv");
    expect(resolveMarkdownFileWindowTarget("preview.html", "/work/project/docs/readme.md", workspace)?.kind).toBe("html");
    expect(resolveMarkdownFileWindowTarget("../guide.md#intro", "/work/project/docs/readme.md", workspace)?.kind).toBe("markdown");
  });

  it("accepts local file URLs and ignores web URLs, anchors, and unsupported files", () => {
    expect(localPathFromMarkdownHref("file:///work/project/docs/notes.txt#one")).toBe("/work/project/docs/notes.txt");
    expect(resolveMarkdownFileWindowTarget("https://example.com/guide.md", "/work/project/docs/readme.md", workspace)).toBeNull();
    expect(resolveMarkdownFileWindowTarget("#section", "/work/project/docs/readme.md", workspace)).toBeNull();
    expect(resolveMarkdownFileWindowTarget("../archive.zip", "/work/project/docs/readme.md", workspace)).toBeNull();
  });

  it("returns a usable absolute fallback for a supported file outside the project index", () => {
    expect(resolveMarkdownFileWindowTarget("draft.md", "/work/project/notes/index.md", workspace)).toEqual({
      kind: "markdown",
      file: {
        name: "draft.md",
        path: "/work/project/notes/draft.md",
        relativePath: "draft.md"
      }
    });
  });
});
