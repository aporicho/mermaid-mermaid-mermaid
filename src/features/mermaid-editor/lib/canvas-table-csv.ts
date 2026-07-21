import {
  DEFAULT_CANVAS_TABLE_COLUMN_WIDTH,
  MAX_CANVAS_TABLE_CELL_LENGTH,
  MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH,
  MAX_CANVAS_TABLE_COLUMNS,
  MAX_CANVAS_TABLE_ID_LENGTH,
  MAX_CANVAS_TABLE_ROWS,
  MAX_CANVAS_TABLE_TEXT_LENGTH,
  normalizeCanvasTableContent
} from "@/features/mermaid-editor/lib/canvas-table-content";
import type { CanvasTableContent } from "@/features/mermaid-editor/lib/editor-types";

export type CanvasTableCsvErrorCode =
  | "empty"
  | "invalid_quote"
  | "unterminated_quote"
  | "too_many_columns"
  | "too_many_rows"
  | "field_too_long"
  | "text_too_long"
  | "uneven_row"
  | "invalid_content";

export class CanvasTableCsvError extends Error {
  readonly code: CanvasTableCsvErrorCode;
  readonly record?: number;
  readonly field?: number;

  constructor(code: CanvasTableCsvErrorCode, message: string, position: { record?: number; field?: number } = {}) {
    super(message);
    this.name = "CanvasTableCsvError";
    this.code = code;
    this.record = position.record;
    this.field = position.field;
  }
}

export type ParseCanvasTableCsvOptions = {
  previousContent?: CanvasTableContent;
};

export type SerializeCanvasTableCsvOptions = {
  bom?: boolean;
  lineEnding?: "\n" | "\r\n";
};

export function parseCanvasTableCsv(source: string, options: ParseCanvasTableCsvOptions = {}): CanvasTableContent {
  const records = parseCsvRecords(source);
  const header = records[0];
  if (!header) throw new CanvasTableCsvError("empty", "CSV 至少需要一个表头字段。");
  if (header.length > MAX_CANVAS_TABLE_COLUMNS) {
    throw new CanvasTableCsvError("too_many_columns", `CSV 最多支持 ${MAX_CANVAS_TABLE_COLUMNS} 列。`, { record: 1 });
  }

  const previous = options.previousContent ? normalizeCanvasTableContent(options.previousContent) : undefined;
  const usedColumnIds = new Set<string>();
  const columns = header.map((label, index) => {
    if (label.length > MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH) {
      throw new CanvasTableCsvError("field_too_long", "CSV 表头字段过长。", { record: 1, field: index + 1 });
    }
    const previousColumn = previous?.columns[index];
    return {
      id: stableTableId(previousColumn?.id, `column-${index + 1}`, usedColumnIds),
      label,
      width: previousColumn?.width ?? DEFAULT_CANVAS_TABLE_COLUMN_WIDTH,
      align: previousColumn?.align ?? "left" as const
    };
  });

  const dataRecords = records.length > 1 ? records.slice(1) : [Array.from({ length: columns.length }, () => "")];
  if (dataRecords.length > MAX_CANVAS_TABLE_ROWS) {
    throw new CanvasTableCsvError("too_many_rows", `CSV 最多支持 ${MAX_CANVAS_TABLE_ROWS} 行数据。`);
  }

  let textLength = header.reduce((sum, value) => sum + value.length, 0);
  const usedRowIds = new Set<string>();
  const rows = dataRecords.map((record, rowIndex) => {
    if (record.length !== columns.length) {
      throw new CanvasTableCsvError("uneven_row", `CSV 第 ${rowIndex + 2} 行的字段数与表头不一致。`, { record: rowIndex + 2 });
    }
    const cells = Object.fromEntries(columns.map((column, columnIndex) => {
      const value = record[columnIndex] ?? "";
      if (value.length > MAX_CANVAS_TABLE_CELL_LENGTH) {
        throw new CanvasTableCsvError("field_too_long", "CSV 单元格内容过长。", { record: rowIndex + 2, field: columnIndex + 1 });
      }
      textLength += value.length;
      return [column.id, value];
    }));
    return {
      id: stableTableId(previous?.rows[rowIndex]?.id, `row-${rowIndex + 1}`, usedRowIds),
      cells
    };
  });
  if (textLength > MAX_CANVAS_TABLE_TEXT_LENGTH) {
    throw new CanvasTableCsvError("text_too_long", `CSV 文本总量不能超过 ${MAX_CANVAS_TABLE_TEXT_LENGTH} 个字符。`);
  }

  const content = normalizeCanvasTableContent({ kind: "table", version: 1, columns, rows });
  if (!content) throw new CanvasTableCsvError("invalid_content", "CSV 无法转换为画布表格。");
  return content;
}

