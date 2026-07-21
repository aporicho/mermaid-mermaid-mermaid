import { SelectionArrangementToolbar, shouldShowSelectionArrangementToolbar } from "@/features/mermaid-editor/components/konva-canvas/selection-arrangement-toolbar";
import { TableCellToolbar, type TableCellToolbarOperation } from "@/features/mermaid-editor/components/konva-canvas/table-cell-toolbar";
import type { AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import type { EditorMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { NodeArrangementOperation } from "@/features/mermaid-editor/lib/node-arrangement";
import type { TableCellSelection } from "@/features/mermaid-editor/lib/table-node";

export function CanvasSelectionToolbars({
  graph,
  selection,
  mode,
  manualLayout,
  interactionKind,
  inlineEditing,
  contextMenuOpen,
  selectedNodeRects,
  selectedTableCell,
  nodeGeometryById,
  viewport,
  canvasSize,
  onArrange,
  onTableOperation
}: {
  graph: MermaidGraph;
  selection: Selection;
  mode: EditorMode;
  manualLayout: boolean;
  interactionKind: string;
  inlineEditing: boolean;
  contextMenuOpen: boolean;
  selectedNodeRects: AlignmentRect[];
  selectedTableCell: TableCellSelection | null;
  nodeGeometryById: Map<string, NodeGeometry>;
  viewport: ViewportState;
  canvasSize: { width: number; height: number };
  onArrange: (operation: NodeArrangementOperation) => void;
  onTableOperation: (operation: TableCellToolbarOperation) => void;
}) {
  const showArrangement = shouldShowSelectionArrangementToolbar({
    selectedNodeCount: selectedNodeRects.length,
    mode,
    manualLayout,
    interactionKind,
    inlineEditing,
    contextMenuOpen
  });
  const tableNode = selectedTableCell ? graph.nodes.find((node) => node.id === selectedTableCell.nodeId && node.content?.kind === "table") : undefined;
  const tableGeometry = tableNode ? nodeGeometryById.get(tableNode.id) : undefined;
  const tableColumn = tableNode?.content?.columns.find((column) => column.id === selectedTableCell?.columnId);
  const showTable = Boolean(
    selectedTableCell && tableNode && tableGeometry && tableColumn && selection.nodeIds.includes(selectedTableCell.nodeId) &&
    mode === "select" && interactionKind === "idle" && !inlineEditing && !contextMenuOpen
  );
  return (
    <>
      {showArrangement ? <SelectionArrangementToolbar rects={selectedNodeRects} viewport={viewport} canvasSize={canvasSize} onArrange={onArrange} /> : null}
      {showTable && selectedTableCell && tableNode?.content?.kind === "table" && tableGeometry && tableColumn ? (
        <TableCellToolbar
          selection={selectedTableCell}
          geometry={tableGeometry}
          viewport={viewport}
          canvasSize={canvasSize}
          align={tableColumn.align}
          canDeleteRow={tableNode.content.rows.length > 1}
          canDeleteColumn={tableNode.content.columns.length > 1}
          onOperation={onTableOperation}
        />
      ) : null}
    </>
  );
}
