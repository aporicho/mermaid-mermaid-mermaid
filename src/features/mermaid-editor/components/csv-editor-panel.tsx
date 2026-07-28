import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FloppyDisk, Plus, Redo, Trash, Undo, WarningTriangle } from "iconoir-react/regular";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WorkspaceWindowHeader } from "@/features/mermaid-editor/components/floating-chrome";
import {
  csvColumnLabel,
  csvHasHeader,
  normalizeCsvRows,
  parseClipboardGrid,
  parseCsvDocument,
  serializeCsvDocument,
  type CsvDelimiter,
  type CsvHeaderMode
} from "@/features/mermaid-editor/lib/csv-document-model";

const ROW_HEIGHT = 40;
const COLUMN_WIDTH = 168;

type CellPoint = { row: number; column: number };

export function CsvEditorPanel({
  title,
  path,
  value,
  dirty,
  showHeader = true,
  headerMode,
  canUndo,
  canRedo,
  onHeaderModeChange,
  onChange,
  onSave,
  onUndo,
  onRedo
}: {
  title: string;
  path?: string;
  value: string;
  dirty: boolean;
  showHeader?: boolean;
  headerMode: CsvHeaderMode;
  canUndo?: boolean;
  canRedo?: boolean;
  onHeaderModeChange: (mode: CsvHeaderMode) => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const document = useMemo(() => parseCsvDocument(value), [value]);
  const hasHeader = csvHasHeader(document, headerMode);
  const [selected, setSelected] = useState<CellPoint>({ row: 0, column: 0 });
  const [anchor, setAnchor] = useState<CellPoint>({ row: 0, column: 0 });

  function commitRows(rows: string[][]) {
    onChange(serializeCsvDocument(normalizeCsvRows(rows), document.dialect));
  }

  function updateCell(rowIndex: number, columnIndex: number, nextValue: string) {
    const rows = document.rows.map((row) => [...row]);
    rows[rowIndex][columnIndex] = nextValue;
    commitRows(rows);
  }

  function addRow() {
    commitRows([...document.rows, Array.from({ length: document.rows[0]?.length || 1 }, () => "")]);
  }

  function addColumn() {
    commitRows(document.rows.map((row) => [...row, ""]));
  }

  function deleteSelectedRow() {
    const rows = document.rows.filter((_, index) => index !== selected.row);
    commitRows(rows.length ? rows : [[""]]);
    setSelected((current) => ({ ...current, row: Math.max(0, Math.min(current.row, rows.length - 1)) }));
  }

  function deleteSelectedColumn() {
    const rows = document.rows.map((row) => row.filter((_, index) => index !== selected.column));
    commitRows(rows[0]?.length ? rows : [[""]]);
    setSelected((current) => ({ ...current, column: Math.max(0, current.column - 1) }));
  }

  function setDelimiter(delimiter: CsvDelimiter) {
    onChange(serializeCsvDocument(document.rows, { ...document.dialect, delimiter }));
  }

  function handleShortcut(event: KeyboardEvent<HTMLElement>) {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;
    if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      event.stopPropagation();
      onSave();
    } else if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) onRedo();
      else onUndo();
    } else if (event.key.toLowerCase() === "y") {
      event.preventDefault();
      event.stopPropagation();
      onRedo();
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col" onKeyDownCapture={handleShortcut}>
      {showHeader ? <WorkspaceWindowHeader
        title={<span className="flex min-w-0 items-center gap-1" title={path || title}><span className="truncate">{title}</span>{dirty ? <span className="size-1.5 shrink-0 bg-foreground/60" aria-hidden /> : null}</span>}
        actions={<ButtonGroup>
          <Button variant="outline" size="icon-sm" aria-label="撤销" disabled={!canUndo} onClick={onUndo}><Undo data-icon="inline-start" /></Button>
          <Button variant="outline" size="icon-sm" aria-label="重做" disabled={!canRedo} onClick={onRedo}><Redo data-icon="inline-start" /></Button>
          <Button variant="outline" size="icon-sm" aria-label="保存 CSV" onClick={onSave}><FloppyDisk data-icon="inline-start" /></Button>
        </ButtonGroup>}
      /> : null}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" size="sm" value={headerMode} aria-label="CSV 表头模式" onValueChange={(mode) => { if (mode) onHeaderModeChange(mode as CsvHeaderMode); }}>
            <ToggleGroupItem value="auto">自动表头</ToggleGroupItem>
            <ToggleGroupItem value="header">有表头</ToggleGroupItem>
            <ToggleGroupItem value="none">无表头</ToggleGroupItem>
          </ToggleGroup>
          <Select value={document.dialect.delimiter} onValueChange={(value) => setDelimiter(value as CsvDelimiter)}>
            <SelectTrigger size="sm" aria-label="分隔符"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              <SelectItem value=",">逗号</SelectItem>
              <SelectItem value=";">分号</SelectItem>
              <SelectItem value="\t">制表符</SelectItem>
              <SelectItem value="|">竖线</SelectItem>
            </SelectGroup></SelectContent>
          </Select>
          <ButtonGroup>
            <Button variant="outline" size="sm" onClick={addRow}><Plus data-icon="inline-start" />行</Button>
            <Button variant="outline" size="sm" onClick={addColumn}><Plus data-icon="inline-start" />列</Button>
            <Button variant="outline" size="sm" onClick={deleteSelectedRow}><Trash data-icon="inline-start" />当前行</Button>
            <Button variant="outline" size="sm" onClick={deleteSelectedColumn}><Trash data-icon="inline-start" />当前列</Button>
          </ButtonGroup>
          <span className="ml-auto text-sm text-muted-foreground">{document.rows.length.toLocaleString()} 行 × {(document.rows[0]?.length || 0).toLocaleString()} 列</span>
        </div>
        {document.error ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Alert variant="destructive"><WarningTriangle data-icon="inline-start" /><AlertTitle>CSV 解析失败</AlertTitle><AlertDescription>{document.error.line}:{document.error.column} · {document.error.message}。可在下方修复源码。</AlertDescription></Alert>
            <Textarea className="min-h-0 flex-1 resize-none font-mono" aria-label="CSV 源码修复编辑器" value={value} onChange={(event) => onChange(event.target.value)} />
          </div>
        ) : (
          <CsvVirtualGrid
            rows={document.rows}
            hasHeader={hasHeader}
            selected={selected}
            anchor={anchor}
            onSelect={(point, extend) => { setSelected(point); if (!extend) setAnchor(point); }}
            onChange={updateCell}
            onCommitRows={commitRows}
          />
        )}
      </div>
    </section>
  );
}

