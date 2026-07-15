import { useState } from "react";

import { viewportCenterPoint, type CanvasLiveState } from "@/features/mermaid-editor/components/mermaid-editor/editor-shell-utils";
import type { EditorRuntime } from "@/features/mermaid-editor/lib/editor-runtime";
import type { MermaidGraph, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand, GraphCommandSource } from "@/features/mermaid-editor/lib/interaction/commands";
import {
  initialMarkdownDocumentSource,
  markdownDocumentActionForProjectFile,
  markdownDocumentLabel,
  markdownDocumentNodeForProjectFile,
  MARKDOWN_DOCUMENT_NODE_HEIGHT,
  MARKDOWN_DOCUMENT_NODE_WIDTH,
  normalizeNewMarkdownFileName
} from "@/features/mermaid-editor/lib/markdown-document";
import type { ProjectFileEntry, ProjectWorkspace } from "@/features/mermaid-editor/lib/project-workspace";

export function useMarkdownDocumentActions({
  runtime,
  graph,
  viewport,
  canvasLiveState,
  projectWorkspace,
  applyEditorCommand,
  refreshProjectWorkspace,
  setStatus,
  showFileWorkflowError,
  updatePreviewFromText
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
  updatePreviewFromText: (path: string, text: string) => void;
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

  function addProjectMarkdownFile(
    file: ProjectFileEntry,
    point = viewportCenterPoint(viewport, canvasLiveState.canvasSize),
    source: GraphCommandSource = "menu"
  ) {
    const existing = markdownDocumentNodeForProjectFile(graph.nodes, file);
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
          x: width / 2 - (existing.x + MARKDOWN_DOCUMENT_NODE_WIDTH / 2) * viewport.scale,
          y: height / 2 - (existing.y + MARKDOWN_DOCUMENT_NODE_HEIGHT / 2) * viewport.scale,
          scale: viewport.scale
        },
        source
      });
      setStatus(`画布中已存在 ${file.name}，已定位到文档卡片。`);
      setDialogOpen(false);
      return;
    }

    applyEditorCommand({
      type: "graph.addNodeAt",
      point: {
        x: point.x - MARKDOWN_DOCUMENT_NODE_WIDTH / 2,
        y: point.y - MARKDOWN_DOCUMENT_NODE_HEIGHT / 2
      },
      label: markdownDocumentLabel(file),
      action: markdownDocumentActionForProjectFile(file),
      message: `已添加 Markdown 文档 ${file.name}。`,
      source
    });
    setDialogOpen(false);
    setExistingCollision(null);
  }

  async function createMarkdownDocument(value: string) {
    const fileName = normalizeNewMarkdownFileName(value);
    if (!fileName) {
      setStatus("请输入不含路径分隔符的 Markdown 文件名。");
      return;
    }
    if (!projectWorkspace) {
      setStatus("请先打开项目文件夹，再新建 Markdown 文档对象。");
      return;
    }

    const text = initialMarkdownDocumentSource(fileName);
    setCreating(true);
    setExistingCollision(null);
    try {
      const result = await runtime.createProjectDocument({
        rootPath: projectWorkspace.rootPath,
        fileName,
        documentKind: "markdown",
        text
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

      updatePreviewFromText(file.path, result.text);
      await refreshProjectWorkspace();
      addProjectMarkdownFile(file);
    } catch (error) {
      showFileWorkflowError(error, "新建 Markdown 文档失败。");
    } finally {
      setCreating(false);
    }
  }

  return {
    dialogOpen,
    creating,
    existingCollision,
    openDialog,
    closeDialog,
    addProjectMarkdownFile,
    createMarkdownDocument,
    dialogProps: dialogOpen ? {
      projectWorkspace,
      creating,
      existingCollision,
      onClose: closeDialog,
      onSelect: addProjectMarkdownFile,
      onCreate: createMarkdownDocument,
      onUseExistingCollision() {
        if (existingCollision) addProjectMarkdownFile(existingCollision);
      }
    } : undefined,
    useExistingCollision() {
      if (existingCollision) addProjectMarkdownFile(existingCollision);
    }
  };
}
