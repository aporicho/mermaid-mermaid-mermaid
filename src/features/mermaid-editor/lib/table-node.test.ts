import { describe, expect, it } from "vitest";

import { createDefaultCanvasTableContent } from "@/features/mermaid-editor/lib/canvas-table-content";
import {
  applyTableTsv,
  buildTableNodeLayout,
  DEFAULT_TABLE_NODE_TOKENS,
  DEFAULT_TABLE_NODE_TYPOGRAPHY,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  navigateTableCell,
  resizeTableColumn,
  setTableColumnAlign,
  updateTableCell,
  updateTableHeader
} from "@/features/mermaid-editor/lib/table-node";

const spec = {
  tokens: DEFAULT_TABLE_NODE_TOKENS,
  typography: DEFAULT_TABLE_NODE_TYPOGRAPHY,
  measureText: (value: string) => value.length * 10
};

describe("table node", () => {
  it("uses the sum of column widths and grows rows for wrapped text", () => {
    const content = createDefaultCanvasTableContent(2, 1);
    content.columns[0].width = 80;
    content.columns[1].width = 120;
    content.rows[0].cells[content.columns[0].id] = "12345678901234567890";
    const layout = buildTableNodeLayout(content, spec)!;

    expect(layout.width).toBe(200);
    expect(layout.rowHeights[0]).toBeGreaterThan(DEFAULT_TABLE_NODE_TOKENS.minRowHeight);
    expect(layout.height).toBe(layout.headerHeight + layout.rowHeights[0]);
  });

  it("pastes TSV and automatically extends rows and columns", () => {
    const content = createDefaultCanvasTableContent(1, 1);
    const next = applyTableTsv(content, content.rows[0].id, content.columns[0].id, "A\tB\nC\tD");

    expect(next.columns).toHaveLength(2);
    expect(next.rows).toHaveLength(2);
    expect(next.rows.map((row) => next.columns.map((column) => row.cells[column.id]))).toEqual([["A", "B"], ["C", "D"]]);
  });

  it("inserts, deletes and aligns selected rows and columns", () => {
    const content = createDefaultCanvasTableContent(2, 2);
    const withRow = insertTableRow(content, content.rows[0].id);
    const withColumn = insertTableColumn(withRow, withRow.columns[0].id);
    const aligned = setTableColumnAlign(withColumn, withColumn.columns[1].id, "right");
    const withoutRow = deleteTableRow(aligned, aligned.rows[0].id);
    const withoutColumn = deleteTableColumn(withoutRow, withoutRow.columns[0].id);

    expect(withRow.rows).toHaveLength(3);
    expect(withColumn.columns).toHaveLength(3);
    expect(aligned.columns[1].align).toBe("right");
    expect(withoutRow.rows).toHaveLength(2);
    expect(withoutColumn.columns).toHaveLength(2);
  });

  it("keeps boundary navigation in the boundary cell", () => {
    const content = createDefaultCanvasTableContent(2, 2);
    expect(navigateTableCell(content, content.rows[0].id, content.columns[0].id, "previous")).toEqual({ rowId: content.rows[0].id, columnId: content.columns[0].id });
    expect(navigateTableCell(content, content.rows[1].id, content.columns[1].id, "next")).toEqual({ rowId: content.rows[1].id, columnId: content.columns[1].id });
  });

  it("rejects an oversized TSV paste atomically", () => {
    const content = createDefaultCanvasTableContent(1, 1);
    const oversized = Array.from({ length: 21 }, (_, index) => String(index)).join("\t");
    expect(applyTableTsv(content, content.rows[0].id, content.columns[0].id, oversized)).toBe(content);
  });

  it("preserves object identity for no-op mutations", () => {
    const content = createDefaultCanvasTableContent(1, 1);
    const rowId = content.rows[0].id;
    const columnId = content.columns[0].id;

    expect(updateTableCell(content, rowId, columnId, "")).toBe(content);
    expect(updateTableHeader(content, columnId, content.columns[0].label)).toBe(content);
    expect(resizeTableColumn(content, columnId, content.columns[0].width, 64)).toBe(content);
    expect(setTableColumnAlign(content, columnId, "left")).toBe(content);
    expect(deleteTableRow(content, rowId)).toBe(content);
    expect(deleteTableColumn(content, columnId)).toBe(content);
    content.rows[0].cells[columnId] = "same";
    expect(applyTableTsv(content, rowId, columnId, "same")).toBe(content);
  });
});
