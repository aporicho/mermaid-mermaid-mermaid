import type { RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EdgeLabelGeometryTokens } from "@/features/mermaid-editor/lib/edge-label-geometry";
import type { EditorTypographyTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { TypographyRoleTokens } from "@/features/mermaid-editor/lib/editor-theme";

export type InlineEdit =
  | { type: "node"; id: string; value: string }
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
  visualTokens,
  viewFilters,
  onChange,
  onCommit
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
  visualTokens: CanvasVisualTokens;
  viewFilters: ViewFilters;
  onChange: (next: InlineEdit) => void;
  onCommit: (save: boolean) => void;
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
          borderRadius: visualTokens.subgraph.titleCornerRadius * activeScale,
          fontFamily: typography.subgraphTitle.family,
          fontSize: typography.subgraphTitle.fontSize * activeScale,
          fontWeight: typography.subgraphTitle.fontWeight,
          letterSpacing: `${typography.subgraphTitle.letterSpacing * activeScale}px`,
          lineHeight: `${editStyle.height}px`,
          paddingLeft: visualTokens.subgraph.titleInsetX * activeScale,
          paddingRight: visualTokens.subgraph.titleInsetX * activeScale
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
          borderRadius: visualTokens.edge.labelCornerRadius * activeScale,
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
