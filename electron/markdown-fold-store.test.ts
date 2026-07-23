// @vitest-environment node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

import type { MarkdownFoldSnapshot } from "../src/features/mermaid-editor/lib/markdown-fold-state";

const require = createRequire(import.meta.url);
const {
  moveProjectMarkdownFoldState,
  readProjectMarkdownFoldState,
  writeProjectMarkdownFoldState
} = require("./markdown-fold-store.cjs") as {
  moveProjectMarkdownFoldState: (request: { rootPath: string; sourcePath: string; targetPath: string }) => Promise<{ status: string }>;
  readProjectMarkdownFoldState: (request: { rootPath: string; documentPath: string }) => Promise<MarkdownFoldSnapshot | null>;
  writeProjectMarkdownFoldState: (request: { rootPath: string; documentPath: string; snapshot: MarkdownFoldSnapshot }) => Promise<{ status: string }>;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function projectRoot() {
  const root = await mkdtemp(join(tmpdir(), "mmm-markdown-folds-"));
  roots.push(root);
  await mkdir(join(root, "docs"), { recursive: true });
  return root;
}

function snapshot(label: string): MarkdownFoldSnapshot {
  return {
    version: 1,
    documentFingerprint: `fingerprint:${label}`,
    folds: [{ kind: "heading", outline: [{ level: 1, label, occurrence: 0 }] }]
  };
}

describe("Electron Markdown fold store", () => {
  it("persists project-relative document records in one hidden sidecar", async () => {
    const root = await projectRoot();
    const documentPath = join(root, "docs", "notes.md");

    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath })).resolves.toBeNull();
    await writeProjectMarkdownFoldState({ rootPath: root, documentPath, snapshot: snapshot("Notes") });

    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath })).resolves.toEqual(snapshot("Notes"));
    const stored = JSON.parse(await readFile(join(root, ".mermaid-canvas-editor", "markdown-folds.json"), "utf8"));
    expect(stored.documents).toHaveProperty("docs/notes.md");
  });

  it("serializes concurrent writes so different Electron windows do not overwrite each other", async () => {
    const root = await projectRoot();
    const firstPath = join(root, "docs", "first.md");
    const secondPath = join(root, "docs", "second.md");

    await Promise.all([
      writeProjectMarkdownFoldState({ rootPath: root, documentPath: firstPath, snapshot: snapshot("First") }),
      writeProjectMarkdownFoldState({ rootPath: root, documentPath: secondPath, snapshot: snapshot("Second") })
    ]);

    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath: firstPath })).resolves.toEqual(snapshot("First"));
    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath: secondPath })).resolves.toEqual(snapshot("Second"));
  });

  it("removes expanded documents and migrates folded records when files move", async () => {
    const root = await projectRoot();
    const sourcePath = join(root, "docs", "source.md");
    const targetPath = join(root, "target.md");
    await writeProjectMarkdownFoldState({ rootPath: root, documentPath: sourcePath, snapshot: snapshot("Source") });

    await expect(moveProjectMarkdownFoldState({ rootPath: root, sourcePath, targetPath })).resolves.toEqual({ status: "moved" });
    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath: sourcePath })).resolves.toBeNull();
    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath: targetPath })).resolves.toEqual(snapshot("Source"));

    await writeProjectMarkdownFoldState({
      rootPath: root,
      documentPath: targetPath,
      snapshot: { version: 1, documentFingerprint: "expanded", folds: [] }
    });
    await expect(readProjectMarkdownFoldState({ rootPath: root, documentPath: targetPath })).resolves.toBeNull();
  });

  it("rejects paths outside the project and refuses to overwrite corrupt metadata", async () => {
    const root = await projectRoot();
    await expect(writeProjectMarkdownFoldState({
      rootPath: root,
      documentPath: join(root, "..", "outside.md"),
      snapshot: snapshot("Outside")
    })).rejects.toMatchObject({ code: "permission_denied" });

    const metadataPath = join(root, ".mermaid-canvas-editor", "markdown-folds.json");
    await mkdir(join(root, ".mermaid-canvas-editor"), { recursive: true });
    await writeFile(metadataPath, "not-json", "utf8");
    await expect(writeProjectMarkdownFoldState({
      rootPath: root,
      documentPath: join(root, "docs", "notes.md"),
      snapshot: snapshot("Notes")
    })).rejects.toMatchObject({ code: "read_failed" });
    await expect(readFile(metadataPath, "utf8")).resolves.toBe("not-json");
  });
});
