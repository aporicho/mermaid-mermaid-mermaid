import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  copyProjectResources,
  createProjectFile,
  deleteProjectResources,
  importProjectResources,
  moveProjectResources,
  renameProjectResource
} = require("../../../../../electron/project-documents.cjs") as {
  copyProjectResources: (request: Record<string, unknown>) => Promise<{ status: "completed" }>;
  createProjectFile: (request: Record<string, unknown>) => Promise<{ status: "created" | "exists" }>;
  importProjectResources: (request: Record<string, unknown>) => Promise<{ status: "completed" }>;
  renameProjectResource: (request: Record<string, unknown>) => Promise<{ status: "renamed" | "exists" | "noop" }>;
  moveProjectResources: (request: Record<string, unknown>) => Promise<{ status: "completed" }>;
  deleteProjectResources: (request: Record<string, unknown>) => Promise<{ status: "deleted" }>;
};
const {
  PROJECT_EXPLORER_ORDER_DIRECTORY,
  PROJECT_EXPLORER_ORDER_FILE,
  readProjectExplorerOrderState,
  reorderProjectResources
} = require("../../../../../electron/project-explorer-order.cjs") as {
  PROJECT_EXPLORER_ORDER_DIRECTORY: string;
  PROJECT_EXPLORER_ORDER_FILE: string;
  readProjectExplorerOrderState: (request: Record<string, unknown>) => Promise<{ version: 1; directories: Record<string, { directories: string[]; files: string[] }> }>;
  reorderProjectResources: (request: Record<string, unknown>) => Promise<{ status: "saved" }>;
};
const { scanProjectFolder } = require("../../../../../electron/project-workspace.cjs") as {
  scanProjectFolder: (rootPath: string) => Promise<{ resources: { kind: "file" | "directory"; name: string; relativePath: string }[]; resourceOrder?: unknown }>;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Electron project Explorer order store", () => {
  it("persists file order and applies it during project scans", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-order-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs"));
    await writeFile(path.join(rootPath, "docs", "a.md"), "a", "utf8");
    await writeFile(path.join(rootPath, "docs", "b.md"), "b", "utf8");

    await expect(reorderProjectResources({
      rootPath,
      parentDirectoryPath: "docs",
      kind: "file",
      orderedRelativePaths: ["docs/b.md", "docs/a.md"]
    })).resolves.toEqual({ status: "saved" });

    const order = await readProjectExplorerOrderState({ rootPath });
    expect(order.directories.docs.files).toEqual(["docs/b.md", "docs/a.md"]);
    const workspace = await scanProjectFolder(rootPath);
    expect(workspace.resourceOrder).toEqual(order);
    expect(workspace.resources.filter((resource) => resource.kind === "file").map((resource) => resource.relativePath)).toEqual([
      "docs/b.md",
      "docs/a.md"
    ]);
  });

  it("keeps order metadata aligned with rename, move, and delete mutations", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-order-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs"));
    await writeFile(path.join(rootPath, "docs", "a.md"), "a", "utf8");
    await writeFile(path.join(rootPath, "docs", "b.md"), "b", "utf8");
    await reorderProjectResources({ rootPath, parentDirectoryPath: "docs", kind: "file", orderedRelativePaths: ["docs/b.md", "docs/a.md"] });

    await expect(renameProjectResource({ rootPath, sourcePath: "docs/a.md", name: "c.md" })).resolves.toMatchObject({ status: "renamed" });
    expect((await readProjectExplorerOrderState({ rootPath })).directories.docs.files).toEqual(["docs/b.md", "docs/c.md"]);

    await expect(moveProjectResources({
      rootPath,
      sourcePaths: ["docs/b.md"],
      targetDirectoryPath: "",
      placement: { kind: "file", parentDirectoryPath: "", beforeRelativePath: null }
    })).resolves.toMatchObject({ status: "completed" });
    const afterMove = await readProjectExplorerOrderState({ rootPath });
    expect(afterMove.directories[""].files).toEqual(["b.md"]);
    expect(afterMove.directories.docs.files).toEqual(["docs/c.md"]);

    await expect(deleteProjectResources({ rootPath, sourcePaths: ["docs/c.md"] })).resolves.toMatchObject({ status: "deleted" });
    expect((await readProjectExplorerOrderState({ rootPath })).directories.docs).toBeUndefined();
  });

  it("does not overwrite invalid order metadata as a side effect of file creation", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-order-"));
    roots.push(rootPath);
    const metadataDirectory = path.join(rootPath, PROJECT_EXPLORER_ORDER_DIRECTORY);
    const metadataPath = path.join(metadataDirectory, PROJECT_EXPLORER_ORDER_FILE);
    await mkdir(metadataDirectory);
    await writeFile(metadataPath, "{ bad json", "utf8");

    await expect(reorderProjectResources({ rootPath, parentDirectoryPath: "", kind: "file", orderedRelativePaths: [] })).rejects.toMatchObject({ code: "read_failed" });
    await expect(createProjectFile({ rootPath, directoryPath: "", fileName: "notes.md", kind: "markdown", text: "" })).resolves.toMatchObject({ status: "created" });
    expect(await readFile(metadataPath, "utf8")).toBe("{ bad json");
  });

  it("appends copied and imported resources to Explorer order metadata", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-order-"));
    const externalRoot = await mkdtemp(path.join(tmpdir(), "mmm-project-import-"));
    roots.push(rootPath, externalRoot);
    await mkdir(path.join(rootPath, "docs"));
    await mkdir(path.join(rootPath, "archive"));
    await writeFile(path.join(rootPath, "docs", "a.md"), "a", "utf8");
    await writeFile(path.join(externalRoot, "asset.md"), "asset", "utf8");
    await reorderProjectResources({ rootPath, parentDirectoryPath: "docs", kind: "file", orderedRelativePaths: ["docs/a.md"] });

    await expect(copyProjectResources({ rootPath, sourcePaths: ["docs/a.md"], targetDirectoryPath: "archive" })).resolves.toMatchObject({ status: "completed" });
    await expect(importProjectResources({ rootPath, externalPaths: [path.join(externalRoot, "asset.md")], targetDirectoryPath: "docs" })).resolves.toMatchObject({ status: "completed" });

    const order = await readProjectExplorerOrderState({ rootPath });
    expect(order.directories.archive.files).toEqual(["archive/a.md"]);
    expect(order.directories.docs.files).toEqual(["docs/a.md", "docs/asset.md"]);
    const workspace = await scanProjectFolder(rootPath);
    const filePaths = workspace.resources.filter((resource) => resource.kind === "file").map((resource) => resource.relativePath);
    expect(filePaths).toEqual(expect.arrayContaining([
      "docs/a.md",
      "archive/a.md",
      "docs/asset.md"
    ]));
    expect(filePaths.indexOf("docs/a.md")).toBeLessThan(filePaths.indexOf("docs/asset.md"));
  });
});
