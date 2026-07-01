export const FLOWCHART_LINE_PATTERN = /^(flowchart|graph)\s+/i;

export function normalizeLabel(value: string) {
  return value.trim().replace(/^["']|["']$/g, "").replace(/<br\s*\/?>/gi, "\n");
}

export function cleanNodeId(value: string) {
  const cleaned = value.trim().replace(/[^\w-]/g, "_");
  if (!cleaned) return `Node_${Date.now()}`;
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `Node_${cleaned}`;
}

export function readObjectFields(value: string) {
  const fields = new Map<string, string>();
  const fieldPattern = /([A-Za-z][\w-]*)\s*:\s*("((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|[^,\n\r}]+)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldPattern.exec(value))) {
    const [, rawKey, rawValue, doubleQuoted, singleQuoted] = match;
    fields.set(rawKey, unescapeMermaidString(doubleQuoted ?? singleQuoted ?? rawValue.trim()));
  }

  return fields;
}

export function unescapeMermaidString(value: string) {
  return value.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

export function escapeMermaidStringLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "<br/>").replace(/"/g, '\\"');
}

export function escapeMermaidLabel(value: string) {
  return value.replace(/\r?\n/g, "<br/>").replace(/"/g, '\\"');
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
