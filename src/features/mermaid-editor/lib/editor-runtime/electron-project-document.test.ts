import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createProjectDocument } = require("../../../../../electron/project-documents.cjs") as {
  createProjectDocument: (request: Record<string, unknown>) => Promise<{
    status: "created" | "exists";
    file: { name: string; path: string };
    text?: string;
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
});
