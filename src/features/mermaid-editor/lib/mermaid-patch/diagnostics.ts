import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";

export function patchDiagnostic(code: string, message: string, suggestion?: string): EditorDiagnostic {
  return {
    id: `patch:${code}:${hashText(message)}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

export function missing(kind: string, id: string) {
  return { diagnostic: patchDiagnostic("MISSING_TARGET", `找不到 ${kind}：${id}`) };
}

export function invalidId(id: string) {
  return patchDiagnostic("INVALID_ID", `无效或重复的 Mermaid ID：${id}`, "ID 必须以字母开头，并且只能包含字母、数字、下划线或连字符。");
}

export function invalidEdgeMermaidId(id: string) {
  return patchDiagnostic("INVALID_ID", `无效或重复的 Mermaid 边 ID：${id}`, "边 ID 必须以字母开头，并且不能和其他边 ID 重复。");
}

export function invalidEnum(kind: string, value: string) {
  return { diagnostic: patchDiagnostic("INVALID_ENUM_VALUE", `不支持的 ${kind}：${value}`) };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
