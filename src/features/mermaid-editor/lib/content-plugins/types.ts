import type { CanvasNodeAction, CanvasNodePreview } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorRuntime, RuntimeFileRef } from "@/features/mermaid-editor/lib/editor-runtime";

export type PluginPasteMatch = {
  pluginId: string;
  url: string;
};

export type PluginResolveContext = {
  runtime: EditorRuntime;
  fileRef: RuntimeFileRef | null;
};

export type PluginCardDraft = {
  label: string;
  action: CanvasNodeAction;
  preview: CanvasNodePreview;
};

export type CanvasContentPlugin = {
  id: string;
  label: string;
  urlPatterns: string[];
  matchText: (text: string) => PluginPasteMatch[];
  resolve: (match: PluginPasteMatch, context: PluginResolveContext) => Promise<PluginCardDraft>;
};
