import { AlignCenter, AlignLeft, AlignRight, BinMinusIn, Table2Columns, TableRows } from "iconoir-react/regular";

import { Separator } from "@/components/ui/separator";
import { EditorIconButton, EditorToolbar, EditorToolbarGroup } from "@/features/mermaid-editor/components/editor-ui";
import { resolveSelectionToolbarPosition } from "@/features/mermaid-editor/components/konva-canvas/selection-arrangement-toolbar";
import type { CanvasTableAlign, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { NodeGeometry } from "@/features/mermaid-editor/lib/node-geometry";
import type { TableCellSelection } from "@/features/mermaid-editor/lib/table-node";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

export type TableCellToolbarOperation =
  | "insert-row"
  | "delete-row"
  | "insert-column"
  | "delete-column"
  | `align-${CanvasTableAlign}`;

export function TableCellToolbar({
  selection,
  geometry,
  viewport,
  canvasSize,
  align,
  canDeleteRow,
  canDeleteColumn,
  onOperation
}: {
  selection: TableCellSelection;
  geometry: NodeGeometry;
  viewport: ViewportState;
  canvasSize: { width: number; height: number };
  align: CanvasTableAlign;
  canDeleteRow: boolean;
  canDeleteColumn: boolean;
  onOperation: (operation: TableCellToolbarOperation) => void;
}) {
  const cell = geometry.table?.cells.find((candidate) => candidate.rowId === selection.rowId && candidate.columnId === selection.columnId);
  if (!cell) return null;
  const position = resolveSelectionToolbarPosition({
    selection: {
      id: `${selection.nodeId}:${selection.rowId}:${selection.columnId}`,
      x: geometry.frame.x + cell.frame.x,
      y: geometry.frame.y + cell.frame.y,
      width: cell.frame.width,
      height: cell.frame.height
    },
    viewport,
    canvasSize,
    toolbarSize: { width: 290, height: 40 }
  });
  return (
    <EditorToolbar
      aria-label="表格单元格工具"
      className="absolute text-foreground"
      style={{ left: position.left, top: position.top, zIndex: OVERLAY_Z_INDEX.workspaceBase }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      data-editor-floating-menu-ignore
    >
      <EditorToolbarGroup aria-label="行列">
        <ToolbarButton label="在下方插入行" onClick={() => onOperation("insert-row")}><TableRows className="size-4" /></ToolbarButton>
        <ToolbarButton label="删除当前行" disabled={!canDeleteRow} tone="danger" onClick={() => onOperation("delete-row")}><BinMinusIn className="size-4" /></ToolbarButton>
        <ToolbarButton label="在右侧插入列" onClick={() => onOperation("insert-column")}><Table2Columns className="size-4" /></ToolbarButton>
        <ToolbarButton label="删除当前列" disabled={!canDeleteColumn} tone="danger" onClick={() => onOperation("delete-column")}><BinMinusIn className="size-4 rotate-90" /></ToolbarButton>
      </EditorToolbarGroup>
      <Separator orientation="vertical" className="mx-0.5 h-6" />
      <EditorToolbarGroup aria-label="列对齐">
        <ToolbarButton label="左对齐" pressed={align === "left"} onClick={() => onOperation("align-left")}><AlignLeft className="size-4" /></ToolbarButton>
        <ToolbarButton label="居中对齐" pressed={align === "center"} onClick={() => onOperation("align-center")}><AlignCenter className="size-4" /></ToolbarButton>
        <ToolbarButton label="右对齐" pressed={align === "right"} onClick={() => onOperation("align-right")}><AlignRight className="size-4" /></ToolbarButton>
      </EditorToolbarGroup>
    </EditorToolbar>
  );
}

function ToolbarButton(props: React.ComponentProps<typeof EditorIconButton>) {
  return <EditorIconButton type="button" context="toolbar" tooltipSide="top" {...props} />;
}
