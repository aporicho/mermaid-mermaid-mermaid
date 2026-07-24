import type {
  CanvasNodeContent,
  CanvasTableAlign,
  CanvasTableColumn,
  CanvasTableContent,
  CanvasTablePresentation,
  CanvasTableRow
} from "@/features/mermaid-editor/lib/editor-types";

export const DEFAULT_CANVAS_TABLE_COLUMN_WIDTH = 160;
export const MIN_CANVAS_TABLE_COLUMN_WIDTH = 48;
export const MAX_CANVAS_TABLE_COLUMN_WIDTH = 1200;
export const MAX_CANVAS_TABLE_COLUMNS = 20;
export const MAX_CANVAS_TABLE_ROWS = 100;
export const MAX_CANVAS_TABLE_ID_LENGTH = 128;
export const MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH = 1024;
export const MAX_CANVAS_TABLE_CELL_LENGTH = 8192;
export const MAX_CANVAS_TABLE_TEXT_LENGTH = 262_144;

const DEFAULT_COLUMN_COUNT = 3;
const DEFAULT_ROW_COUNT = 3;

export function createDefaultCanvasTableContent(columnCount = DEFAULT_COLUMN_COUNT, rowCount = DEFAULT_ROW_COUNT): CanvasTableContent {
  const safeColumnCount = normalizeCount(columnCount, DEFAULT_COLUMN_COUNT, 1, MAX_CANVAS_TABLE_COLUMNS);
  const safeRowCount = normalizeCount(rowCount, DEFAULT_ROW_COUNT, 1, MAX_CANVAS_TABLE_ROWS);
  const columns = Array.from({ length: safeColumnCount }, (_, index): CanvasTableColumn => ({
    id: `column-${index + 1}`,
    label: `列 ${index + 1}`,
    width: DEFAULT_CANVAS_TABLE_COLUMN_WIDTH,
    align: "left"
  }));

  return {
    kind: "table",
    version: 1,
    columns,
    rows: Array.from({ length: safeRowCount }, (_, index) => createEmptyRow(`row-${index + 1}`, columns))
  };
}

export function normalizeCanvasNodeContent(value: unknown): CanvasNodeContent | undefined {
  if (!isRecord(value) || value.kind !== "table") return undefined;
  return normalizeCanvasTableContent(value);
}

export function normalizeCanvasTableContent(value: unknown): CanvasTableContent | undefined {
  if (!isRecord(value) || value.kind !== "table" || value.version !== 1 || !Array.isArray(value.columns) || !value.columns.length) {
    return undefined;
  }
  const rowSources = Array.isArray(value.rows) ? value.rows : [];
  if (!rowSources.length || value.columns.length > MAX_CANVAS_TABLE_COLUMNS || rowSources.length > MAX_CANVAS_TABLE_ROWS) return undefined;

  const usedColumnIds = new Set<string>();
  let textLength = 0;
  const columnSources = value.columns.map((candidate, index) => {
    const source = isRecord(candidate) ? candidate : {};
    const sourceId = typeof source.id === "string" ? source.id : "";
    const label = typeof source.label === "string" ? source.label : "";
    if (sourceId.length > MAX_CANVAS_TABLE_ID_LENGTH || label.length > MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH) return undefined;
    textLength += label.length;
    const id = uniqueId(sourceId, `column-${index + 1}`, usedColumnIds);
    const column: CanvasTableColumn = {
      id,
      label,
      width: normalizeColumnWidth(source.width),
      align: normalizeTableAlign(source.align)
    };
    return { sourceId, column };
  });
  if (columnSources.some((source) => !source)) return undefined;
  const normalizedColumnSources = columnSources as { sourceId: string; column: CanvasTableColumn }[];
  const columns = normalizedColumnSources.map(({ column }) => column);
  const usedRowIds = new Set<string>();
  const rows = rowSources.map((candidate, index): CanvasTableRow | undefined => {
    const source = isRecord(candidate) ? candidate : {};
    const sourceCells = isRecord(source.cells) ? source.cells : {};
    const sourceRowId = typeof source.id === "string" ? source.id : "";
    if (sourceRowId.length > MAX_CANVAS_TABLE_ID_LENGTH) return undefined;
    const cells = Object.fromEntries(normalizedColumnSources.map(({ sourceId, column }) => {
      const cell = sourceCells[sourceId] ?? sourceCells[column.id];
      const text = typeof cell === "string" ? cell : "";
      if (text.length > MAX_CANVAS_TABLE_CELL_LENGTH) return [column.id, undefined];
      textLength += text.length;
      return [column.id, text];
    }));
    if (Object.values(cells).some((cell) => cell === undefined)) return undefined;
    return {
      id: uniqueId(sourceRowId, `row-${index + 1}`, usedRowIds),
      cells: cells as Record<string, string>
    };
  });
  if (rows.some((row) => !row) || textLength > MAX_CANVAS_TABLE_TEXT_LENGTH) return undefined;

  return { kind: "table", version: 1, columns, rows: rows as CanvasTableRow[] };
}

