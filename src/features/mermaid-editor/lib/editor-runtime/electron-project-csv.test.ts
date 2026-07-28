import { createRequire } from "node:module";
import { chmod, mkdtemp, readFile, realpath, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { readProjectCsvFile, writeProjectCsvFile } = require("../../../../../electron/project-csv.cjs") as {
  readProjectCsvFile: (request: { rootPath: string; path: string }) => Promise<{
    file: { name: string; path: string };
    text: string;
    revision: string;
    modifiedAt: number;
  }>;
  writeProjectCsvFile: (request: { rootPath: string; path: string; text: string; expectedRevision: string }) => Promise<{
    status: "saved" | "conflict";
    revision: string;
    modifiedAt: number;
  }>;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Electron project CSV files", () => {
  it("reads UTF-8 snapshots and atomically replaces the file when the revision matches", async () => {
    const rootPath = await temporaryRoot();
    const filePath = path.join(rootPath, "table.csv");
    await writeFile(filePath, "A,B\r\n1,2", "utf8");
    await chmod(filePath, 0o640);
    const realFilePath = await realpath(filePath);
    const snapshot = await readProjectCsvFile({ rootPath, path: filePath });

    const saved = await writeProjectCsvFile({ rootPath, path: filePath, text: "A,B\r\n3,4", expectedRevision: snapshot.revision });

    expect(snapshot).toMatchObject({ file: { name: "table.csv", path: realFilePath }, text: "A,B\r\n1,2" });
    expect(snapshot.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(saved).toMatchObject({ status: "saved" });
    expect(await readFile(filePath, "utf8")).toBe("A,B\r\n3,4");
    expect((await stat(filePath)).mode & 0o777).toBe(0o640);
    expect((await readdir(rootPath)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("returns a conflict for stale revisions and never overwrites newer content", async () => {
    const rootPath = await temporaryRoot();
    const filePath = path.join(rootPath, "table.csv");
    await writeFile(filePath, "A\r\nold", "utf8");
    const snapshot = await readProjectCsvFile({ rootPath, path: filePath });
    await writeFile(filePath, "A\r\nnewer", "utf8");

    const result = await writeProjectCsvFile({ rootPath, path: filePath, text: "A\r\nstale", expectedRevision: snapshot.revision });

    expect(result).toMatchObject({ status: "conflict" });
    expect(await readFile(filePath, "utf8")).toBe("A\r\nnewer");
  });

  it("serializes concurrent writes so only one matching revision can commit", async () => {
    const rootPath = await temporaryRoot();
    const filePath = path.join(rootPath, "table.csv");
    await writeFile(filePath, "A\r\n0", "utf8");
    const snapshot = await readProjectCsvFile({ rootPath, path: filePath });

    const results = await Promise.all([
      writeProjectCsvFile({ rootPath, path: filePath, text: "A\r\n1", expectedRevision: snapshot.revision }),
      writeProjectCsvFile({ rootPath, path: filePath, text: "A\r\n2", expectedRevision: snapshot.revision })
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "saved"]);
  });

  it("rejects traversal, non-CSV files and symlinks while accepting supported encodings and large files", async () => {
    const rootPath = await temporaryRoot();
    const outsideRoot = await temporaryRoot();
    const outsideCsv = path.join(outsideRoot, "outside.csv");
    await writeFile(outsideCsv, "A\r\n1", "utf8");
    const linkedCsv = path.join(rootPath, "linked.csv");
    await symlink(outsideCsv, linkedCsv);
    const utf16Csv = path.join(rootPath, "utf16.csv");
    await writeFile(utf16Csv, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("A\r\n1", "utf16le")]));
    const hugeCsv = path.join(rootPath, "huge.csv");
    await writeFile(hugeCsv, Buffer.alloc(2 * 1_048_576, 0x41));

    await expect(readProjectCsvFile({ rootPath, path: outsideCsv })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(readProjectCsvFile({ rootPath, path: path.join(rootPath, "notes.txt") })).rejects.toMatchObject({ code: "unsupported_type" });
    await expect(readProjectCsvFile({ rootPath, path: linkedCsv })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(readProjectCsvFile({ rootPath, path: utf16Csv })).resolves.toMatchObject({ text: "A\r\n1", format: { encoding: "utf16le" } });
    await expect(readProjectCsvFile({ rootPath, path: hugeCsv })).resolves.toMatchObject({ text: expect.stringMatching(/^A{2097152}$/) });
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "mmm-project-csv-"));
  roots.push(root);
  return root;
}
