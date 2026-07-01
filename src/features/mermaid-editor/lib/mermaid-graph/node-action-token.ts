import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import {
  inferNodeActionFromMermaidTarget,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";

import {
  escapeMermaidStringLiteral,
  unescapeMermaidString
} from "./syntax";
import type { PendingNodeActionStatement } from "./types";

export function parseNodeActionStatement(clean: string): PendingNodeActionStatement | null {
  const source = clean.trim().replace(/;$/, "");
  const match = source.match(/^click\s+([A-Za-z][\w-]*)\s+([\s\S]+)$/i);
  if (!match) return null;

  const nodeId = match[1];
  const tokens = readMermaidActionTokens(match[2]);
  if (!tokens.length) return null;

  const first = tokens[0].toLowerCase();
  if (first === "call" || first === "callback") return null;

  const target = first === "href" ? tokens[1] : tokens[0];
  const tooltipCandidate = first === "href" ? tokens[2] : tokens[1];
  const tooltip = tooltipCandidate && !tooltipCandidate.startsWith("_") ? tooltipCandidate : undefined;
  const action = inferNodeActionFromMermaidTarget(target || "", tooltip);
  return action ? { nodeId, action } : null;
}

function readMermaidActionTokens(value: string) {
  const tokens: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    tokens.push(unescapeMermaidString(match[1] ?? match[2] ?? match[3]));
  }

  return tokens;
}

export function serializeNodeActionStatement(node: CanvasNode) {
  const action = normalizeNodeAction(node.action);
  if (!action) return "";
  const target = escapeMermaidStringLiteral(nodeActionTarget(action));
  const tooltip = escapeMermaidStringLiteral(action.tooltip || (action.kind === "url" ? "打开链接" : "打开文件"));
  return `  click ${node.id} href "${target}" "${tooltip}" _blank`;
}
