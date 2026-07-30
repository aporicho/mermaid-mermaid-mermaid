// @vitest-environment node

import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type MarkdownReference = { start: number; end: number; href: string; mode: "media" | "link" | "mixed" };
type ExportResult = {
  status: "exported";
  directoryPath: string;
  copiedFiles: number;
  warnings: Array<{ reference: string; reason: string }>;
};

const require = createRequire(import.meta.url);
const { findMarkdownFileReferences } = require("./markdown-export-links.cjs") as {
  findMarkdownFileReferences: (source: string) => Promise<MarkdownReference[]>;
};
const { exportMarkdownFolder } = require("./markdown-export.cjs") as {
  exportMarkdownFolder: (request: { sourcePath: string; documentText?: string; projectRoot?: string; parentDirectory: string }) => Promise<ExportResult>;
};

describe("Markdown folder export", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it("finds only used Markdown and HTML file destinations", async () => {
    const source = [
      "![cover](./cover.png)",
      "[report](reports/report.pdf#page=2)",
      "",
      "[shared]: ../shared.csv",
      "[unused]: missing.bin",
      "",
      "![data][shared]",
      "<video poster=\"./poster.jpg\" src='./demo.mp4'></video>",
      "<img srcset=\"./small.png 1x, ./large.png 2x\">",
      "<a href=\"./appendix.pdf\">appendix</a>",
      "`[ignored](code.txt)`",
      "```md",
      "![ignored](fenced.png)",
      "```"
    ].join("\n");

    const references = await findMarkdownFileReferences(source);

    expect(references.map(({ href, mode }) => ({ href, mode }))).toEqual([
      { href: "./cover.png", mode: "media" },
      { href: "reports/report.pdf#page=2", mode: "link" },
      { href: "../shared.csv", mode: "media" },
      { href: "./poster.jpg", mode: "media" },
      { href: "./demo.mp4", mode: "media" },
      { href: "./small.png", mode: "media" },
      { href: "./large.png", mode: "media" },
      { href: "./appendix.pdf", mode: "link" }
    ]);
  });

  it("copies referenced files byte-for-byte and rewrites only their destinations", async () => {
    const root = await temporaryDirectory("mmm-markdown-export-");
    const outputParent = path.join(root, "exports");
    const documentPath = path.join(root, "docs", "guide.md");
    await mkdir(path.dirname(documentPath), { recursive: true });
    await mkdir(path.join(root, "assets"), { recursive: true });
    await mkdir(outputParent);
    await writeFile(documentPath, "# stale disk content\n");
    await writeFile(path.join(root, "docs", "cover.png"), Buffer.from([0, 1, 2, 255]));
    await writeFile(path.join(root, "assets", "table.csv"), "a,b\n1,2\n");
    await mkdir(path.join(outputParent, "guide-export"));

    const documentText = [
      "# Current buffer",
      "![cover](./cover.png)",
      "[table](assets/table.csv?download=1)",
      "![again](./cover.png)",
      "[remote](https://example.com/file.pdf)",
      "[missing](./missing.pdf)"
    ].join("\n");
    const result = await exportMarkdownFolder({
      sourcePath: documentPath,
      documentText,
      projectRoot: root,
      parentDirectory: outputParent
    });

    expect(result.directoryPath).toBe(path.join(outputParent, "guide-export-2"));
    expect(result.copiedFiles).toBe(2);
    expect(result.warnings).toEqual([{ reference: "./missing.pdf", reason: "找不到文件" }]);
    await expect(readFile(path.join(result.directoryPath, "assets", "cover.png"))).resolves.toEqual(Buffer.from([0, 1, 2, 255]));
    await expect(readFile(path.join(result.directoryPath, "assets", "table.csv"), "utf8")).resolves.toBe("a,b\n1,2\n");
    await expect(readFile(path.join(result.directoryPath, "guide.md"), "utf8")).resolves.toBe([
      "# Current buffer",
      "![cover](assets/cover.png)",
      "[table](assets/table.csv?download=1)",
      "![again](assets/cover.png)",
      "[remote](https://example.com/file.pdf)",
      "[missing](./missing.pdf)"
    ].join("\n"));
  });

  it("keeps colliding file names distinct without inspecting their contents", async () => {
    const root = await temporaryDirectory("mmm-markdown-export-collision-");
    const documentPath = path.join(root, "docs", "note.markdown");
    const outputParent = path.join(root, "exports");
    await mkdir(path.dirname(documentPath), { recursive: true });
    await mkdir(outputParent);
    await writeFile(documentPath, "");
    await writeFile(path.join(root, "docs", "same.bin"), Buffer.from([1]));
    await writeFile(path.join(root, "same.bin"), Buffer.from([2]));

    const result = await exportMarkdownFolder({
      sourcePath: documentPath,
      documentText: "![local](./same.bin)\n[root](same.bin)",
      projectRoot: root,
      parentDirectory: outputParent
    });

    await expect(readFile(path.join(result.directoryPath, "assets", "same.bin"))).resolves.toEqual(Buffer.from([1]));
    await expect(readFile(path.join(result.directoryPath, "assets", "same-2.bin"))).resolves.toEqual(Buffer.from([2]));
    await expect(readFile(path.join(result.directoryPath, "note.markdown"), "utf8")).resolves.toBe(
      "![local](assets/same.bin)\n[root](assets/same-2.bin)"
    );
  });

  async function temporaryDirectory(prefix: string) {
    const directory = await mkdtemp(path.join(tmpdir(), prefix));
    temporaryDirectories.push(directory);
    return directory;
  }
});
