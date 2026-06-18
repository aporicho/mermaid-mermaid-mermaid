import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { AiEditorContext } from "@/features/mermaid-editor/lib/ai-context";
import { markAiEditorContextStale } from "@/features/mermaid-editor/lib/ai-context";

export type AiContextResponse =
  | {
      ok: true;
      context: AiEditorContext;
      diagnostics: EditorDiagnostic[];
    }
  | {
      ok: false;
      context?: AiEditorContext;
      diagnostics: EditorDiagnostic[];
    };

let latestContext: AiEditorContext | null = null;

export function setLatestAiEditorContext(context: AiEditorContext) {
  latestContext = context;
  return latestContext;
}

export function getLatestAiEditorContext(now = new Date()): AiContextResponse {
  if (!latestContext) {
    return {
      ok: false,
      diagnostics: [aiContextDiagnostic("NO_ACTIVE_EDITOR_CONTEXT", "当前没有可用的编辑器上下文。", "请先打开编辑器，并保持页面或窗口处于运行状态。")]
    };
  }

  const context = markAiEditorContextStale(latestContext, now);
  latestContext = context;

  return {
    ok: !context.stale,
    context,
    diagnostics: context.stale
      ? [aiContextDiagnostic("STALE_EDITOR_CONTEXT", "编辑器上下文已过期。", "请确认编辑器仍在打开，并重新执行 context 命令。")]
      : []
  };
}

export function clearLatestAiEditorContext() {
  latestContext = null;
}

export function aiContextDiagnostic(code: string, message: string, suggestion?: string): EditorDiagnostic {
  return {
    id: `ai-context:${code}:${hashText(message)}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
