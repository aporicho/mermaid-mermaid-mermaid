import { describe, expect, it } from "vitest";

import {
  cloneCanvasTableContent,
  createDefaultCanvasTableContent,
  MAX_CANVAS_TABLE_CELL_LENGTH,
  MAX_CANVAS_TABLE_COLUMNS,
  MAX_CANVAS_TABLE_ID_LENGTH,
  MAX_CANVAS_TABLE_ROWS,
  normalizeCanvasTableContent
} from "@/features/mermaid-editor/lib/canvas-table-content";

describe("canvas table content", () => {
  it("creates deterministic table defaults", () => {
    expect(createDefaultCanvasTableContent(2, 1)).toEqual({
      kind: "table",
      version: 1,
      columns: [
        { id: "column-1", label: "列 1", width: 160, align: "left" },
        { id: "column-2", label: "列 2", width: 160, align: "left" }
      ],
      rows: [{ id: "row-1", cells: { "column-1": "", "column-2": "" } }]
    });
  });

  it("normalizes identifiers, widths, alignments and row cells", () => {
    expect(normalizeCanvasTableContent({
      kind: "table",
      version: 1,
      columns: [
        { id: " name ", label: "Name", width: 20, align: "center" },
        { id: "name", label: "Value", width: Number.NaN, align: "unexpected" }
      ],
      rows: [{ id: "", cells: { " name ": "Alice", name: "Engineer", ignored: "drop" } }]
    })).toEqual({
      kind: "table",
      version: 1,
      columns: [
        { id: "name", label: "Name", width: 48, align: "center" },
        { id: "name-2", label: "Value", width: 160, align: "left" }
      ],
      rows: [{ id: "row-1", cells: { name: "Alice", "name-2": "Engineer" } }]
    });
  });

  it("clones nested rows and cells", () => {
    const source = createDefaultCanvasTableContent(1, 1);
    const clone = cloneCanvasTableContent(source);
    clone.rows[0].cells["column-1"] = "changed";
    clone.columns[0].label = "Changed";

    expect(source.rows[0].cells["column-1"]).toBe("");
    expect(source.columns[0].label).toBe("列 1");
  });

  it("rejects damaged and unknown content versions", () => {
    expect(normalizeCanvasTableContent({ kind: "table", version: 2, columns: [], rows: [] })).toBeUndefined();
    expect(normalizeCanvasTableContent({ kind: "table", version: 1, rows: [] })).toBeUndefined();
    expect(normalizeCanvasTableContent({ kind: "table", version: 1, columns: [{ id: "a", label: "A", width: 160, align: "left" }], rows: [] })).toBeUndefined();
    expect(createDefaultCanvasTableContent(1, 0).rows).toHaveLength(1);
  });

  it("accepts the table size boundary and rejects oversized content without truncating", () => {
    const boundary = createDefaultCanvasTableContent(MAX_CANVAS_TABLE_COLUMNS, MAX_CANVAS_TABLE_ROWS);
    expect(normalizeCanvasTableContent(boundary)).toEqual(boundary);
    expect(normalizeCanvasTableContent({
      ...boundary,
      columns: [...boundary.columns, { id: "overflow", label: "Overflow", width: 160, align: "left" }]
    })).toBeUndefined();
    expect(normalizeCanvasTableContent({
      ...boundary,
      rows: [...boundary.rows, { id: "overflow", cells: {} }]
    })).toBeUndefined();
  });

  it("rejects a cell beyond the text limit", () => {
    const content = createDefaultCanvasTableContent(1, 1);
    content.rows[0].cells["column-1"] = "x".repeat(MAX_CANVAS_TABLE_CELL_LENGTH + 1);

    expect(normalizeCanvasTableContent(content)).toBeUndefined();
  });

  it("keeps de-duplicated identifiers within their length limit", () => {
    const id = "x".repeat(MAX_CANVAS_TABLE_ID_LENGTH);
    const normalized = normalizeCanvasTableContent({
      kind: "table",
      version: 1,
      columns: [
        { id, label: "A", width: 160, align: "left" },
        { id, label: "B", width: 160, align: "left" }
      ],
      rows: [
        { id, cells: { [id]: "value" } },
        { id, cells: { [id]: "value" } }
      ]
    });

    expect(normalized?.columns.map((column) => column.id.length)).toEqual([MAX_CANVAS_TABLE_ID_LENGTH, MAX_CANVAS_TABLE_ID_LENGTH]);
    expect(normalized?.rows.map((row) => row.id.length)).toEqual([MAX_CANVAS_TABLE_ID_LENGTH, MAX_CANVAS_TABLE_ID_LENGTH]);
    expect(normalized?.columns[1].id.endsWith("-2")).toBe(true);
    expect(normalized?.rows[1].id.endsWith("-2")).toBe(true);
  });
});
