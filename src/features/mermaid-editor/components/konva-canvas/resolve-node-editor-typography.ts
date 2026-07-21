import type { InlineEdit } from "./inline-edit-overlays";
import type { EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";
import { isMarkdownDocumentNode } from "@/features/mermaid-editor/lib/markdown-document";
import { normalizeCanvasNodePreview } from "@/features/mermaid-editor/lib/node-preview";

export function resolveNodeEditorTypography(graph: MermaidGraph, inlineEdit: InlineEdit | null, typography: EditorTypographyTokens) {
  if (inlineEdit?.type !== "node") return typography.canvas.nodeEditor;
  const node = graph.nodes.find((entry) => entry.id === inlineEdit.id);
  if (!node) return typography.canvas.nodeEditor;
  if (normalizeCanvasNodePreview(node.preview)) return typography.linkCard.titleEditor;
  if (isMarkdownDocumentNode(node)) return typography.markdownCard.titleEditor;
  return typography.canvas.nodeEditor;
}
