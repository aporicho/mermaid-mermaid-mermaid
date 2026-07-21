import { useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Line, Rect, Text } from "react-konva";

import { CANVAS_HIT_NAMES, tableCellHitId, tableHeaderHitId } from "@/features/mermaid-editor/lib/canvas-hit-target";
import type { SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import type { TableCellGeometry, TableCellSelection, TableHeaderSelection, TableNodeLayout } from "@/features/mermaid-editor/lib/table-node";

export function CanvasTableNode({
  nodeId,
  layout,
  selectedCell,
  specialNode,
  typography,
  editing,
  editingHeader,
  visualState,
  interactive = true,
  onCellClick,
  onCellDoubleClick,
  onHeaderDoubleClick,
  onResizeColumn
}: {
  nodeId: string;
  layout: TableNodeLayout;
  selectedCell: TableCellSelection | null;
  specialNode: SpecialNodeThemeTokens;
  typography: TypographyRoleTokens;
  editing: TableCellSelection | null;
  editingHeader: TableHeaderSelection | null;
  visualState?: SpecialNodeVisualState;
  interactive?: boolean;
  onCellClick?: (event: KonvaEventObject<MouseEvent>, selection: TableCellSelection) => void;
  onCellDoubleClick?: (event: KonvaEventObject<MouseEvent>, selection: TableCellSelection) => void;
  onHeaderDoubleClick?: (event: KonvaEventObject<MouseEvent>, selection: TableHeaderSelection) => void;
  onResizeColumn?: (columnId: string, width: number) => void;
}) {
  const tokens = specialNode.table;
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);
  const effectiveVisualState = visualState ?? (editing || editingHeader ? "editing" : selectedCell ? "selected" : "normal");
  const surfaceBorder = resolveSpecialNodeBorder(tokens.surface, tokens.state, effectiveVisualState);
  const gridDash = specialNodeBorderDash(tokens.grid);
  return (
    <Group listening={interactive}>
      <Rect
        width={layout.width}
        height={layout.height}
        fill={tokens.surface.background}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={tokens.surface.radius}
        shadowColor={tokens.surface.shadow.color}
        shadowBlur={tokens.surface.shadow.blur}
        shadowOpacity={tokens.surface.shadow.opacity}
        shadowOffsetX={tokens.surface.shadow.offsetX}
        shadowOffsetY={tokens.surface.shadow.offsetY}
        listening={false}
      />
      {layout.headerCells.map((cell) => (
        <Group
          key={`header:${cell.columnId}`}
          id={tableHeaderHitId(nodeId, cell.columnId)}
          name={CANVAS_HIT_NAMES.tableHeader}
          listening={interactive}
          onMouseEnter={() => setHoveredCellKey(`header:${cell.columnId}`)}
          onMouseLeave={() => setHoveredCellKey(null)}
          onDblClick={(event) => {
            event.cancelBubble = true;
            onHeaderDoubleClick?.(event, { nodeId, columnId: cell.columnId });
          }}
        >
          <Rect {...cell.frame} fill={hoveredCellKey === `header:${cell.columnId}` ? tokens.hoverCellBackground : tokens.headerBackground} />
          <Text
            {...textProps(cell, typography, tokens.headerTextColor)}
            fontStyle={String(typography.fontWeight)}
            visible={!(editingHeader?.nodeId === nodeId && editingHeader.columnId === cell.columnId)}
            listening={false}
          />
        </Group>
      ))}
      {layout.cells.map((cell) => {
        const selection = { nodeId, rowId: cell.rowId, columnId: cell.columnId };
        const selected = sameCell(selectedCell, selection);
        const isEditing = sameCell(editing, selection);
        const cellKey = `${cell.rowId}:${cell.columnId}`;
        const selectedCellBorder = tokens.selectedCellBorder;
        return (
          <Group
            key={`${cell.rowId}:${cell.columnId}`}
            id={tableCellHitId(nodeId, cell.rowId, cell.columnId)}
            name={CANVAS_HIT_NAMES.tableCell}
            listening={interactive}
            onMouseEnter={() => setHoveredCellKey(cellKey)}
            onMouseLeave={() => setHoveredCellKey(null)}
            onClick={(event) => onCellClick?.(event, selection)}
            onDblClick={(event) => onCellDoubleClick?.(event, selection)}
          >
            <Rect
              {...cell.frame}
              fill={selected ? tokens.selectedCellBackground : hoveredCellKey === cellKey ? tokens.hoverCellBackground : "rgba(0,0,0,0.001)"}
              stroke={selected ? selectedCellBorder.color : undefined}
              strokeWidth={selected ? selectedCellBorder.width : 0}
              strokeEnabled={selected && selectedCellBorder.style !== "none" && selectedCellBorder.width > 0}
              dash={selected ? specialNodeBorderDash(selectedCellBorder) : undefined}
            />
            <Text {...textProps(cell, typography, tokens.bodyTextColor)} visible={!isEditing} listening={false} />
          </Group>
        );
      })}
      <Line
        points={[0, layout.headerHeight, layout.width, layout.headerHeight]}
        stroke={tokens.grid.color}
        strokeWidth={tokens.grid.width}
        strokeEnabled={tokens.grid.style !== "none" && tokens.grid.width > 0}
        dash={gridDash}
        listening={false}
      />
      {layout.rowHeights.slice(0, -1).map((height, index) => {
        const y = layout.headerHeight + layout.rowHeights.slice(0, index + 1).reduce((sum, value) => sum + value, 0);
        return <Line key={`row-divider:${index}`} points={[0, y, layout.width, y]} stroke={tokens.grid.color} strokeWidth={tokens.grid.width} strokeEnabled={tokens.grid.style !== "none" && tokens.grid.width > 0} dash={gridDash} listening={false} />;
      })}
      {layout.columnBoundaries.slice(0, -1).map((x, index) => {
        const column = layout.headerCells[index];
        return (
          <Group
            key={`column-divider:${column.columnId}`}
            x={x}
            listening={interactive}
            draggable={interactive}
            onMouseDown={(event) => { event.cancelBubble = true; }}
            onDragStart={(event) => { event.cancelBubble = true; }}
            onDragMove={(event) => { event.cancelBubble = true; event.target.y(0); }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              const localX = event.target.x();
              event.target.x(x);
              event.target.y(0);
              onResizeColumn?.(column.columnId, layout.columnWidths[index] + localX - x);
            }}
          >
            <Rect x={-tokens.resizeHandleWidth / 2} width={tokens.resizeHandleWidth} height={layout.height} fill="rgba(0,0,0,0.001)" />
            <Line points={[0, 0, 0, layout.height]} stroke={tokens.grid.color} strokeWidth={tokens.grid.width} strokeEnabled={tokens.grid.style !== "none" && tokens.grid.width > 0} dash={gridDash} listening={false} />
          </Group>
        );
      })}
    </Group>
  );
}