export function serializeCanvasTableCsv(content: CanvasTableContent, options: SerializeCanvasTableCsvOptions = {}) {
  const normalized = normalizeCanvasTableContent(content);
  if (!normalized) throw new CanvasTableCsvError("invalid_content", "画布表格内容无效，无法写入 CSV。");
  const lineEnding = options.lineEnding ?? "\r\n";
  const records = [
    normalized.columns.map((column) => column.label),
    ...normalized.rows.map((row) => normalized.columns.map((column) => row.cells[column.id] ?? ""))
  ];
  const csv = records.map((record) => record.map(serializeCsvField).join(",")).join(lineEnding);
  return `${options.bom ? "\ufeff" : ""}${csv}`;
}

function parseCsvRecords(source: string) {
  if (source.length > MAX_CANVAS_TABLE_TEXT_LENGTH) {
    throw new CanvasTableCsvError("text_too_long", `CSV 文件不能超过 ${MAX_CANVAS_TABLE_TEXT_LENGTH} 个字符。`);
  }
  const input = source.startsWith("\ufeff") ? source.slice(1) : source;
  if (!input.length) throw new CanvasTableCsvError("empty", "CSV 文件为空。");

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let fieldStarted = false;
  let recordStarted = false;

  const pushField = () => {
    record.push(field);
    field = "";
    quoted = false;
    afterQuote = false;
    fieldStarted = false;
  };
  const pushRecord = () => {
    pushField();
    if (records.length === 0 && record.length > MAX_CANVAS_TABLE_COLUMNS) {
      throw new CanvasTableCsvError("too_many_columns", `CSV 最多支持 ${MAX_CANVAS_TABLE_COLUMNS} 列。`, { record: 1 });
    }
    if (records.length > 0 && records.length >= MAX_CANVAS_TABLE_ROWS + 1) {
      throw new CanvasTableCsvError("too_many_rows", `CSV 最多支持 ${MAX_CANVAS_TABLE_ROWS} 行数据。`);
    }
    records.push(record);
    record = [];
    recordStarted = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      recordStarted = true;
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        pushField();
        recordStarted = true;
        continue;
      }
      if (character === "\r" || character === "\n") {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        pushRecord();
        continue;
      }
      throw new CanvasTableCsvError("invalid_quote", "CSV 引号结束后只能跟逗号或换行。", {
        record: records.length + 1,
        field: record.length + 1
      });
    }

    if (character === '"') {
      if (fieldStarted || field.length) {
        throw new CanvasTableCsvError("invalid_quote", "CSV 未转义的引号只能出现在字段开头。", {
          record: records.length + 1,
          field: record.length + 1
        });
      }
      quoted = true;
      fieldStarted = true;
      recordStarted = true;
      continue;
    }
    if (character === ",") {
      pushField();
      recordStarted = true;
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      pushRecord();
      continue;
    }
    field += character;
    fieldStarted = true;
    recordStarted = true;
  }

  if (quoted) {
    throw new CanvasTableCsvError("unterminated_quote", "CSV 包含未闭合的引号。", {
      record: records.length + 1,
      field: record.length + 1
    });
  }
  if (recordStarted || record.length || fieldStarted || afterQuote) pushRecord();
  if (!records.length) throw new CanvasTableCsvError("empty", "CSV 文件为空。");
  return records;
}

function serializeCsvField(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function stableTableId(previousId: string | undefined, fallback: string, used: Set<string>) {
  const base = (previousId?.trim() || fallback).slice(0, MAX_CANVAS_TABLE_ID_LENGTH);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const suffixText = `-${suffix++}`;
    candidate = `${base.slice(0, MAX_CANVAS_TABLE_ID_LENGTH - suffixText.length)}${suffixText}`;
  }
  used.add(candidate);
  return candidate;
}
