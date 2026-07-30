// @vitest-environment node

import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type ImageAssetContext = {
  projectRoot?: string;
  storageScope?: "document" | "project";
  rootFallback?: boolean;
};

type ImageAssetResult = {
  src: string;
  path: string;
  copied: boolean;
  displaySrc: string;
};

const require = createRequire(import.meta.url);
const imageAssets = require("./image-assets.cjs") as {
  importImageAssetBytes: (documentPath: string, fileName: string, bytes: Uint8Array, context?: ImageAssetContext) => Promise<ImageAssetResult>;
  importImageAssetPath: (documentPath: string, imagePath: string, context?: ImageAssetContext) => Promise<ImageAssetResult>;
  resolveImageAssetPath: (documentPath: string | null, src: string, context?: ImageAssetContext) => Promise<string | null>;
};

describe("Electron image assets", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("stores Markdown uploads in the project assets directory", async () => {
    const root = await temporaryProject();
    const documentPath = path.join(root, "docs", "guide.md");
    const context = { projectRoot: root, storageScope: "project" as const, rootFallback: true };

    const result = await imageAssets.importImageAssetBytes(documentPath, "cover.png", Uint8Array.from([1, 2, 3]), context);

    expect(result.path).toMatch(new RegExp(`${escapeRegExp(path.join(root, "assets", "guide"))}[/\\\\]cover-[a-f0-9]{8}\\.png$`));
    expect(result.src).toMatch(/^\.\.\/assets\/guide\/cover-[a-f0-9]{8}\.png$/);
    expect(result.copied).toBe(true);
    await expect(readFile(result.path)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it("references existing project images without copying them", async () => {
    const root = await temporaryProject();
    const documentPath = path.join(root, "docs", "guide.markdown");
    const imagePath = path.join(root, "assets", "shared", "cover.png");
    await mkdir(path.dirname(imagePath), { recursive: true });
    await writeFile(imagePath, "image");

    const result = await imageAssets.importImageAssetPath(documentPath, imagePath, {
      projectRoot: root,
      storageScope: "project"
    });

    expect(result).toMatchObject({ path: imagePath, src: "../assets/shared/cover.png", copied: false });
  });

  it("falls back to document-local assets outside the project", async () => {
    const root = await temporaryProject();
    const standaloneDir = await temporaryDirectory("mermaid-standalone-");
    const documentPath = path.join(standaloneDir, "notes.md");
    await writeFile(documentPath, "# Notes");

    const result = await imageAssets.importImageAssetBytes(documentPath, "photo.jpg", Uint8Array.from([4]), {
      projectRoot: root,
      storageScope: "project"
    });

    expect(result.path.startsWith(path.join(standaloneDir, "assets", "notes"))).toBe(true);
    expect(result.src).toMatch(/^assets\/notes\/photo-[a-f0-9]{8}\.jpg$/);
  });

  it("resolves explicit paths from the document and bare paths with a project-root fallback", async () => {
    const root = await temporaryProject();
    const documentPath = path.join(root, "docs", "guide.md");
    const documentImage = path.join(root, "docs", "assets", "local.png");
    const conflictingRootImage = path.join(root, "assets", "local.png");
    const rootImage = path.join(root, "assets", "shared.png");
    await mkdir(path.dirname(documentImage), { recursive: true });
    await mkdir(path.dirname(rootImage), { recursive: true });
    await writeFile(documentImage, "local");
    await writeFile(conflictingRootImage, "root-local");
    await writeFile(rootImage, "root");
    const context = { projectRoot: root, rootFallback: true };

    await expect(imageAssets.resolveImageAssetPath(documentPath, "./assets/local.png", context)).resolves.toBe(documentImage);
    await expect(imageAssets.resolveImageAssetPath(documentPath, "assets/local.png", context)).resolves.toBe(documentImage);
    await expect(imageAssets.resolveImageAssetPath(documentPath, "assets/shared.png", context)).resolves.toBe(rootImage);
    await expect(imageAssets.resolveImageAssetPath(documentPath, pathToFileURL(rootImage).toString(), context)).resolves.toBe(rootImage);
    await expect(imageAssets.resolveImageAssetPath(documentPath, "https://example.com/image.png", context)).resolves.toBeNull();
  });

  it("preserves the existing Mermaid document-local import behavior without context", async () => {
    const root = await temporaryProject();
    const documentPath = path.join(root, "diagram.mmd");
    const externalDir = await temporaryDirectory("mermaid-image-source-");
    const imagePath = path.join(externalDir, "source.png");
    await writeFile(imagePath, "image");

    const result = await imageAssets.importImageAssetPath(documentPath, imagePath);

    expect(result.path.startsWith(path.join(root, "assets", "diagram"))).toBe(true);
    expect(result.src).toMatch(/^assets\/diagram\/source-[a-f0-9]{8}\.png$/);
    expect(result.copied).toBe(true);
  });

  async function temporaryProject() {
    const root = await temporaryDirectory("mermaid-image-project-");
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "docs", "guide.md"), "# Guide");
    await writeFile(path.join(root, "docs", "guide.markdown"), "# Guide");
    await writeFile(path.join(root, "diagram.mmd"), "flowchart TD");
    return root;
  }

  async function temporaryDirectory(prefix: string) {
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
