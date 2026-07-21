import type { CanvasNode } from "@/features/mermaid-editor/lib/editor-types";
import { isMarkdownDocumentNode } from "@/features/mermaid-editor/lib/markdown-document";
import { normalizeImageAsset } from "@/features/mermaid-editor/lib/node-assets";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";

export type CanvasNodeKind = "table" | "markdown-document" | "link-card" | "image" | "standard";

/** A single precedence rule for every special canvas-node renderer. */
export function resolveCanvasNodeKind(node: CanvasNode): CanvasNodeKind {
  if (isCsvTableNode(node) || node.content?.kind === "table") return "table";
  if (isMarkdownDocumentNode(node)) return "markdown-document";
  if (normalizeCanvasNodePreview(node.preview)) return "link-card";
  if (normalizeImageAsset(node.asset)) return "image";
  return "standard";
}

export function isCsvTableNode(node: Pick<CanvasNode, "action">) {
  return node.action?.kind === "file" && /\.csv$/i.test(node.action.path.trim());
}
