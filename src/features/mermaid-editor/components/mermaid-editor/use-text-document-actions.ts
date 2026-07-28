import { viewportCenterPoint, type CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand, GraphCommandSource } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ProjectFileEntry } from "@/features/mermaid-editor/lib/project-workspace";
import { TEXT_DOCUMENT_NODE_HEIGHT, TEXT_DOCUMENT_NODE_WIDTH, textDocumentActionForProjectFile, textDocumentLabel, textDocumentNodeForProjectFile } from "@/features/mermaid-editor/lib/text-document";

export function useTextDocumentActions({ graph, viewport, canvasLiveState, applyEditorCommand, setStatus }: {
  graph: MermaidGraph;
  viewport: ViewportState;
  canvasLiveState: CanvasLiveState;
  applyEditorCommand: (command: EditorCommand) => void;
  setStatus: (message: string) => void;
}) {
  function addProjectTextFile(file: ProjectFileEntry, point = viewportCenterPoint(viewport, canvasLiveState.canvasSize), source: GraphCommandSource = "menu") {
    const existing = textDocumentNodeForProjectFile(graph.nodes, file);
    if (existing) {
      applyEditorCommand({ type: "selection.set", selection: { nodeIds: [existing.id], edgeIds: [], subgraphIds: [], primaryId: existing.id }, source });
      setStatus(`画布中已存在 ${file.name}，已选中文本节点。`);
      return;
    }
    applyEditorCommand({
      type: "graph.addNodeAt",
      point: { x: point.x - TEXT_DOCUMENT_NODE_WIDTH / 2, y: point.y - TEXT_DOCUMENT_NODE_HEIGHT / 2 },
      label: textDocumentLabel(file),
      action: textDocumentActionForProjectFile(file),
      message: `已添加文本文件 ${file.name}。`,
      source
    });
  }
  return { addProjectTextFile };
}
