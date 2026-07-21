import type { RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { CanvasTableAlign } from "@/features/mermaid-editor/lib/editor-types";
import type { SpecialNodeTableTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { TableCellNavigation } from "@/features/mermaid-editor/lib/table-node";
import { MAX_CANVAS_TABLE_CELL_LENGTH, MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH } from "@/features/mermaid-editor/lib/canvas-table-content";

export type InlineEdit =
  | { type: "node"; id: string; value: string }
  | { type: "tableCell"; id: string; rowId: string; columnId: string; value: string; align: CanvasTableAlign }
  | { type: "tableHeader"; id: string; columnId: string; value: string; align: CanvasTableAlign }
  | { type: "subgraph"; id: string; value: string }
  | { type: "edge"; id: string; value: string };

export type InlineEditStyle = {
  left: number;
  top: number;
  width: number;
  height: number;
  textScale: number;
};

export function InlineEditOverlays({
  inlineEdit,
  editStyle,
  activeScale,
  nodeEditorLayout,
  nodeEditorRef,
  nodeEditorMeasureRef,
  edgeLabelThemeTokens,
  typography,
  nodeEditorTypography,
  tableEditorTypography,
  tableTokens,
  visualTokens,
  viewFilters,
  onChange,
  onCommit,
  onTablePaste
}: {
  inlineEdit: InlineEdit | null;
  editStyle: InlineEditStyle | null;
  activeScale: number;
  nodeEditorLayout: { insetTop: number; height: number; scrollable: boolean };
  nodeEditorRef: RefObject<HTMLTextAreaElement | null>;
  nodeEditorMeasureRef: RefObject<HTMLDivElement | null>;
  edgeLabelThemeTokens: EdgeLabelGeometryTokens;
  typography: EditorTypographyTokens["canvas"];
  nodeEditorTypography: TypographyRoleTokens;
  tableEditorTypography: TypographyRoleTokens;
  tableTokens: SpecialNodeTableTokens;
  visualTokens: CanvasVisualTokens;
  viewFilters: ViewFilters;
  onChange: (next: InlineEdit) => void;
  onCommit: (save: boolean, navigation?: TableCellNavigation) => void;
  onTablePaste: (text: string) => void;
}) {
  if (!inlineEdit || !editStyle) return null;

  if (inlineEdit.type === "node") {
    return (
      <>
        <div
          ref={nodeEditorMeasureRef}
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] top-0 whitespace-pre-wrap text-center font-bold"
          style={{
            width: editStyle.width,
            fontFamily: nodeEditorTypography.family,
            fontSize: nodeEditorTypography.fontSize * editStyle.textScale,
            fontWeight: nodeEditorTypography.fontWeight,
            lineHeight: `${nodeEditorTypography.lineHeight * editStyle.textScale}px`,
            letterSpacing: `${nodeEditorTypography.letterSpacing * editStyle.textScale}px`,
            overflowWrap: "break-word",
            wordBreak: "break-word",
            visibility: "hidden"
          }}
        >
          {inlineEdit.value || "\u200b"}
        </div>
        <Textarea
          ref={nodeEditorRef}
          value={inlineEdit.value}
          className="node-inline-editor absolute z-40 block min-h-0 resize-none overflow-x-hidden rounded-none border-0 bg-transparent p-0 text-center font-bold text-foreground shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            left: editStyle.left,
            top: editStyle.top + nodeEditorLayout.insetTop,
            width: editStyle.width,
            height: nodeEditorLayout.height,
            fontFamily: nodeEditorTypography.family,
            fontSize: nodeEditorTypography.fontSize * editStyle.textScale,
            fontWeight: nodeEditorTypography.fontWeight,
            lineHeight: `${nodeEditorTypography.lineHeight * editStyle.textScale}px`,
            letterSpacing: `${nodeEditorTypography.letterSpacing * editStyle.textScale}px`,
            overflowWrap: "break-word",
            wordBreak: "break-word",
            overflowY: nodeEditorLayout.scrollable ? "auto" : "hidden"
          }}
          onChange={(event) => onChange({ ...inlineEdit, value: event.target.value })}
          onBlur={() => onCommit(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onCommit(true);
            }
            if (event.key === "Escape") onCommit(false);
          }}
        />
      </>
    );
  }

  if (inlineEdit.type === "tableCell" || inlineEdit.type === "tableHeader") {
    return (
      <Textarea
        autoFocus
        aria-label={inlineEdit.type === "tableCell" ? "编辑表格单元格" : "编辑表头"}
        maxLength={inlineEdit.type === "tableCell" ? MAX_CANVAS_TABLE_CELL_LENGTH : MAX_CANVAS_TABLE_COLUMN_LABEL_LENGTH}
        value={inlineEdit.value}
        className="absolute z-40 block min-h-0 resize-none rounded-none bg-card text-foreground shadow-none outline-none ring-0 focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-0"
        style={{
          left: editStyle.left,
          top: editStyle.top,
          width: editStyle.width,
          height: editStyle.height,
          borderColor: tableTokens.selectedCellBorder.color,
          borderWidth: tableTokens.selectedCellBorder.width,
          borderStyle: inlineCanvasBorderStyle(tableTokens.selectedCellBorder.style),
          backgroundColor: tableTokens.surface.background,
          paddingLeft: tableTokens.cellPaddingX * activeScale,
          paddingRight: tableTokens.cellPaddingX * activeScale,
          paddingTop: tableTokens.cellPaddingY * activeScale,
          paddingBottom: tableTokens.cellPaddingY * activeScale,
          textAlign: inlineEdit.align,
          fontFamily: tableEditorTypography.family,
          fontSize: tableEditorTypography.fontSize * editStyle.textScale,
          fontWeight: tableEditorTypography.fontWeight,
          lineHeight: `${tableEditorTypography.lineHeight * editStyle.textScale}px`,
          letterSpacing: `${tableEditorTypography.letterSpacing * editStyle.textScale}px`
        }}
        onChange={(event) => onChange({ ...inlineEdit, value: event.target.value })}
        onBlur={() => onCommit(true)}
        onPaste={(event) => {
          if (inlineEdit.type !== "tableCell") return;
          const text = event.clipboardData.getData("text/plain");
          if (!text.includes("\t") && !/[\r\n]/.test(text)) return;
          event.preventDefault();
          onTablePaste(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCommit(false);
            return;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            onCommit(true, inlineEdit.type === "tableCell" ? (event.shiftKey ? "previous" : "next") : undefined);
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onCommit(true, "down");
          }
        }}
      />
    );
  }

  if (inlineEdit.type === "subgraph" && viewFilters.subgraphs) {
    return (
      <Input
        autoFocus
        value={inlineEdit.value}
        className="absolute z-40 h-auto min-h-0 border bg-card py-0 text-left font-bold text-foreground shadow-sm outline-none ring-0 focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-0"
        style={{
          left: editStyle.left,
          top: editStyle.top,
          width: editStyle.width,
          height: editStyle.height,
          borderRadius: visualTokens.group.title.radius * activeScale,
          fontFamily: typography.subgraphTitle.family,
          fontSize: typography.subgraphTitle.fontSize * activeScale,
          fontWeight: typography.subgraphTitle.fontWeight,
          letterSpacing: `${typography.subgraphTitle.letterSpacing * activeScale}px`,
          lineHeight: `${editStyle.height}px`,
          paddingLeft: visualTokens.group.title.paddingX * activeScale,
          paddingRight: visualTokens.group.title.paddingX * activeScale
        }}
        onChange={(event) => onChange({ ...inlineEdit, value: event.target.value })}
        onBlur={() => onCommit(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(true);
          if (event.key === "Escape") onCommit(false);
        }}
      />
    );
  }

  if (inlineEdit.type === "edge" && viewFilters.edges && viewFilters.edgeLabels) {
    return (
      <Input
        autoFocus
        value={inlineEdit.value}
        className="absolute z-40 h-auto min-h-0 rounded-none border bg-card p-0 text-center font-normal text-foreground shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{
          left: editStyle.left,
          top: editStyle.top,
          width: editStyle.width,
          height: editStyle.height,
          borderRadius: visualTokens.edgeLabel.radius * activeScale,
          fontFamily: typography.edgeEditor.family,
          fontSize: typography.edgeEditor.fontSize * activeScale,
          fontWeight: typography.edgeEditor.fontWeight,
          lineHeight: `${typography.edgeEditor.lineHeight * activeScale}px`,
          letterSpacing: `${typography.edgeEditor.letterSpacing * activeScale}px`,
          paddingLeft: edgeLabelThemeTokens.paddingX * activeScale,
          paddingRight: edgeLabelThemeTokens.paddingX * activeScale
        }}
        onChange={(event) => onChange({ ...inlineEdit, value: event.target.value })}
        onBlur={() => onCommit(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(true);
          if (event.key === "Escape") onCommit(false);
        }}
      />
    );
  }

  return null;
}

function inlineCanvasBorderStyle(style: "none" | "solid" | "dashed" | "dotted" | "dash-dot" | "custom") {
  if (style === "none" || style === "dashed" || style === "dotted") return style;
  return "solid";
}
