import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  copyProjectResources,
  createProjectDirectory,
  createProjectDocument,
  createProjectFile,
  createProjectTextFile,
  deleteProjectResources,
  importProjectResources,
  moveProjectFile,
  moveProjectResources,
  renameProjectResource
} = require("../../../../../electron/project-documents.cjs") as {
  createProjectDirectory: (request: Record<string, unknown>) => Promise<{
    status: "created" | "exists";
    resource: { kind: "directory"; name: string; path: string; relativePath: string };
  }>;
  createProjectDocument: (request: Record<string, unknown>) => Promise<{
    status: "created" | "exists";
    file: { name: string; path: string };
    text?: string;
  }>;
  createProjectTextFile: (request: Record<string, unknown>) => Promise<{
    status: "created" | "exists";
    file: { name: string; path: string };
    text?: string;
  }>;
  createProjectFile: (request: Record<string, unknown>) => Promise<{
    status: "created" | "exists";
    file: { name: string; path: string };
    text?: string;
  }>;
  moveProjectFile: (request: Record<string, unknown>) => Promise<{
    status: "moved" | "exists" | "noop";
    file: { name: string; path: string };
    sourcePath?: string;
  }>;
  renameProjectResource: (request: Record<string, unknown>) => Promise<{
    status: "renamed" | "exists" | "noop";
    resource: { kind: "file" | "directory"; name: string; path: string; relativePath: string };
    sourcePath: string;
  }>;
  moveProjectResources: (request: Record<string, unknown>) => Promise<{
    status: "completed";
    results: { status: "moved" | "exists" | "noop"; resource: { kind: "file" | "directory"; name: string; path: string; relativePath: string }; sourcePath: string }[];
  }>;
  copyProjectResources: (request: Record<string, unknown>) => Promise<{
    status: "completed";
    results: { status: "copied" | "exists" | "noop"; resource: { kind: "file" | "directory"; name: string; path: string; relativePath: string }; sourcePath: string }[];
  }>;
  importProjectResources: (request: Record<string, unknown>) => Promise<{
    status: "completed";
    results: { status: "imported" | "exists" | "noop"; resource: { kind: "file" | "directory"; name: string; path: string; relativePath: string }; sourcePath: string }[];
  }>;
  deleteProjectResources: (request: Record<string, unknown>, options?: { trashItem?: (path: string) => Promise<void> }) => Promise<{
    status: "deleted";
    resources: { kind: "file" | "directory"; name: string; path: string; relativePath: string }[];
  }>;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Electron project document creation", () => {
  it("creates a Markdown file once and never overwrites an existing file", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    const request = { rootPath, fileName: "design.md", documentKind: "markdown", text: "# Design\n" };

    expect((await createProjectDocument(request)).status).toBe("created");
    await writeFile(path.join(rootPath, "design.md"), "keep me", "utf8");
    expect((await createProjectDocument(request)).status).toBe("exists");
    expect(await readFile(path.join(rootPath, "design.md"), "utf8")).toBe("keep me");
  });

  it("rejects paths, unsupported extensions, and non-Markdown kinds", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);

    await expect(createProjectDocument({ rootPath, fileName: "../escape.md", documentKind: "markdown", text: "" })).rejects.toThrow();
    await expect(createProjectDocument({ rootPath, fileName: "notes.txt", documentKind: "markdown", text: "" })).rejects.toThrow();
    await expect(createProjectDocument({ rootPath, fileName: "notes.md", documentKind: "mermaid", text: "" })).rejects.toThrow();
  });

  it("creates a root-level CSV text file once", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    const request = { rootPath, fileName: "people.csv", kind: "csv", text: "Name\r\nAlice" };

    expect((await createProjectTextFile(request)).status).toBe("created");
    await writeFile(path.join(rootPath, "people.csv"), "keep me", "utf8");
    expect((await createProjectTextFile(request)).status).toBe("exists");
    expect(await readFile(path.join(rootPath, "people.csv"), "utf8")).toBe("keep me");
    await expect(createProjectTextFile({ ...request, fileName: "../escape.csv" })).rejects.toThrow();
    await expect(createProjectTextFile({ ...request, fileName: "people.md" })).rejects.toThrow();
    await expect(createProjectTextFile({ ...request, fileName: "huge.csv", text: "x".repeat(1_048_577) })).resolves.toMatchObject({ status: "created" });
  });

  it("creates every supported project file kind in an existing nested directory", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs", "data"), { recursive: true });
    const cases = [
      ["mermaid", "diagram.mmd", "flowchart TD"],
      ["markdown", "notes.markdown", "# Notes\n"],
      ["csv", "table.csv", "A\r\n1"],
      ["text", "notes.txt", "Plain text"],
      ["html", "index.html", "<!doctype html>"]
    ] as const;

    for (const [kind, fileName, text] of cases) {
      const result = await createProjectFile({ rootPath, directoryPath: "docs/data", fileName, kind, text });
      expect(result.status).toBe("created");
      expect(await readFile(path.join(rootPath, "docs", "data", fileName), "utf8")).toBe(text);
      expect((await createProjectFile({ rootPath, directoryPath: path.join(rootPath, "docs", "data"), fileName, kind, text: "replace" })).status).toBe("exists");
      expect(await readFile(path.join(rootPath, "docs", "data", fileName), "utf8")).toBe(text);
    }
  });

  it("rejects mismatched extensions, traversal, outside directories, and symbolic-link directories", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    const outsidePath = await mkdtemp(path.join(tmpdir(), "mmm-project-outside-"));
    roots.push(rootPath, outsidePath);
    await mkdir(path.join(rootPath, "docs"));
    await symlink(outsidePath, path.join(rootPath, "linked"), "dir");

    await expect(createProjectFile({ rootPath, directoryPath: "docs", fileName: "notes.csv", kind: "markdown", text: "" })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(createProjectFile({ rootPath, directoryPath: "../", fileName: "notes.md", kind: "markdown", text: "" })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(createProjectFile({ rootPath, directoryPath: outsidePath, fileName: "notes.md", kind: "markdown", text: "" })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(createProjectFile({ rootPath, directoryPath: "linked", fileName: "notes.md", kind: "markdown", text: "" })).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("rejects non-portable names and oversized project files", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);

    for (const fileName of ["CON.md", "notes?.md", "notes.md.", "notes.md:stream.md"]) {
      await expect(createProjectFile({ rootPath, directoryPath: "", fileName, kind: "markdown", text: "" }))
        .rejects.toMatchObject({ code: "unsupported_type" });
    }
    await expect(createProjectFile({
      rootPath,
      directoryPath: "",
      fileName: "huge.md",
      kind: "markdown",
      text: "x".repeat(16 * 1_048_576 + 1)
    })).rejects.toMatchObject({ code: "write_failed" });
  });

  it("moves regular files without overwriting and reports noop", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "source"));
    await mkdir(path.join(rootPath, "target"));
    await writeFile(path.join(rootPath, "source", "notes.md"), "move me", "utf8");

    const moved = await moveProjectFile({ rootPath, sourcePath: "source/notes.md", targetDirectoryPath: "target" });
    expect(moved).toMatchObject({ status: "moved", file: { name: "notes.md", path: await realpath(path.join(rootPath, "target", "notes.md")) } });
    expect(await readFile(path.join(rootPath, "target", "notes.md"), "utf8")).toBe("move me");
    await expect(readFile(path.join(rootPath, "source", "notes.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect((await moveProjectFile({ rootPath, sourcePath: "target/notes.md", targetDirectoryPath: "target" })).status).toBe("noop");

    await writeFile(path.join(rootPath, "source", "notes.md"), "keep source", "utf8");
    expect((await moveProjectFile({ rootPath, sourcePath: "source/notes.md", targetDirectoryPath: "target" })).status).toBe("exists");
    expect(await readFile(path.join(rootPath, "source", "notes.md"), "utf8")).toBe("keep source");
    expect(await readFile(path.join(rootPath, "target", "notes.md"), "utf8")).toBe("move me");
  });

  it("rejects moving paths outside the project, directories, and symbolic links", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    const outsidePath = await mkdtemp(path.join(tmpdir(), "mmm-project-outside-"));
    roots.push(rootPath, outsidePath);
    await mkdir(path.join(rootPath, "target"));
    await writeFile(path.join(outsidePath, "outside.md"), "outside", "utf8");
    await symlink(path.join(outsidePath, "outside.md"), path.join(rootPath, "linked.md"));

    await expect(moveProjectFile({ rootPath, sourcePath: path.join(outsidePath, "outside.md"), targetDirectoryPath: "target" })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(moveProjectFile({ rootPath, sourcePath: "target", targetDirectoryPath: "" })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(moveProjectFile({ rootPath, sourcePath: "linked.md", targetDirectoryPath: "target" })).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("creates project directories once without overwriting", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs"));

    const created = await createProjectDirectory({ rootPath, directoryPath: "docs", directoryName: "drafts" });
    expect(created).toMatchObject({ status: "created", resource: { kind: "directory", name: "drafts", relativePath: "docs/drafts" } });
    expect((await stat(path.join(rootPath, "docs", "drafts"))).isDirectory()).toBe(true);
    expect((await createProjectDirectory({ rootPath, directoryPath: "docs", directoryName: "drafts" })).status).toBe("exists");
    await expect(createProjectDirectory({ rootPath, directoryPath: "docs", directoryName: "../escape" })).rejects.toMatchObject({ code: "unsupported_type" });
  });

  it("renames project files and directories without overwriting", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs"));
    await writeFile(path.join(rootPath, "docs", "notes.md"), "notes", "utf8");
    await writeFile(path.join(rootPath, "docs", "existing.md"), "existing", "utf8");

    const renamedFile = await renameProjectResource({ rootPath, sourcePath: "docs/notes.md", name: "renamed.md" });
    expect(renamedFile).toMatchObject({ status: "renamed", resource: { kind: "file", relativePath: "docs/renamed.md" } });
    expect(await readFile(path.join(rootPath, "docs", "renamed.md"), "utf8")).toBe("notes");
    expect((await renameProjectResource({ rootPath, sourcePath: "docs/renamed.md", name: "existing.md" })).status).toBe("exists");

    const renamedDirectory = await renameProjectResource({ rootPath, sourcePath: "docs", name: "archive" });
    expect(renamedDirectory).toMatchObject({ status: "renamed", resource: { kind: "directory", relativePath: "archive" } });
    expect(await readFile(path.join(rootPath, "archive", "renamed.md"), "utf8")).toBe("notes");
  });

  it("moves directories as resources and rejects moving a directory into itself", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs", "nested"), { recursive: true });
    await mkdir(path.join(rootPath, "archive"));
    await writeFile(path.join(rootPath, "docs", "nested", "notes.md"), "notes", "utf8");

    await expect(moveProjectResources({ rootPath, sourcePaths: ["docs"], targetDirectoryPath: "docs/nested" })).rejects.toMatchObject({ code: "unsupported_type" });
    const moved = await moveProjectResources({ rootPath, sourcePaths: ["docs"], targetDirectoryPath: "archive" });
    expect(moved.results).toMatchObject([{ status: "moved", resource: { kind: "directory", relativePath: "archive/docs" } }]);
    expect(await readFile(path.join(rootPath, "archive", "docs", "nested", "notes.md"), "utf8")).toBe("notes");
  });

  it("copies project resources and imports external resources without overwriting", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    const outsidePath = await mkdtemp(path.join(tmpdir(), "mmm-project-outside-"));
    roots.push(rootPath, outsidePath);
    await mkdir(path.join(rootPath, "docs"));
    await mkdir(path.join(rootPath, "copies"));
    await writeFile(path.join(rootPath, "docs", "notes.md"), "notes", "utf8");
    await writeFile(path.join(outsidePath, "external.md"), "external", "utf8");

    const copied = await copyProjectResources({ rootPath, sourcePaths: ["docs/notes.md"], targetDirectoryPath: "copies" });
    expect(copied.results).toMatchObject([{ status: "copied", resource: { kind: "file", relativePath: "copies/notes.md" } }]);
    expect(await readFile(path.join(rootPath, "copies", "notes.md"), "utf8")).toBe("notes");
    expect((await copyProjectResources({ rootPath, sourcePaths: ["docs/notes.md"], targetDirectoryPath: "copies" })).results[0].status).toBe("exists");

    const imported = await importProjectResources({ rootPath, externalPaths: [path.join(outsidePath, "external.md")], targetDirectoryPath: "docs" });
    expect(imported.results).toMatchObject([{ status: "imported", resource: { kind: "file", relativePath: "docs/external.md" } }]);
    expect(await readFile(path.join(rootPath, "docs", "external.md"), "utf8")).toBe("external");
  });

  it("deletes resources through the injected trash function", async () => {
    const rootPath = await mkdtemp(path.join(tmpdir(), "mmm-project-document-"));
    roots.push(rootPath);
    await mkdir(path.join(rootPath, "docs"));
    await writeFile(path.join(rootPath, "docs", "notes.md"), "notes", "utf8");
    const trashed: string[] = [];

    const deleted = await deleteProjectResources({ rootPath, sourcePaths: ["docs/notes.md"] }, {
      trashItem: async (target) => {
        trashed.push(target);
        await rm(target, { force: true });
      }
    });

    expect(deleted).toMatchObject({ status: "deleted", resources: [{ kind: "file", relativePath: "docs/notes.md" }] });
    expect(trashed).toHaveLength(1);
    await expect(readFile(path.join(rootPath, "docs", "notes.md"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
