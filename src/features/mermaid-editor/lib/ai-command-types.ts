import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { DiffResult, PatchOperation } from "@/features/mermaid-editor/lib/mermaid-patch";

export type AiApplyCommand = {
  id: string;
  type: "applyPatch";
  createdAt: string;
  expiresAt: string;
  targetFileName?: string;
  ops: PatchOperation[];
  autoSave: boolean;
};

export type AiEditorCommand = AiApplyCommand;

export type AiApplyResult = {
  commandId: string;
  applied: boolean;
  saved: boolean;
  changed: boolean;
  fileName?: string;
  source?: string;
  diff?: DiffResult;
  diagnostics: EditorDiagnostic[];
};

export type AiApplyCommandResponse =
  | {
      ok: true;
      command: AiApplyCommand;
      diagnostics: EditorDiagnostic[];
    }
  | {
      ok: false;
      command?: AiApplyCommand;
      diagnostics: EditorDiagnostic[];
    };

export type AiNextCommandResponse = {
  ok: boolean;
  command?: AiEditorCommand;
  diagnostics: EditorDiagnostic[];
};

export type AiCommandResultResponse = {
  ok: boolean;
  status: "pending" | "completed" | "missing" | "timeout";
  result?: AiApplyResult;
  diagnostics: EditorDiagnostic[];
};
