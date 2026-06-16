import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";

type DiagnosticPanelProps = {
  diagnostics: EditorDiagnostic[];
  compact?: boolean;
};

export function DiagnosticPanel({ diagnostics, compact = false }: DiagnosticPanelProps) {
  if (!diagnostics.length) return null;

  const primary = diagnostics[0];

  return (
    <div className={compact ? "border-t bg-destructive/5 p-3" : "m-4 max-w-2xl rounded-md border border-destructive/30 bg-card/95 p-4"}>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-destructive">{primary.message}</p>
          <span className="shrink-0 rounded-sm border border-destructive/30 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-destructive">
            {primary.code}
          </span>
        </div>
        {primary.snippet ? (
          <pre className="overflow-x-auto rounded-md border bg-background/80 p-2 font-mono text-xs leading-5 text-foreground">
            {primary.line ? `${primary.line}: ` : ""}
            {primary.snippet}
            {primary.pointer ? `\n${primary.line ? " ".repeat(String(primary.line).length + 2) : ""}${primary.pointer}` : ""}
          </pre>
        ) : null}
        {primary.suggestion ? <p className="text-xs text-muted-foreground">{primary.suggestion}</p> : null}
        {!compact && primary.rawMessage ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Mermaid 原始错误</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border bg-background/80 p-2 font-mono leading-5">{primary.rawMessage}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
