import { describe, expect, it } from "vitest";

import {
  csvColumnLabel,
  csvHasHeader,
  parseClipboardGrid,
  parseCsvDocument,
  serializeCsvDocument
} from "@/features/mermaid-editor/lib/csv-document-model";

describe("CSV document model", () => {
  it("detects delimiters, CRLF, quoted newlines and a likely header", () => {
    const source = 'name;count;note\r\nalpha;12;"line 1\r\nline 2"\r\nbeta;24;"a; b"';
    const parsed = parseCsvDocument(source);

    expect(parsed.error).toBeNull();
    expect(parsed.dialect).toEqual({ delimiter: ";", lineEnding: "crlf", trailingNewline: false });
    expect(parsed.rows).toEqual([
      ["name", "count", "note"],
      ["alpha", "12", "line 1\r\nline 2"],
      ["beta", "24", "a; b"]
    ]);
    expect(csvHasHeader(parsed, "auto")).toBe(true);
    expect(serializeCsvDocument(parsed.rows, parsed.dialect)).toBe(source);
  });

  it("preserves a trailing record separator while editing", () => {
    const source = "name,count\r\nalpha,12\r\n";
    const parsed = parseCsvDocument(source);

    parsed.rows[1][1] = "13";
    expect(parsed.dialect.trailingNewline).toBe(true);
    expect(serializeCsvDocument(parsed.rows, parsed.dialect)).toBe("name,count\r\nalpha,13\r\n");
  });

  it("does not impose a small-file row cap", () => {
    const source = Array.from({ length: 50_001 }, (_, index) => `${index},value-${index}`).join("\n");
    const parsed = parseCsvDocument(source);

    expect(parsed.error).toBeNull();
    expect(parsed.rows).toHaveLength(50_001);
    expect(parsed.rows.at(-1)).toEqual(["50000", "value-50000"]);
  });

  it("parses rectangular clipboard data and labels columns beyond Z", () => {
    expect(parseClipboardGrid("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(csvColumnLabel(0)).toBe("A");
    expect(csvColumnLabel(25)).toBe("Z");
    expect(csvColumnLabel(26)).toBe("AA");
  });

  it("returns a repairable error for malformed quotes", () => {
    const parsed = parseCsvDocument('a,b\n"unterminated');
    expect(parsed.error).toMatchObject({ line: 2, message: "字段引号没有闭合。" });
  });
});
