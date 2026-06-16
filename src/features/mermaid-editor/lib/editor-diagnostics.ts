export type EditorDiagnosticSeverity = "error" | "warning";
export type EditorDiagnosticSource = "mermaid-parse" | "mermaid-render" | "serializer";

export type EditorDiagnostic = {
  id: string;
  severity: EditorDiagnosticSeverity;
  source: EditorDiagnosticSource;
  code: string;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
  pointer?: string;
  suggestion?: string;
  rawMessage?: string;
};

export function normalizeMermaidError(
  error: unknown,
  sourceText: string,
  source: EditorDiagnosticSource = "mermaid-parse"
): EditorDiagnostic {
  const rawMessage = errorMessage(error);
  const line = parseLine(rawMessage);
  const lines = sourceText.split(/\r?\n/);
  const snippet = line && lines[line - 1] ? lines[line - 1] : parseSnippet(rawMessage);
  const pointer = parsePointer(rawMessage);
  const column = pointer ? pointer.indexOf("^") + 1 : undefined;
  const suggestion = buildSuggestion(rawMessage, snippet);

  return {
    id: `${source}:${line || "unknown"}:${column || "unknown"}:${hashText(rawMessage)}`,
    severity: "error",
    source,
    code: source === "mermaid-render" ? "MERMAID_RENDER_ERROR" : "MERMAID_PARSE_ERROR",
    message: line ? `第 ${line} 行 Mermaid 语法错误` : "Mermaid 语法错误",
    line,
    column,
    snippet,
    pointer,
    suggestion,
    rawMessage
  };
}

export function hasBlockingDiagnostics(diagnostics: EditorDiagnostic[]) {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function parseLine(message: string) {
  const match = message.match(/(?:Parse|Lexical) error on line\s+(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function parseSnippet(message: string) {
  const lines = message.split(/\r?\n/);
  const pointerIndex = lines.findIndex((line) => line.includes("^"));
  if (pointerIndex > 0) return lines[pointerIndex - 1].trim();
  return undefined;
}

function parsePointer(message: string) {
  return message
    .split(/\r?\n/)
    .find((line) => line.includes("^"))
    ?.replace(/\t/g, " ");
}

function buildSuggestion(message: string, snippet?: string) {
  const text = `${message}\n${snippet || ""}`;
  if (text.includes("-.>")) return "虚线箭头应写为 -.->；带标签可写为 A -.->|文本| B。";
  if (/Expecting/i.test(text)) return "检查该行的连线符号、标签分隔符或节点 ID，确保符合 Mermaid flowchart 语法。";
  return "检查 Mermaid 源码语法后再刷新画布。";
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