function CsvVirtualGrid({ rows, hasHeader, selected, anchor, onSelect, onChange, onCommitRows }: {
  rows: string[][];
  hasHeader: boolean;
  selected: CellPoint;
  anchor: CellPoint;
  onSelect: (point: CellPoint, extend: boolean) => void;
  onChange: (row: number, column: number, value: string) => void;
  onCommitRows: (rows: string[][]) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const columnCount = rows[0]?.length || 1;
  const columns = useMemo(() => Array.from({ length: columnCount }, (_, index) => createColumnHelper<string[]>().accessor((row) => row[index] || "", { id: String(index) })), [columnCount]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const tableRows = table.getRowModel().rows;
  const rowOffset = hasHeader ? 1 : 0;
  const visibleTableRows = hasHeader ? tableRows.slice(1) : tableRows;
  const rowVirtualizer = useVirtualizer({ count: visibleTableRows.length, getScrollElement: () => scrollElement, estimateSize: () => ROW_HEIGHT, overscan: 8 });
  const columnVirtualizer = useVirtualizer({ horizontal: true, count: columnCount, getScrollElement: () => scrollElement, estimateSize: () => COLUMN_WIDTH, overscan: 3 });

  useEffect(() => {
    setScrollElement(hostRef.current?.querySelector<HTMLElement>("[data-slot=table-container]") || null);
  }, []);

  function selectionBounds() {
    return {
      top: Math.min(anchor.row, selected.row),
      bottom: Math.max(anchor.row, selected.row),
      left: Math.min(anchor.column, selected.column),
      right: Math.max(anchor.column, selected.column)
    };
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, start: CellPoint) {
    const pasted = parseClipboardGrid(event.clipboardData.getData("text/plain"));
    if (!pasted.length) return;
    event.preventDefault();
    const next = rows.map((row) => [...row]);
    const neededRows = start.row + pasted.length;
    const neededColumns = start.column + Math.max(...pasted.map((row) => row.length));
    while (next.length < neededRows) next.push(Array.from({ length: Math.max(columnCount, neededColumns) }, () => ""));
    for (const row of next) while (row.length < neededColumns) row.push("");
    pasted.forEach((row, rowOffset) => row.forEach((value, columnOffset) => { next[start.row + rowOffset][start.column + columnOffset] = value; }));
    onCommitRows(next);
  }

  async function copySelection() {
    const bounds = selectionBounds();
    const text = rows.slice(bounds.top, bounds.bottom + 1).map((row) => row.slice(bounds.left, bounds.right + 1).join("\t")).join("\n");
    await navigator.clipboard?.writeText(text);
  }

  function clearSelection() {
    const bounds = selectionBounds();
    const next = rows.map((row) => row.map((value, column) => column >= bounds.left && column <= bounds.right ? "" : value));
    for (let row = 0; row < next.length; row += 1) if (row < bounds.top || row > bounds.bottom) next[row] = [...rows[row]];
    onCommitRows(next);
  }

  function moveCell(event: KeyboardEvent<HTMLInputElement>, point: CellPoint) {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copySelection();
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      clearSelection();
      return;
    }
    let row = point.row;
    let column = point.column;
    if (event.key === "ArrowUp") row -= 1;
    else if (event.key === "ArrowDown" || event.key === "Enter") row += 1;
    else if (event.key === "ArrowLeft") column -= 1;
    else if (event.key === "ArrowRight") column += 1;
    else if (event.key === "Tab") column += event.shiftKey ? -1 : 1;
    else return;
    event.preventDefault();
    if (column < 0) { column = columnCount - 1; row -= 1; }
    if (column >= columnCount) { column = 0; row += 1; }
    const next = { row: Math.max(0, Math.min(rows.length - 1, row)), column: Math.max(0, Math.min(columnCount - 1, column)) };
    rowVirtualizer.scrollToIndex(Math.max(0, next.row - rowOffset));
    columnVirtualizer.scrollToIndex(next.column);
    onSelect(next, event.shiftKey);
    requestAnimationFrame(() => hostRef.current?.querySelector<HTMLInputElement>(`[data-csv-cell="${next.row}:${next.column}"]`)?.focus());
  }

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualColumns = columnVirtualizer.getVirtualItems();
  const bounds = selectionBounds();
  return (
    <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden rounded-lg border [&>[data-slot=table-container]]:h-full">
      <Table style={{ width: Math.max(scrollElement?.clientWidth || 0, columnCount * COLUMN_WIDTH), display: "grid" }}>
        <TableHeader className="sticky top-0 z-10 grid bg-background">
          <TableRow className="flex" style={{ width: columnVirtualizer.getTotalSize(), height: ROW_HEIGHT }}>
            {virtualColumns.map((virtualColumn) => (
              <TableHead key={virtualColumn.key} data-state={hasHeader && selected.row === 0 && selected.column === virtualColumn.index ? "selected" : undefined} className="absolute flex items-center p-0" style={{ width: virtualColumn.size, transform: `translateX(${virtualColumn.start}px)` }}>
                {hasHeader ? <Input data-csv-cell={`0:${virtualColumn.index}`} aria-label={`第 ${virtualColumn.index + 1} 列表头`} value={rows[0]?.[virtualColumn.index] || ""} placeholder={csvColumnLabel(virtualColumn.index)} onFocus={() => onSelect({ row: 0, column: virtualColumn.index }, false)} onPointerDown={(event) => onSelect({ row: 0, column: virtualColumn.index }, event.shiftKey)} onChange={(event) => onChange(0, virtualColumn.index, event.target.value)} onKeyDown={(event) => moveCell(event, { row: 0, column: virtualColumn.index })} onPaste={(event) => handlePaste(event, { row: 0, column: virtualColumn.index })} /> : <span className="px-2">{csvColumnLabel(virtualColumn.index)}</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="relative grid" style={{ height: rowVirtualizer.getTotalSize(), width: columnVirtualizer.getTotalSize() }}>
          {virtualRows.map((virtualRow) => {
            const row = visibleTableRows[virtualRow.index];
            return (
              <TableRow key={row.id} className="absolute flex" style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)`, width: columnVirtualizer.getTotalSize() }}>
                {virtualColumns.map((virtualColumn) => {
                  const point = { row: virtualRow.index + rowOffset, column: virtualColumn.index };
                  const active = point.row >= bounds.top && point.row <= bounds.bottom && point.column >= bounds.left && point.column <= bounds.right;
                  return (
                    <TableCell key={virtualColumn.key} className="absolute p-0" data-state={active ? "selected" : undefined} style={{ width: virtualColumn.size, transform: `translateX(${virtualColumn.start}px)` }}>
                      <Input
                        data-csv-cell={`${point.row}:${point.column}`}
                        aria-label={`第 ${point.row + 1} 行，第 ${point.column + 1} 列`}
                        value={rows[point.row]?.[point.column] || ""}
                        onFocus={() => onSelect(point, false)}
                        onPointerDown={(event) => onSelect(point, event.shiftKey)}
                        onChange={(event) => onChange(point.row, point.column, event.target.value)}
                        onKeyDown={(event) => moveCell(event, point)}
                        onPaste={(event) => handlePaste(event, point)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
