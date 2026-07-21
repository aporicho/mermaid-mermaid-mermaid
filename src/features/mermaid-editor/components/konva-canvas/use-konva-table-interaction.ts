import { useEffect, useState } from "react";

import type { TableCellToolbarOperation } from "@/features/mermaid-editor/components/konva-canvas/table-cell-toolbar";
import type { SpecialNodeThemeTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { MermaidGraph, Selection } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import { resolveCanvasNodeKind } from "@/features/mermaid-editor/lib/canvas-node-kind";
import {
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  resizeTableColumn,
  setTableColumnAlign,
  type TableCellSelection
} from "@/features/mermaid-editor/lib/table-node";

export function useKonvaTableInteraction({
  graph,
  selection,
  specialNodeTokens,
  onEditorCommand
}: {
  graph: MermaidGraph;
  selection: Selection;
  specialNodeTokens: SpecialNodeThemeTokens;
  onEditorCommand: (command: EditorCommand) => void;
}) {
  const [selectedTableCell, setSelectedTableCell] = useState<TableCellSelection | null>(null);

  useEffect(() => {
    if (!selectedTableCell) return;
    const node = graph.nodes.find((item) => item.id === selectedTableCell.nodeId);
    const content = node && resolveCanvasNodeKind(node) === "table" && node.content?.kind === "table" ? node.content : undefined;
    const cellExists = Boolean(
      content?.rows.some((row) => row.id === selectedTableCell.rowId)
      && content.columns.some((column) => column.id === selectedTableCell.columnId)
    );
    if (!selection.nodeIds.includes(selectedTableCell.nodeId) || !cellExists) setSelectedTableCell(null);
  }, [graph.nodes, selectedTableCell, selection.nodeIds]);

  function resizeColumn(nodeId: string, columnId: string, width: number) {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node || resolveCanvasNodeKind(node) !== "table" || node.content?.kind !== "table") return;
    const content = resizeTableColumn(node.content, columnId, width, specialNodeTokens.table.minColumnWidth);
    if (content === node.content) return;
    onEditorCommand({
      type: "graph.updateNode",
      nodeId,
      patch: { content },
      message: "已调整表格列宽。",
      source: "pointer"
    });
  }

  function applyOperation(operation: TableCellToolbarOperation) {
    if (!selectedTableCell) return;
    const node = graph.nodes.find((item) => item.id === selectedTableCell.nodeId);
    if (!node || resolveCanvasNodeKind(node) !== "table" || node.content?.kind !== "table") return;
    const rowIndex = node.content.rows.findIndex((row) => row.id === selectedTableCell.rowId);
    const columnIndex = node.content.columns.findIndex((column) => column.id === selectedTableCell.columnId);
    let content = node.content;
    if (operation === "insert-row") content = insertTableRow(content, selectedTableCell.rowId);
    if (operation === "delete-row") content = deleteTableRow(content, selectedTableCell.rowId);
    if (operation === "insert-column") content = insertTableColumn(content, selectedTableCell.columnId);
    if (operation === "delete-column") content = deleteTableColumn(content, selectedTableCell.columnId);
    if (operation.startsWith("align-")) content = setTableColumnAlign(content, selectedTableCell.columnId, operation.slice(6) as "left" | "center" | "right");
    if (content === node.content) return;
    onEditorCommand({ type: "graph.updateNode", nodeId: node.id, patch: { content }, message: "已更新表格。", source: "menu" });
    const row = content.rows[Math.min(Math.max(0, rowIndex), Math.max(0, content.rows.length - 1))];
    const column = content.columns[Math.min(Math.max(0, columnIndex), content.columns.length - 1)];
    if (row && column) setSelectedTableCell({ nodeId: node.id, rowId: row.id, columnId: column.id });
  }

  return { selectedTableCell, setSelectedTableCell, resizeColumn, applyOperation };
}
