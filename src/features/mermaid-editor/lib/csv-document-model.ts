export type CsvDelimiter = "," | ";" | "\t" | "|";
export type CsvHeaderMode = "auto" | "header" | "none";

export type CsvDialect = {
  delimiter: CsvDelimiter;
  lineEnding: "lf" | "crlf";
  trailingNewline: boolean;
};

export type CsvParseError = {
  message: string;
  line: number;
  column: number;
};

export type CsvDocument = {
  rows: string[][];
  dialect: CsvDialect;
  detectedHeader: boolean;
  error: CsvParseError | null;
};

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t", "|"];

export function parseCsvDocument(source: string, preferredDialect?: Partial<CsvDialect>): CsvDocument {
  const lineEnding = preferredDialect?.lineEnding || (source.includes("\r\n") ? "crlf" : "lf");
  const trailingNewline = preferredDialect?.trailingNewline ?? /(?:\r\n|\r|\n)$/.test(source);
  const delimiter = preferredDialect?.delimiter || detectCsvDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let column = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
          column += 2;
          continue;
        }
        quoted = false;
        column += 1;
        continue;
      }
      field += character;
      if (character === "\n") {
        line += 1;
        column = 1;
      } else column += 1;
      continue;
    }
    if (character === '"') {
      if (field.length) return invalidCsv(rows, delimiter, lineEnding, trailingNewline, "引号只能出现在字段开头。", line, column);
      quoted = true;
      column += 1;
      continue;
    }
    if (character === delimiter) {
      row.push(field);
      field = "";
      column += 1;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      line += 1;
      column = 1;
      continue;
    }
    field += character;
    column += 1;
  }

  if (quoted) return invalidCsv(rows, delimiter, lineEnding, trailingNewline, "字段引号没有闭合。", line, column);
  if (field.length || row.length || source.length === 0) {
    row.push(field);
    rows.push(row);
  }
  const normalized = normalizeCsvRows(rows);
  return { rows: normalized, dialect: { delimiter, lineEnding, trailingNewline }, detectedHeader: detectCsvHeader(normalized), error: null };
}

export function serializeCsvDocument(rows: readonly (readonly string[])[], dialect: CsvDialect) {
  const newline = dialect.lineEnding === "crlf" ? "\r\n" : "\n";
  const body = rows.map((row) => row.map((value) => serializeCsvField(String(value ?? ""), dialect.delimiter)).join(dialect.delimiter)).join(newline);
  return dialect.trailingNewline ? `${body}${newline}` : body;
}

export function csvHasHeader(document: Pick<CsvDocument, "detectedHeader">, mode: CsvHeaderMode) {
  return mode === "header" || (mode === "auto" && document.detectedHeader);
}

export function csvColumnLabel(index: number) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function normalizeCsvRows(rows: readonly (readonly string[])[]) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => String(row[index] ?? "")));
}

export function parseClipboardGrid(text: string) {
  return parseCsvDocument(text, { delimiter: text.includes("\t") ? "\t" : "," }).rows;
}

function detectCsvDelimiter(source: string): CsvDelimiter {
  const scores = new Map<CsvDelimiter, { records: number; fields: number; variance: number }>();
  for (const delimiter of DELIMITERS) {
    const counts: number[] = [];
    let quoted = false;
    let count = 1;
    for (let index = 0; index < source.length && counts.length < 40; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && character === delimiter) count += 1;
      else if (!quoted && (character === "\n" || character === "\r")) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        counts.push(count);
        count = 1;
      }
    }
    if (count > 1 || !counts.length) counts.push(count);
    const records = counts.filter((item) => item > 1).length;
    const fields = counts.reduce((sum, item) => sum + item, 0);
    const average = fields / Math.max(1, counts.length);
    const variance = counts.reduce((sum, item) => sum + Math.abs(item - average), 0);
    scores.set(delimiter, { records, fields, variance });
  }
  return [...scores].sort((left, right) => right[1].records - left[1].records || right[1].fields - left[1].fields || left[1].variance - right[1].variance)[0]?.[0] || ",";
}

function detectCsvHeader(rows: readonly (readonly string[])[]) {
  if (rows.length < 2 || rows[0].length < 1) return false;
  const first = rows[0];
  const sample = rows.slice(1, 20);
  let evidence = 0;
  for (let column = 0; column < first.length; column += 1) {
    const firstValue = first[column]?.trim() || "";
    const rest = sample.map((row) => row[column]?.trim() || "").filter(Boolean);
    if (!firstValue || !rest.length) continue;
    const firstNumeric = isCsvNumber(firstValue);
    const numericRest = rest.filter(isCsvNumber).length;
    if (!firstNumeric && numericRest >= Math.ceil(rest.length * 0.7)) evidence += 2;
    if (!firstNumeric && rest.every((value) => value !== firstValue)) evidence += 1;
  }
  return evidence >= Math.max(1, Math.ceil(first.length / 2));
}

function isCsvNumber(value: string) {
  return value !== "" && Number.isFinite(Number(value.replaceAll(",", "")));
}

function serializeCsvField(value: string, delimiter: CsvDelimiter) {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function invalidCsv(rows: string[][], delimiter: CsvDelimiter, lineEnding: "lf" | "crlf", trailingNewline: boolean, message: string, line: number, column: number): CsvDocument {
  return { rows: normalizeCsvRows(rows.length ? rows : [[""]]), dialect: { delimiter, lineEnding, trailingNewline }, detectedHeader: false, error: { message, line, column } };
}
