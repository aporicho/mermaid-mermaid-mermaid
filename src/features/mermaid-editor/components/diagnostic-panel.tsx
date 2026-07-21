import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import { EditorNotice, EditorStatusBadge } from "@/features/mermaid-editor/components/editor-ui";

type DiagnosticPanelProps = {
  diagnostics: EditorDiagnostic[];
  compact?: boolean;
};

export function DiagnosticPanel({ diagnostics, compact = false }: DiagnosticPanelProps) {
  if (!diagnostics.length) return null;

  const primary = diagnostics[0];

  return (
    <EditorNotice
      tone="danger"
      className={compact ? "border-x-0 border-b-0" : "m-4 max-w-2xl"}
      title={primary.message}
      actions={<EditorStatusBadge tone="danger">{primary.code}</EditorStatusBadge>}
      description={<div className="grid gap-2">
        {primary.snippet ? (
          <pre className="diagnostic-summary overflow-x-auto border bg-background/80 p-2 text-foreground">
            {primary.line ? `${primary.line}: ` : ""}
            {primary.snippet}
            {primary.pointer ? `\n${primary.line ? " ".repeat(String(primary.line).length + 2) : ""}${primary.pointer}` : ""}
          </pre>
        ) : null}
        {primary.suggestion ? <p className="text-xs text-muted-foreground">{primary.suggestion}</p> : null}
        {!compact && primary.rawMessage ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Mermaid 原始错误</summary>
            <pre className="diagnostic-raw mt-2 overflow-x-auto whitespace-pre-wrap border bg-background/80 p-2">{primary.rawMessage}</pre>
          </details>
        ) : null}
      </div>}
    />
  );
}