export function CanvasTableNodePlaceholder({
  width,
  height,
  label,
  status = "loading",
  specialNode,
  typography
}: {
  width: number;
  height: number;
  label: string;
  status?: "loading" | "empty" | "error";
  specialNode: SpecialNodeThemeTokens;
  typography: TypographyRoleTokens;
}) {
  const tokens = specialNode.table;
  const statusText = status === "error" ? "CSV 读取失败" : status === "empty" ? "CSV 文件为空" : "正在加载 CSV…";
  const surfaceBorder = resolveSpecialNodeBorder(tokens.surface, tokens.state, status === "error" ? "error" : "normal");
  return (
    <Group listening={false}>
      <Rect
        width={width}
        height={height}
        fill={tokens.surface.background}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={tokens.surface.radius}
        shadowColor={tokens.surface.shadow.color}
        shadowBlur={tokens.surface.shadow.blur}
        shadowOpacity={tokens.surface.shadow.opacity}
        shadowOffsetX={tokens.surface.shadow.offsetX}
        shadowOffsetY={tokens.surface.shadow.offsetY}
      />
      <Text
        x={tokens.cellPaddingX}
        y={tokens.cellPaddingY}
        width={Math.max(0, width - tokens.cellPaddingX * 2)}
        height={typography.lineHeight}
        text={label || "CSV 表格"}
        fontFamily={typography.family}
        fontSize={typography.fontSize}
        fontStyle={String(typography.fontWeight)}
        lineHeight={typography.lineHeight / typography.fontSize}
        letterSpacing={typography.letterSpacing}
        fill={tokens.bodyTextColor}
        ellipsis
      />
      <Text
        x={tokens.cellPaddingX}
        y={tokens.cellPaddingY + typography.lineHeight + tokens.placeholderGap}
        width={Math.max(0, width - tokens.cellPaddingX * 2)}
        height={typography.lineHeight}
        text={statusText}
        fontFamily={typography.family}
        fontSize={typography.fontSize}
        fontStyle="normal"
        lineHeight={typography.lineHeight / typography.fontSize}
        letterSpacing={typography.letterSpacing}
        fill={status === "error" ? specialNode.shared.errorColor : specialNode.shared.mutedTextColor}
        ellipsis
      />
    </Group>
  );
}

function textProps(cell: TableCellGeometry | TableNodeLayout["headerCells"][number], typography: TypographyRoleTokens, fill: string) {
  return {
    x: cell.textBox.x,
    y: cell.textBox.y,
    width: cell.textBox.width,
    height: cell.textBox.height,
    text: cell.text,
    align: cell.align,
    verticalAlign: "middle" as const,
    fontFamily: typography.family,
    fontSize: typography.fontSize,
    fontStyle: String(typography.fontWeight),
    lineHeight: typography.lineHeight / typography.fontSize,
    letterSpacing: typography.letterSpacing,
    wrap: "word" as const,
    fill
  };
}

function sameCell(left: TableCellSelection | null, right: TableCellSelection) {
  return Boolean(left && left.nodeId === right.nodeId && left.rowId === right.rowId && left.columnId === right.columnId);
}
