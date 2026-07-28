import { Group, Line, Rect, Text } from "react-konva";

import type { SpecialNodeThemeTokens, TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import { resolveSpecialNodeBorder, specialNodeBorderDash } from "@/features/mermaid-editor/lib/editor-theme/special-node-theme";
import type { SpecialNodeVisualState } from "@/features/mermaid-editor/lib/editor-theme/special-node-types";
import type { TableCellGeometry, TableCellSelection, TableHeaderSelection, TableNodeLayout } from "@/features/mermaid-editor/lib/table-node";
import { CanvasStaticCacheGroup, canvasStaticCacheKey } from "@/features/mermaid-editor/components/konva-canvas/canvas-static-cache-group";

export function CanvasTableNode({
  nodeId,
  layout,
  selectedCell,
  hoveredCell,
  specialNode,
  typography,
  editing,
  editingHeader,
  visualState,
  fontRevision,
  cacheEnabled = true
}: {
  nodeId: string;
  layout: TableNodeLayout;
  selectedCell: TableCellSelection | null;
  hoveredCell: TableCellSelection | null;
  specialNode: SpecialNodeThemeTokens;
  typography: TypographyRoleTokens;
  editing: TableCellSelection | null;
  editingHeader: TableHeaderSelection | null;
  visualState?: SpecialNodeVisualState;
  fontRevision: number;
  cacheEnabled?: boolean;
}) {
  const tokens = specialNode.table;
  const effectiveVisualState = visualState ?? (editing || editingHeader ? "editing" : selectedCell ? "selected" : "normal");
  const surfaceBorder = resolveSpecialNodeBorder(tokens.surface, tokens.state, effectiveVisualState);
  const gridDash = specialNodeBorderDash(tokens.grid);
  return (
    <Group listening={false}>
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:table-background`}
        cacheKey={canvasStaticCacheKey(layout, tokens.surface, tokens.headerBackground, tokens.grid)}
        cacheKind="table"
        cacheEnabled={cacheEnabled}
        cachePriority={5}
      >
        <Rect
          width={layout.width}
          height={layout.height}
          fill={tokens.surface.background}
          cornerRadius={tokens.surface.radius}
          shadowColor={tokens.surface.shadow.color}
          shadowBlur={tokens.surface.shadow.blur}
          shadowOpacity={tokens.surface.shadow.opacity}
          shadowOffsetX={tokens.surface.shadow.offsetX}
          shadowOffsetY={tokens.surface.shadow.offsetY}
          listening={false}
        />
        {layout.headerCells.map((cell) => (
          <Rect key={`header-background:${cell.columnId}`} {...cell.frame} fill={tokens.headerBackground} listening={false} />
        ))}
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
      </CanvasStaticCacheGroup>
      {layout.headerCells.map((cell) => (
        <Group
          key={`header:${cell.columnId}`}
          listening={false}
        >
          <Rect {...cell.frame} fill="rgba(0,0,0,0.001)" listening={false} />
        </Group>
      ))}
       {layout.cells.map((cell) => {
         const selection = { nodeId, rowId: cell.rowId, columnId: cell.columnId };
         const selected = sameCell(selectedCell, selection);
         const hovered = sameCell(hoveredCell, selection);
         const selectedCellBorder = tokens.selectedCellBorder;
        return (
          <Group
            key={`${cell.rowId}:${cell.columnId}`}
            listening={false}
          >
            <Rect
              {...cell.frame}
               fill={selected ? tokens.selectedCellBackground : hovered ? tokens.hoverCellBackground : "rgba(0,0,0,0.001)"}
              stroke={selected ? selectedCellBorder.color : undefined}
              strokeWidth={selected ? selectedCellBorder.width : 0}
              strokeEnabled={selected && selectedCellBorder.style !== "none" && selectedCellBorder.width > 0}
              dash={selected ? specialNodeBorderDash(selectedCellBorder) : undefined}
            />
          </Group>
        );
      })}
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:table-text`}
        cacheKey={canvasStaticCacheKey(layout, typography, tokens.headerTextColor, tokens.bodyTextColor, fontRevision)}
        cacheKind="table"
        cacheEnabled={cacheEnabled && !editing && !editingHeader}
        cachePriority={7}
      >
        {layout.headerCells.map((cell) => (
          <Text
            key={`header-text:${cell.columnId}`}
            {...textProps(cell, typography, tokens.headerTextColor)}
            fontStyle={String(typography.fontWeight)}
            visible={!(editingHeader?.nodeId === nodeId && editingHeader.columnId === cell.columnId)}
            listening={false}
          />
        ))}
        {layout.cells.map((cell) => {
          const selection = { nodeId, rowId: cell.rowId, columnId: cell.columnId };
          return <Text key={`cell-text:${cell.rowId}:${cell.columnId}`} {...textProps(cell, typography, tokens.bodyTextColor)} visible={!sameCell(editing, selection)} listening={false} />;
        })}
      </CanvasStaticCacheGroup>
      <Rect
        width={layout.width}
        height={layout.height}
        fillEnabled={false}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={tokens.surface.radius}
        listening={false}
      />
      {layout.columnBoundaries.slice(0, -1).map((x, index) => {
        const column = layout.headerCells[index];
        return (
          <Group
            key={`column-divider:${column.columnId}`}
            x={x}
            listening={false}
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
  nodeId,
  width,
  height,
  label,
  status = "loading",
  specialNode,
  typography,
  fontRevision,
  cacheEnabled = true
}: {
  nodeId: string;
  width: number;
  height: number;
  label: string;
  status?: "loading" | "empty" | "error";
  specialNode: SpecialNodeThemeTokens;
  typography: TypographyRoleTokens;
  fontRevision: number;
  cacheEnabled?: boolean;
}) {
  const tokens = specialNode.table;
  const statusText = status === "error" ? "CSV 读取失败" : status === "empty" ? "CSV 文件为空" : "正在加载 CSV…";
  const surfaceBorder = resolveSpecialNodeBorder(tokens.surface, tokens.state, status === "error" ? "error" : "normal");
  return (
    <Group listening={false}>
      <CanvasStaticCacheGroup
        cacheId={`${nodeId}:table-placeholder`}
        cacheKey={canvasStaticCacheKey(width, height, label, status, tokens, typography, fontRevision)}
        cacheKind="table"
        cacheEnabled={cacheEnabled}
        cachePriority={4}
      >
        <Rect
          width={width}
          height={height}
          fill={tokens.surface.background}
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
      </CanvasStaticCacheGroup>
      <Rect
        width={width}
        height={height}
        fillEnabled={false}
        stroke={surfaceBorder.color}
        strokeWidth={surfaceBorder.width}
        strokeEnabled={surfaceBorder.style !== "none" && surfaceBorder.width > 0}
        dash={specialNodeBorderDash(surfaceBorder)}
        cornerRadius={tokens.surface.radius}
        listening={false}
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
