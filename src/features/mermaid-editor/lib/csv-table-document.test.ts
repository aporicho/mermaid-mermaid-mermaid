import { describe, expect, it } from "vitest";

import {
  CSV_TABLE_DEFAULT_FILE_NAME,
  csvTableDocumentActionForProjectFile,
  csvTableDocumentLabel,
  csvTableDocumentNodeForProjectFile,
  csvTableDocumentProjectFileForRuntimeFile,
  csvTableProjectFiles,
  initialCsvTableDocumentSource,
  isCsvTableDocumentNode,
  normalizeNewCsvTableFileName,
  resolveCsvTableDocumentFile
} from "@/features/mermaid-editor/lib/csv-table-document";
import { parseCanvasTableCsv } from "@/features/mermaid-editor/lib/canvas-table-csv";

describe("CSV table document helpers", () => {
  it("recognizes CSV file nodes and derives labels without changing file actions", () => {
    expect(isCsvTableDocumentNode({ action: { kind: "file", path: "data/people.CSV", openMode: "app-window" } })).toBe(true);
    expect(isCsvTableDocumentNode({ action: { kind: "file", path: "notes.md", openMode: "app-window" } })).toBe(false);
    expect(csvTableDocumentLabel({ name: "people.csv" })).toBe("people");
  });

  it("finds CSV entries from resources without adding them to main document files", () => {
    const files = csvTableProjectFiles({
      rootName: "demo",
      rootPath: "/demo",
      scannedAt: 1,
      files: [{ name: "diagram.mmd", path: "/demo/diagram.mmd", relativePath: "diagram.mmd" }],
      resources: [
        { kind: "file", name: "z.CSV", path: "/demo/data/z.CSV", relativePath: "data/z.CSV", modifiedAt: 4 },
        { kind: "directory", name: "empty.csv", path: "/demo/empty.csv", relativePath: "empty.csv" },
        { kind: "file", name: "a.csv", path: "/demo/a.csv", relativePath: "a.csv" },
        { kind: "file", name: "notes.txt", path: "/demo/notes.txt", relativePath: "notes.txt" }
      ]
    });

    expect(files).toEqual([
      { name: "a.csv", path: "/demo/a.csv", relativePath: "a.csv" },
      { name: "z.CSV", path: "/demo/data/z.CSV", relativePath: "data/z.CSV", modifiedAt: 4 }
    ]);
  });

  it("resolves relative references and creates project-relative file actions", () => {
    const file = { name: "People.csv", path: "/repo/data/People.csv", relativePath: "data/People.csv" };
    const workspace = {
      rootName: "repo",
      rootPath: "/repo",
      scannedAt: 1,
      files: [],
      resources: [{ kind: "file" as const, ...file }]
    };
    const node = { id: "A", label: "People", x: 0, y: 0, fill: "#fff", action: csvTableDocumentActionForProjectFile(file) };

    expect(csvTableDocumentActionForProjectFile(file)).toMatchObject({ path: "data/People.csv", tooltip: "编辑 CSV 表格" });
    expect(csvTableDocumentNodeForProjectFile([node], file)?.id).toBe("A");
    expect(csvTableDocumentProjectFileForRuntimeFile({ name: file.name, path: file.path }, workspace)).toEqual(file);
    expect(resolveCsvTableDocumentFile("data/People.csv", "/repo/diagram.mmd", workspace)).toEqual(file);
    expect(resolveCsvTableDocumentFile("data/People.csv", "/repo/diagrams/diagram.mmd", { ...workspace, resources: [] })).toMatchObject({ path: "/repo/data/People.csv" });
    expect(resolveCsvTableDocumentFile("external.csv", "/tmp/diagram.mmd", undefined)).toMatchObject({ path: "/tmp/external.csv" });
  });

  it("normalizes safe root-level names and provides a parseable default source", () => {
    expect(CSV_TABLE_DEFAULT_FILE_NAME).toBe("table.csv");
    expect(normalizeNewCsvTableFileName("people")).toBe("people.csv");
    expect(normalizeNewCsvTableFileName("people.CSV")).toBe("people.CSV");
    expect(normalizeNewCsvTableFileName("data/people.csv")).toBe("");
    expect(normalizeNewCsvTableFileName("people.txt")).toBe("");
    expect(parseCanvasTableCsv(initialCsvTableDocumentSource()).columns).toHaveLength(3);
  });
});
