import { describe, expect, it } from "vitest";

import {
  CanvasTableCsvError,
  parseCanvasTableCsv,
  serializeCanvasTableCsv
} from "@/features/mermaid-editor/lib/canvas-table-csv";
import { createDefaultCanvasTableContent, MAX_CANVAS_TABLE_COLUMNS, MAX_CANVAS_TABLE_ROWS } from "@/features/mermaid-editor/lib/canvas-table-content";

describe("canvas table CSV", () => {
  it("parses BOM, CRLF, commas, escaped quotes, embedded newlines and empty cells", () => {
    const content = parseCanvasTableCsv('\ufeffName,Note,Empty\r\nAlice,"hello, ""world""",\r\nBob,"line 1\r\nline 2",');

    expect(content.columns.map((column) => column.label)).toEqual(["Name", "Note", "Empty"]);
    expect(content.rows).toEqual([
      { id: "row-1", cells: { "column-1": "Alice", "column-2": 'hello, "world"', "column-3": "" } },
      { id: "row-2", cells: { "column-1": "Bob", "column-2": "line 1\r\nline 2", "column-3": "" } }
    ]);
  });

  it("serializes RFC4180 records with CRLF and optional BOM", () => {
    const content = parseCanvasTableCsv('Name,Note,Empty\nAlice,"hello, ""world""",\nBob,"line 1\nline 2",');

    expect(serializeCanvasTableCsv(content, { bom: true })).toBe('\ufeffName,Note,Empty\r\nAlice,"hello, ""world""",\r\nBob,"line 1\nline 2",');
  });

  it("keeps deterministic IDs and reuses prior IDs and column presentation by position", () => {
    const previous = createDefaultCanvasTableContent(2, 2);
    previous.columns[0] = { ...previous.columns[0], id: "stable-name", width: 260, align: "center" };
    previous.rows[0] = { ...previous.rows[0], id: "stable-row" };
    const next = parseCanvasTableCsv("Renamed,Value\r\nAlice,1\r\nBob,2", { previousContent: previous });

    expect(next.columns[0]).toMatchObject({ id: "stable-name", label: "Renamed", width: 260, align: "center" });
    expect(next.rows.map((row) => row.id)).toEqual(["stable-row", "row-2"]);
    expect(parseCanvasTableCsv(serializeCanvasTableCsv(next))).toMatchObject({
      columns: [{ id: "column-1" }, { id: "column-2" }],
      rows: [{ id: "row-1" }, { id: "row-2" }]
    });
  });

  it("keeps a header-only CSV editable with one empty row", () => {
    const content = parseCanvasTableCsv("A,B\r\n");

    expect(content.rows).toEqual([{ id: "row-1", cells: { "column-1": "", "column-2": "" } }]);
  });

  it("rejects malformed quotes and uneven records instead of losing data", () => {
    expect(() => parseCanvasTableCsv('A,B\r\n"open,B')).toThrowError(CanvasTableCsvError);
    expect(() => parseCanvasTableCsv('A,B\r\n"A"tail,B')).toThrowError(expect.objectContaining({ code: "invalid_quote" }));
    expect(() => parseCanvasTableCsv("A,B\r\nonly-one")).toThrowError(expect.objectContaining({ code: "uneven_row" }));
  });

  it("enforces the existing table row and column limits", () => {
    const tooWide = Array.from({ length: MAX_CANVAS_TABLE_COLUMNS + 1 }, (_, index) => `C${index}`).join(",");
    const tooTall = ["A", ...Array.from({ length: MAX_CANVAS_TABLE_ROWS + 1 }, (_, index) => String(index))].join("\r\n");

    expect(() => parseCanvasTableCsv(tooWide)).toThrowError(expect.objectContaining({ code: "too_many_columns" }));
    expect(() => parseCanvasTableCsv(tooTall)).toThrowError(expect.objectContaining({ code: "too_many_rows" }));
  });

});
