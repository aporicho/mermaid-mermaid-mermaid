// @vitest-environment node

import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { scanProjectFolder } = require("./project-workspace.cjs") as {
  scanProjectFolder: (rootPath: string) => Promise<{
    files: { relativePath: string }[];
    resources: { kind: "directory" | "file"; relativePath: string; modifiedAt?: number }[];
    resourcesTruncated: boolean;
  }>;
};

describe("Electron project workspace scanner", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("returns empty directories, ordinary resources, and supported documents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mermaid-project-tree-"));
    temporaryDirectories.push(root);
    await mkdir(path.join(root, "docs", "empty"), { recursive: true });
    await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
    await mkdir(path.join(root, ".mermaid-canvas-editor"), { recursive: true });
    await writeFile(path.join(root, "docs", "diagram.mmd"), "flowchart LR");
    await writeFile(path.join(root, "docs", "cover.png"), "not-an-image");
    await writeFile(path.join(root, "docs", "people.csv"), "Name\nAlice");
    await writeFile(path.join(root, "docs", "index.html"), "<!doctype html>");
    await writeFile(path.join(root, "node_modules", "ignored", "hidden.md"), "# hidden");
    await writeFile(path.join(root, ".mermaid-canvas-editor", "markdown-folds.json"), "{}");

    const workspace = await scanProjectFolder(root);

    expect(workspace.files.map((file) => file.relativePath)).toEqual(["docs/diagram.mmd"]);
    expect(workspace.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "directory", relativePath: "docs" }),
      expect.objectContaining({ kind: "directory", relativePath: "docs/empty" }),
      expect.objectContaining({ kind: "file", relativePath: "docs/diagram.mmd" }),
      expect.objectContaining({ kind: "file", relativePath: "docs/cover.png" }),
      expect.objectContaining({ kind: "file", relativePath: "docs/people.csv", modifiedAt: expect.any(Number) }),
      expect.objectContaining({ kind: "file", relativePath: "docs/index.html", modifiedAt: expect.any(Number) })
    ]));
    expect(workspace.resources.some((entry) => entry.relativePath.includes("node_modules"))).toBe(false);
    expect(workspace.resources.some((entry) => entry.relativePath.includes(".mermaid-canvas-editor"))).toBe(false);
    expect(workspace.resourcesTruncated).toBe(false);
  });
});
