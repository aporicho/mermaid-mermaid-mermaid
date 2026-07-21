import type { CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import { useCsvTableDocumentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-csv-table-document-actions";
import { useMarkdownDocumentActions } from "@/features/mermaid-editor/components/mermaid-editor/use-markdown-document-actions";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function useLinkedProjectDocuments({
  runtime,
  graph,
  viewport,
  canvasLiveState,
  projectWorkspace,
  applyEditorCommand,
  refreshProjectWorkspace,
  setStatus,
  showFileWorkflowError,
  updateMarkdownPreviewFromText
}: {
  runtime: EditorRuntime;
  graph: MermaidGraph;
  viewport: ViewportState;
  canvasLiveState: CanvasLiveState;
  projectWorkspace: ProjectWorkspace | null;
  applyEditorCommand: (command: EditorCommand) => void;
  refreshProjectWorkspace: () => Promise<unknown> | void;
  setStatus: (message: string) => void;
  showFileWorkflowError: (error: unknown, fallbackMessage?: string) => void;
  updateMarkdownPreviewFromText: (path: string, text: string) => void;
}) {
  const shared = {
    runtime,
    graph,
    viewport,
    canvasLiveState,
    projectWorkspace,
    applyEditorCommand,
    refreshProjectWorkspace,
    setStatus,
    showFileWorkflowError
  };
  const markdownDocuments = useMarkdownDocumentActions({
    ...shared,
    updatePreviewFromText: updateMarkdownPreviewFromText
  });
  const csvTables = useCsvTableDocumentActions(shared);
  return { markdownDocuments, csvTables };
}
