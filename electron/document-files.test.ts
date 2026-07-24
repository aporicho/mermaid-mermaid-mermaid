import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// This test intentionally loads the CommonJS module used directly by Electron.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readDocumentFile, writeDocumentFile } = require("./document-files.cjs") as {
  readDocumentFile: (filePath: string) => Promise<{ text: string; revision: string }>;
  writeDocumentFile: (filePath: string, text: string, options?: { expectedRevision?: string; overwrite?: boolean }) => Promise<{ status: "saved" | "conflict"; revision: string }>;
};

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("document file revisions", () => {
  it("writes atomically when the expected revision still matches", async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, "notes.md");
    await writeFile(filePath, "before", "utf8");
    const opened = await readDocumentFile(filePath);

    const result = await writeDocumentFile(filePath, "after", { expectedRevision: opened.revision });

    expect(result.status).toBe("saved");
    expect(await readFile(filePath, "utf8")).toBe("after");
    expect(result.revision).not.toBe(opened.revision);
  });

  it("preserves an external edit and reports a conflict", async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, "diagram.mmd");
    await writeFile(filePath, "flowchart LR", "utf8");
    const opened = await readDocumentFile(filePath);
    await writeFile(filePath, "flowchart TD", "utf8");

    const result = await writeDocumentFile(filePath, "flowchart RL", { expectedRevision: opened.revision });

    expect(result.status).toBe("conflict");
    expect(await readFile(filePath, "utf8")).toBe("flowchart TD");
  });

  it("allows an explicit overwrite after conflict review", async () => {
    const directory = await temporaryDirectory();
    const filePath = path.join(directory, "board.canvas.json");
    await writeFile(filePath, "external", "utf8");

    const result = await writeDocumentFile(filePath, "local", { expectedRevision: "stale", overwrite: true });

    expect(result.status).toBe("saved");
    expect(await readFile(filePath, "utf8")).toBe("local");
  });
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "mmm-documents-"));
  temporaryDirectories.push(directory);
  return directory;
}
