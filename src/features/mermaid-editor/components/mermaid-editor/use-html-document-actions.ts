import { useState } from "react";

import { viewportCenterPoint, type CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand, GraphCommandSource } from "@/features/mermaid-editor/lib/interaction/commands";
import {
  HTML_DOCUMENT_NODE_HEIGHT,
  HTML_DOCUMENT_NODE_WIDTH,
  htmlDocumentActionForProjectFile,
  htmlDocumentLabel,
  htmlDocumentNodeForProjectFile,
  initialHtmlDocumentSource,
  normalizeNewHtmlFileName
} from "@/features/mermaid-editor/lib/html-document";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function useHtmlDocumentActions({
  runtime,
  graph,
  viewport,
  canvasLiveState,
  projectWorkspace,
  applyEditorCommand,
  refreshProjectWorkspace,
  setStatus,
  showFileWorkflowError
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
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [existingCollision, setExistingCollision] = useState<ProjectFileEntry | null>(null);

  function openDialog() {
    setExistingCollision(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (creating) return;
    setDialogOpen(false);
    setExistingCollision(null);
  }

  function addProjectHtmlFile(
    file: ProjectFileEntry,
    point = viewportCenterPoint(viewport, canvasLiveState.canvasSize),
    source: GraphCommandSource = "menu"
  ) {
    const existing = htmlDocumentNodeForProjectFile(graph.nodes, file);
    if (existing) {
      applyEditorCommand({
        type: "selection.set",
        selection: { nodeIds: [existing.id], edgeIds: [], subgraphIds: [], primaryId: existing.id },
        source
      });
      const width = canvasLiveState.canvasSize?.width || 840;
      const height = canvasLiveState.canvasSize?.height || 520;
      applyEditorCommand({
        type: "viewport.set",
        viewport: {
          x: width / 2 - (existing.x + HTML_DOCUMENT_NODE_WIDTH / 2) * viewport.scale,
          y: height / 2 - (existing.y + HTML_DOCUMENT_NODE_HEIGHT / 2) * viewport.scale,
          scale: viewport.scale
        },
        source
      });
      setStatus(`画布中已存在 ${file.name}，已定位到 HTML 节点。`);
      setDialogOpen(false);
      return;
    }

    applyEditorCommand({
      type: "graph.addNodeAt",
      point: {
        x: point.x - HTML_DOCUMENT_NODE_WIDTH / 2,
        y: point.y - HTML_DOCUMENT_NODE_HEIGHT / 2
      },
      label: htmlDocumentLabel(file),
      action: htmlDocumentActionForProjectFile(file),
      message: `已添加 HTML 文件 ${file.name}。`,
      source
    });
    setDialogOpen(false);
    setExistingCollision(null);
  }

  async function createHtmlDocument(value: string) {
    const fileName = normalizeNewHtmlFileName(value);
    if (!fileName) {
      setStatus("请输入不含路径分隔符的 HTML 文件名。");
      return;
    }
    if (!projectWorkspace) {
      setStatus("请先打开项目文件夹，再新建 HTML 文件节点。");
      return;
    }

    setCreating(true);
    setExistingCollision(null);
    try {
      const result = await runtime.createProjectFile({
        rootPath: projectWorkspace.rootPath,
        directoryPath: "",
        fileName,
        kind: "html",
        text: initialHtmlDocumentSource(fileName)
      });
      if (result.status === "unsupported") {
        setStatus(result.message);
        return;
      }

      const file: ProjectFileEntry = {
        name: result.file.name,
        path: result.file.path || fileName,
        relativePath: fileName
      };
      if (result.status === "exists") {
        setExistingCollision(file);
        setStatus(`${fileName} 已存在，不会覆盖原文件。`);
        return;
      }

      await refreshProjectWorkspace();
      addProjectHtmlFile(file);
    } catch (error) {
      showFileWorkflowError(error, "新建 HTML 文件失败。");
    } finally {
      setCreating(false);
    }
  }

  return {
    openDialog,
    addProjectHtmlFile,
    dialogProps: dialogOpen ? {
      projectWorkspace,
      creating,
      existingCollision,
      onClose: closeDialog,
      onSelect: addProjectHtmlFile,
      onCreate: createHtmlDocument,
      onUseExistingCollision() {
        if (existingCollision) addProjectHtmlFile(existingCollision);
      }
    } : undefined
  };
}
