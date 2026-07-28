import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { encodeDocumentText, readDocumentFile, writeDocumentFile } = require("./document-files.cjs");

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("document file encoding", () => {
  for (const format of [
    { encoding: "utf8", bom: true, lineEnding: "crlf" },
    { encoding: "utf16le", bom: true, lineEnding: "lf" },
    { encoding: "utf16be", bom: true, lineEnding: "crlf" },
    { encoding: "gb18030", bom: false, lineEnding: "lf" }
  ] as const) {
    it(`round-trips ${format.encoding} without changing its format`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "mmm-document-format-"));
      directories.push(directory);
      const path = join(directory, "文档.txt");
      const source = "标题\n第二行：表格与文本\n";
      await writeFile(path, encodeDocumentText(source, format));

      const opened = await readDocumentFile(path);
      const saved = await writeDocumentFile(path, `${opened.text}追加`, { expectedRevision: opened.revision, format: opened.format });
      const reopened = await readDocumentFile(path);

      expect(saved.status).toBe("saved");
      expect(opened.format).toEqual(format);
      expect(reopened.format).toEqual(format);
      expect(reopened.text).toBe(`${source.replace(/\n/g, format.lineEnding === "crlf" ? "\r\n" : "\n")}追加`);
      expect(await readFile(path)).toEqual(encodeDocumentText(reopened.text, format));
    });
  }

  for (const encoding of ["utf16le", "utf16be"] as const) {
    it(`detects ${encoding} text without a BOM`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "mmm-document-format-"));
      directories.push(directory);
      const path = join(directory, "bomless.txt");
      await writeFile(path, encodeDocumentText("Alpha\nBeta\n", { encoding, bom: false, lineEnding: "lf" }));

      const opened = await readDocumentFile(path);

      expect(opened.text).toBe("Alpha\nBeta\n");
      expect(opened.format).toEqual({ encoding, bom: false, lineEnding: "lf" });
    });
  }
});
