import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";
import type { AiApplyCommand, AiApplyResult, AiEditorCommand } from "@/features/mermaid-editor/lib/ai-command-types";
import type { PatchOperation } from "@/features/mermaid-editor/lib/mermaid-patch";

const DEFAULT_COMMAND_TTL_MS = 30_000;
const MAX_RESULTS = 40;

let commandCounter = 0;
let pendingCommands: AiEditorCommand[] = [];
const commandResults = new Map<string, AiApplyResult>();

export function submitAiApplyCommand(input: {
  ops: PatchOperation[];
  targetFileName?: string;
  autoSave?: boolean;
  now?: Date;
  ttlMs?: number;
}): AiApplyCommand {
  const now = input.now || new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_COMMAND_TTL_MS;
  const command: AiApplyCommand = {
    id: nextCommandId(),
    type: "applyPatch",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    ...(input.targetFileName ? { targetFileName: input.targetFileName } : {}),
    ops: input.ops,
    autoSave: input.autoSave ?? true
  };

  pendingCommands.push(command);
  return command;
}

export function takeNextAiCommand(now = new Date()): AiEditorCommand | undefined {
  pendingCommands = pendingCommands.filter((command) => Date.parse(command.expiresAt) > now.getTime());
  return pendingCommands.shift();
}

export function setAiCommandResult(commandId: string, result: AiApplyResult) {
  commandResults.set(commandId, result);
  trimResults();
}

export function getAiCommandResult(commandId: string): AiApplyResult | undefined {
  return commandResults.get(commandId);
}

export function clearAiCommands() {
  pendingCommands = [];
  commandResults.clear();
}

export function aiCommandDiagnostic(code: string, message: string, suggestion?: string): EditorDiagnostic {
  return {
    id: `ai-command:${code}:${hashText(message)}`,
    severity: "error",
    source: "serializer",
    code,
    message,
    suggestion
  };
}

function nextCommandId() {
  commandCounter += 1;
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${commandCounter}`;
  return `cmd_${random}`;
}

function trimResults() {
  const extra = commandResults.size - MAX_RESULTS;
  if (extra <= 0) return;
  for (const key of [...commandResults.keys()].slice(0, extra)) {
    commandResults.delete(key);
  }
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
