import {
  DEFAULT_CANVAS_TABLE_COLUMN_WIDTH,
  MAX_CANVAS_TABLE_CELL_LENGTH,
  MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH,
  MAX_CANVAS_TABLE_COLUMN_WIDTH,
  MAX_CANVAS_TABLE_COLUMNS,
  MAX_CANVAS_TABLE_ROWS,
  MAX_CANVAS_TABLE_TEXT_LENGTH,
  cloneCanvasTableContent,
  normalizeCanvasTableContent
} from "@/features/mermaid-editor/lib/canvas-table-content";
import type {
  CanvasTableAlign,
  CanvasTableColumn,
  CanvasTableContent,
  CanvasTableRow
} from "@/features/mermaid-editor/lib/editor-types";
import type { SpecialNodeTableTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";

export type TableCellSelection = {
  nodeId: string;
  rowId: string;
  columnId: string;
};

export type TableHeaderSelection = { nodeId: string; columnId: string };

export type TableCellGeometry = {
  rowId: string;
  columnId: string;
  rowIndex: number;
  columnIndex: number;
  text: string;
  align: CanvasTableAlign;
  frame: { x: number; y: number; width: number; height: number };
  textBox: { x: number; y: number; width: number; height: number };
};

export type TableHeaderCellGeometry = Omit<TableCellGeometry, "rowId" | "rowIndex"> & {
  rowId: null;
  rowIndex: -1;
};

export type TableNodeLayout = {
  width: number;
  height: number;
  headerHeight: number;
  rowHeights: number[];
  columnWidths: number[];
  columnBoundaries: number[];
  headerCells: TableHeaderCellGeometry[];
  cells: TableCellGeometry[];
};

export type TableNodeLayoutSpec = {
  tokens: SpecialNodeTableTokens;
  typography: TypographyRoleTokens;
  measureText: (value: string) => number;
};

export type TableCellNavigation = "down" | "next" | "previous";

export const DEFAULT_TABLE_NODE_TOKENS: SpecialNodeTableTokens = {
  surface: {
    background: "#ffffff",
    border: { color: "#d4d4d4", width: 1, style: "solid", customDash: [] },
    radius: 0,
    shadow: { color: "#171717", blur: 0, opacity: 0, offsetX: 0, offsetY: 0 }
  },
  state: {
    hoverBorderColor: "#737373",
    selectedBorderColor: "#171717",
    errorBorderColor: "#dc2626",
    editingBorderColor: "#171717",
    emphasizedBorderWidth: 1.5
  },
  headerBackground: "#f5f5f5",
  headerTextColor: "#171717",
  bodyTextColor: "#171717",
  hoverCellBackground: "#fafafa",
  selectedCellBackground: "#f5f5f5",
  selectedCellBorder: { color: "#171717", width: 1, style: "solid", customDash: [] },
  grid: { color: "#d4d4d4", width: 1, style: "solid", customDash: [] },
  cellPaddingX: 10,
  cellPaddingY: 8,
  placeholderGap: 4,
  minColumnWidth: 64,
  minRowHeight: 32,
  resizeHandleWidth: 8
};

export const DEFAULT_TABLE_NODE_TYPOGRAPHY: TypographyRoleTokens = {
  family: "'Noto Sans SC Variable', 'Noto Sans SC', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 18,
  letterSpacing: 0
};

export function buildTableNodeLayout(value: unknown, spec: TableNodeLayoutSpec): TableNodeLayout | undefined {
  const content = normalizeCanvasTableContent(value);
  if (!content) return undefined;

  const { tokens, typography } = spec;
  const columnWidths = content.columns.map((column) => Math.max(tokens.minColumnWidth, column.width));
  const columnBoundaries: number[] = [];
  let width = 0;
  for (const columnWidth of columnWidths) {
    width += columnWidth;
    columnBoundaries.push(width);
  }

  const lineHeight = Math.max(1, typography.lineHeight);
  const measuredHeight = (text: string, columnWidth: number) => {
    const availableWidth = Math.max(1, columnWidth - tokens.cellPaddingX * 2);
    return Math.max(tokens.minRowHeight, countWrappedLines(text, availableWidth, spec.measureText) * lineHeight + tokens.cellPaddingY * 2);
  };
  const headerHeight = Math.max(...content.columns.map((column, index) => measuredHeight(column.label, columnWidths[index])));
  const rowHeights = content.rows.map((row) => Math.max(
    tokens.minRowHeight,
    ...content.columns.map((column, index) => measuredHeight(row.cells[column.id] || "", columnWidths[index]))
  ));

  let x = 0;
  const headerCells = content.columns.map((column, columnIndex): TableHeaderCellGeometry => {
    const cell = buildCellGeometry({
      rowId: null,
      rowIndex: -1,
      column,
      columnIndex,
      text: column.label,
      x,
      y: 0,
      width: columnWidths[columnIndex],
      height: headerHeight,
      tokens
    });
    x += columnWidths[columnIndex];
    return cell;
  });

  const cells: TableCellGeometry[] = [];
  let y = headerHeight;
  content.rows.forEach((row, rowIndex) => {
    x = 0;
    content.columns.forEach((column, columnIndex) => {
      cells.push(buildCellGeometry({
        rowId: row.id,
        rowIndex,
        column,
        columnIndex,
        text: row.cells[column.id] || "",
        x,
        y,
        width: columnWidths[columnIndex],
        height: rowHeights[rowIndex],
        tokens
      }));
      x += columnWidths[columnIndex];
    });
    y += rowHeights[rowIndex];
  });

  return { width, height: y, headerHeight, rowHeights, columnWidths, columnBoundaries, headerCells, cells };
}

export function updateTableCell(content: CanvasTableContent, rowId: string, columnId: string, value: string) {
  const row = content.rows.find((candidate) => candidate.id === rowId);
  if (!row || !content.columns.some((column) => column.id === columnId) || row.cells[columnId] === value) return content;
  if (value.length > MAX_CANVAS_TABLE_CELL_LENGTH || tableTextLength(content) - (row.cells[columnId]?.length ?? 0) + value.length > MAX_CANVAS_TABLE_TEXT_LENGTH) return content;
  const next = cloneCanvasTableContent(content);
  next.rows.find((candidate) => candidate.id === rowId)!.cells[columnId] = value;
  return next;
}

export function updateTableHeader(content: CanvasTableContent, columnId: string, value: string) {
  const column = content.columns.find((candidate) => candidate.id === columnId);
  if (!column || column.label === value) return content;
  if (value.length > MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH || tableTextLength(content) - column.label.length + value.length > MAX_CANVAS_TABLE_TEXT_LENGTH) return content;
  const next = cloneCanvasTableContent(content);
  next.columns.find((candidate) => candidate.id === columnId)!.label = value;
  return next;
}

export function resizeTableColumn(content: CanvasTableContent, columnId: string, width: number, minimumWidth: number) {
  const current = content.columns.find((candidate) => candidate.id === columnId);
  if (!current || !Number.isFinite(width)) return content;
  const nextWidth = Math.min(MAX_CANVAS_TABLE_COLUMN_WIDTH, Math.max(minimumWidth, Math.round(width)));
  if (current.width === nextWidth) return content;
  const next = cloneCanvasTableContent(content);
  const column = next.columns.find((candidate) => candidate.id === columnId);
  if (column) column.width = nextWidth;
  return next;
}

export function setTableColumnAlign(content: CanvasTableContent, columnId: string, align: CanvasTableAlign) {
  const current = content.columns.find((candidate) => candidate.id === columnId);
  if (!current || current.align === align) return content;
  const next = cloneCanvasTableContent(content);
  const column = next.columns.find((candidate) => candidate.id === columnId);
  if (column) column.align = align;
  return next;
}

export function insertTableRow(content: CanvasTableContent, afterRowId?: string) {
  if (content.rows.length >= MAX_CANVAS_TABLE_ROWS) return content;
  const next = cloneCanvasTableContent(content);
  const row: CanvasTableRow = {
    id: nextUniqueId("row", next.rows.map((item) => item.id)),
    cells: Object.fromEntries(next.columns.map((column) => [column.id, ""]))
  };
  const index = afterRowId ? next.rows.findIndex((item) => item.id === afterRowId) + 1 : next.rows.length;
  next.rows.splice(index > 0 ? index : next.rows.length, 0, row);
  return next;
}

export function deleteTableRow(content: CanvasTableContent, rowId: string) {
  if (content.rows.length <= 1 || !content.rows.some((row) => row.id === rowId)) return content;
  const next = cloneCanvasTableContent(content);
  next.rows = next.rows.filter((row) => row.id !== rowId);
  return next;
}

export function insertTableColumn(content: CanvasTableContent, afterColumnId?: string) {
  if (content.columns.length >= MAX_CANVAS_TABLE_COLUMNS) return content;
  const next = cloneCanvasTableContent(content);
  const id = nextUniqueId("column", next.columns.map((column) => column.id));
  const sourceIndex = afterColumnId ? next.columns.findIndex((column) => column.id === afterColumnId) : next.columns.length - 1;
  const source = next.columns[Math.max(0, sourceIndex)];
  const column: CanvasTableColumn = {
    id,
    label: `列 ${next.columns.length + 1}`,
    width: source?.width ?? DEFAULT_CANVAS_TABLE_COLUMN_WIDTH,
    align: source?.align ?? "left"
  };
  const index = sourceIndex >= 0 ? sourceIndex + 1 : next.columns.length;
  next.columns.splice(index, 0, column);
  next.rows.forEach((row) => { row.cells[id] = ""; });
  return next;
}

export function deleteTableColumn(content: CanvasTableContent, columnId: string) {
  if (content.columns.length <= 1 || !content.columns.some((column) => column.id === columnId)) return content;
  const next = cloneCanvasTableContent(content);
  next.columns = next.columns.filter((column) => column.id !== columnId);
  next.rows.forEach((row) => { delete row.cells[columnId]; });
  return next;
}

export function navigateTableCell(content: CanvasTableContent, rowId: string, columnId: string, direction: TableCellNavigation) {
  const rowIndex = content.rows.findIndex((row) => row.id === rowId);
  const columnIndex = content.columns.findIndex((column) => column.id === columnId);
  if (rowIndex < 0 || columnIndex < 0 || !content.rows.length) return undefined;

  let nextRow = rowIndex;
  let nextColumn = columnIndex;
  if (direction === "down") nextRow = Math.min(content.rows.length - 1, rowIndex + 1);
  if (direction === "next") {
    if (rowIndex === content.rows.length - 1 && columnIndex === content.columns.length - 1) return { rowId, columnId };
    nextColumn += 1;
    if (nextColumn >= content.columns.length) {
      nextColumn = 0;
      nextRow = Math.min(content.rows.length - 1, rowIndex + 1);
    }
  }
  if (direction === "previous") {
    if (rowIndex === 0 && columnIndex === 0) return { rowId, columnId };
    nextColumn -= 1;
    if (nextColumn < 0) {
      nextColumn = content.columns.length - 1;
      nextRow = Math.max(0, rowIndex - 1);
    }
  }
  return { rowId: content.rows[nextRow].id, columnId: content.columns[nextColumn].id };
}

export function applyTableTsv(content: CanvasTableContent, rowId: string, columnId: string, text: string) {
  const startRow = content.rows.findIndex((row) => row.id === rowId);
  const startColumn = content.columns.findIndex((column) => column.id === columnId);
  if (startRow < 0 || startColumn < 0 || text.length > MAX_CANVAS_TABLE_TEXT_LENGTH) return content;
  const matrix = parseTsv(text);
  const requiredRows = startRow + matrix.length;
  const requiredColumns = startColumn + Math.max(1, ...matrix.map((row) => row.length));
  if (requiredRows > MAX_CANVAS_TABLE_ROWS || requiredColumns > MAX_CANVAS_TABLE_COLUMNS || matrix.some((row) => row.some((cell) => cell.length > MAX_CANVAS_TABLE_CELL_LENGTH))) {
    return content;
  }
  const changesExistingCell = matrix.some((values, rowOffset) => values.some((value, columnOffset) => {
    const row = content.rows[startRow + rowOffset];
    const column = content.columns[startColumn + columnOffset];
    return !row || !column || row.cells[column.id] !== value;
  }));
  if (!changesExistingCell && requiredRows <= content.rows.length && requiredColumns <= content.columns.length) return content;
  let next = cloneCanvasTableContent(content);
  while (next.rows.length < requiredRows) next = insertTableRow(next);
  while (next.columns.length < requiredColumns) next = insertTableColumn(next);
  matrix.forEach((values, rowOffset) => values.forEach((value, columnOffset) => {
    const row = next.rows[startRow + rowOffset];
    const column = next.columns[startColumn + columnOffset];
    if (row && column) row.cells[column.id] = value;
  }));
  return normalizeCanvasTableContent(next) ?? content;
}

function buildCellGeometry<T extends string | null, R extends number>(input: {
  rowId: T;
  rowIndex: R;
  column: CanvasTableColumn;
  columnIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tokens: SpecialNodeTableTokens;
}) {
  return {
    rowId: input.rowId,
    rowIndex: input.rowIndex,
    columnId: input.column.id,
    columnIndex: input.columnIndex,
    text: input.text,
    align: input.column.align,
    frame: { x: input.x, y: input.y, width: input.width, height: input.height },
    textBox: {
      x: input.x + input.tokens.cellPaddingX,
      y: input.y + input.tokens.cellPaddingY,
      width: Math.max(1, input.width - input.tokens.cellPaddingX * 2),
      height: Math.max(1, input.height - input.tokens.cellPaddingY * 2)
    }
  };
}

function parseTsv(text: string) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const rows = normalized.split("\n");
  if (rows.length > 1 && rows.at(-1) === "") rows.pop();
  return (rows.length ? rows : [""]).map((row) => row.split("\t"));
}

function nextUniqueId(prefix: string, values: string[]) {
  const used = new Set(values);
  let index = values.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function tableTextLength(content: CanvasTableContent) {
  return content.columns.reduce((total, column) => total + column.label.length, 0)
    + content.rows.reduce((total, row) => total + content.columns.reduce((rowTotal, column) => rowTotal + (row.cells[column.id]?.length ?? 0), 0), 0);
}

function countWrappedLines(value: string, maxWidth: number, measureText: (value: string) => number) {
  return (value || " ").split(/\r?\n/).reduce((total, paragraph) => {
    if (!paragraph) return total + 1;
    let lines = 1;
    let width = 0;
    for (const character of Array.from(paragraph)) {
      const characterWidth = measureText(character);
      if (width > 0 && width + characterWidth > maxWidth) {
        lines += 1;
        width = characterWidth;
      } else {
        width += characterWidth;
      }
    }
    return total + lines;
  }, 0);
}
