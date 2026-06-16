import { describe, expect, it } from "vitest";

import { normalizeMermaidError } from "@/features/mermaid-editor/lib/editor-diagnostics";

describe("editor diagnostics", () => {
  it("normalizes Mermaid parse errors with line, pointer and suggestions", () => {
    const diagnostic = normalizeMermaidError(
      new Error(`Parse error on line 72:
...-.>|AI 可忽略布局细节| CLI
----------------------^
Expecting 'LINK', 'UNICODE_TEXT', 'EDGE_TEXT', got '1'`),
      ["flowchart LR", "  A --> B"].join("\n")
    );

    expect(diagnostic).toMatchObject({
      severity: "error",
      source: "mermaid-parse",
      code: "MERMAID_PARSE_ERROR",
      message: "第 72 行 Mermaid 语法错误",
      line: 72,
      column: 23,
      snippet: "...-.>|AI 可忽略布局细节| CLI",
      suggestion: "虚线箭头应写为 -.->；带标签可写为 A -.->|文本| B。"
    });
  });

  it("falls back to a generic diagnostic when Mermaid does not provide location data", () => {
    const diagnostic = normalizeMermaidError(new Error("Unexpected renderer failure"), "flowchart LR\nA --> B", "mermaid-render");

    expect(diagnostic).toMatchObject({
      severity: "error",
      source: "mermaid-render",
      code: "MERMAID_RENDER_ERROR",
      message: "Mermaid 语法错误",
      rawMessage: "Unexpected renderer failure"
    });
  });
});