export function cloneCanvasNodeContent(content: CanvasNodeContent | null | undefined): CanvasNodeContent | undefined {
  return content ? cloneCanvasTableContent(content) : undefined;
}

export function cloneCanvasTableContent(content: CanvasTableContent): CanvasTableContent {
  return {
    kind: "table",
    version: 1,
    columns: content.columns.map((column) => ({ ...column })),
    rows: content.rows.map((row) => ({ ...row, cells: { ...row.cells } }))
  };
}

export function sameCanvasNodeContent(left: CanvasNodeContent | null | undefined, right: CanvasNodeContent | null | undefined) {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind || left.version !== right.version) return false;
  if (left.columns.length !== right.columns.length || left.rows.length !== right.rows.length) return false;

  for (let index = 0; index < left.columns.length; index += 1) {
    const leftColumn = left.columns[index];
    const rightColumn = right.columns[index];
    if (!rightColumn || leftColumn.id !== rightColumn.id || leftColumn.label !== rightColumn.label || leftColumn.width !== rightColumn.width || leftColumn.align !== rightColumn.align) {
      return false;
    }
  }

  for (let rowIndex = 0; rowIndex < left.rows.length; rowIndex += 1) {
    const leftRow = left.rows[rowIndex];
    const rightRow = right.rows[rowIndex];
    if (!rightRow || leftRow.id !== rightRow.id) return false;
    for (const column of left.columns) {
      if (leftRow.cells[column.id] !== rightRow.cells[column.id]) return false;
    }
  }
  return true;
}

export function canvasTablePresentation(content: CanvasTableContent): CanvasTablePresentation {
  return { columns: content.columns.map((column) => ({ width: column.width, align: column.align })) };
}

export function applyCanvasTablePresentation(content: CanvasTableContent, value: CanvasTablePresentation | null | undefined) {
  if (!value?.columns?.length) return content;
  const next = cloneCanvasTableContent(content);
  next.columns.forEach((column, index) => {
    const presentation = value.columns[index];
    if (!presentation) return;
    column.width = normalizeColumnWidth(presentation.width);
    column.align = normalizeTableAlign(presentation.align);
  });
  return next;
}

function createEmptyRow(id: string, columns: CanvasTableColumn[]): CanvasTableRow {
  return { id, cells: Object.fromEntries(columns.map((column) => [column.id, ""])) };
}

function normalizeTableAlign(value: unknown): CanvasTableAlign {
  return value === "center" || value === "right" ? value : "left";
}

function normalizeColumnWidth(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CANVAS_TABLE_COLUMN_WIDTH;
  return Math.min(MAX_CANVAS_TABLE_COLUMN_WIDTH, Math.max(MIN_CANVAS_TABLE_COLUMN_WIDTH, Math.round(parsed)));
}

function normalizeCount(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function uniqueId(value: string, fallback: string, used: Set<string>) {
  const base = (toWellFormedText(value.trim()) || fallback).slice(0, MAX_CANVAS_TABLE_ID_LENGTH);
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    const suffixText = `-${suffix++}`;
    id = `${base.slice(0, MAX_CANVAS_TABLE_ID_LENGTH - suffixText.length)}${suffixText}`;
  }
  used.add(id);
  return id;
}

function toWellFormedText(value: string) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += value[index] + value[index + 1];
        index += 1;
      } else {
        result += "\ufffd";
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      result += "\ufffd";
    } else {
      result += value[index];
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
