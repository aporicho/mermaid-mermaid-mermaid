import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignHorizontalSpacing,
  AlignHorizontalCenters,
  AlignVerticalCenters,
  AlignVerticalSpacing,
  CompAlignBottom,
  CompAlignLeft,
  CompAlignRight,
  CompAlignTop
} from "iconoir-react/regular";

import { Separator } from "@/components/ui/separator";
import { EditorIconButton, EditorToolbar, EditorToolbarGroup } from "@/features/mermaid-editor/components/editor-ui";
import { selectionBounds, type AlignmentRect } from "@/features/mermaid-editor/lib/alignment-guides";
import {
  NODE_ALIGNMENT_OPERATIONS,
  NODE_SPACING_OPERATIONS,
  nodeArrangementLabel,
  type NodeArrangementOperation
} from "@/features/mermaid-editor/lib/node-arrangement";
import type { EditorMode, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-layers";

type ToolbarSize = { width: number; height: number };
type CanvasSize = { width: number; height: number };

const TOOLBAR_ESTIMATED_SIZE: ToolbarSize = { width: 280, height: 40 };
const TOOLBAR_MARGIN = 8;
const TOOLBAR_SELECTION_GAP = 10;

const ALIGNMENT_ICONS: Record<(typeof NODE_ALIGNMENT_OPERATIONS)[number], ReactNode> = {
  "align-left": <CompAlignLeft className="size-4" />,
  "align-horizontal-center": <AlignHorizontalCenters className="size-4" />,
  "align-right": <CompAlignRight className="size-4" />,
  "align-top": <CompAlignTop className="size-4" />,
  "align-vertical-center": <AlignVerticalCenters className="size-4" />,
  "align-bottom": <CompAlignBottom className="size-4" />
};

const SPACING_ICONS: Record<(typeof NODE_SPACING_OPERATIONS)[number], ReactNode> = {
  "distribute-horizontal-spacing": <AlignHorizontalSpacing className="size-4" />,
  "distribute-vertical-spacing": <AlignVerticalSpacing className="size-4" />
};

export function SelectionArrangementToolbar({
  rects,
  viewport,
  canvasSize,
  onArrange
}: {
  rects: AlignmentRect[];
  viewport: ViewportState;
  canvasSize: CanvasSize;
  onArrange: (operation: NodeArrangementOperation) => void;
}) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarSize, setToolbarSize] = useState(TOOLBAR_ESTIMATED_SIZE);
  const bounds = useMemo(() => selectionBounds(rects), [rects]);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return undefined;

    function measure() {
      const next = toolbar?.getBoundingClientRect();
      if (!next?.width || !next.height) return;
      setToolbarSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : { width: next.width, height: next.height }
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  if (!bounds) return null;

  const position = resolveSelectionToolbarPosition({
    selection: bounds,
    viewport,
    canvasSize,
    toolbarSize
  });
  const spacingDisabled = rects.length < 3;

  return (
    <EditorToolbar
      ref={toolbarRef}
      aria-label="节点排布"
      className="scrollbar-hidden absolute max-w-[calc(100%-16px)] overflow-x-auto text-foreground"
      style={{ left: position.left, top: position.top, zIndex: OVERLAY_Z_INDEX.workspaceBase }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      data-editor-floating-menu-ignore
      data-floating-panel-drag-exclude
    >
      <EditorToolbarGroup aria-label="对齐" className="shrink-0">
        {NODE_ALIGNMENT_OPERATIONS.map((operation) => (
          <ArrangementButton key={operation} operation={operation} onArrange={onArrange}>
            {ALIGNMENT_ICONS[operation]}
          </ArrangementButton>
        ))}
      </EditorToolbarGroup>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <EditorToolbarGroup aria-label="间距" className="shrink-0">
        {NODE_SPACING_OPERATIONS.map((operation) => (
          <ArrangementButton key={operation} operation={operation} disabled={spacingDisabled} onArrange={onArrange}>
            {SPACING_ICONS[operation]}
          </ArrangementButton>
        ))}
      </EditorToolbarGroup>
    </EditorToolbar>
  );
}

export function shouldShowSelectionArrangementToolbar(input: {
  selectedNodeCount: number;
  mode: EditorMode;
  manualLayout: boolean;
  interactionKind: string;
  inlineEditing: boolean;
  contextMenuOpen: boolean;
}) {
  return (
    input.selectedNodeCount >= 2 &&
    input.mode === "select" &&
    input.manualLayout &&
    input.interactionKind === "idle" &&
    !input.inlineEditing &&
    !input.contextMenuOpen
  );
}

export function resolveSelectionToolbarPosition({
  selection,
  viewport,
  canvasSize,
  toolbarSize,
  margin = TOOLBAR_MARGIN,
  gap = TOOLBAR_SELECTION_GAP
}: {
  selection: AlignmentRect;
  viewport: ViewportState;
  canvasSize: CanvasSize;
  toolbarSize: ToolbarSize;
  margin?: number;
  gap?: number;
}) {
  const screenLeft = viewport.x + selection.x * viewport.scale;
  const screenTop = viewport.y + selection.y * viewport.scale;
  const screenRight = screenLeft + selection.width * viewport.scale;
  const screenBottom = screenTop + selection.height * viewport.scale;
  const maxLeft = Math.max(margin, canvasSize.width - toolbarSize.width - margin);
  const left = clamp((screenLeft + screenRight - toolbarSize.width) / 2, margin, maxLeft);
  const above = screenTop - gap - toolbarSize.height;
  const below = screenBottom + gap;
  const fitsAbove = above >= margin;
  const fitsBelow = below + toolbarSize.height <= canvasSize.height - margin;
  const maxTop = Math.max(margin, canvasSize.height - toolbarSize.height - margin);
  const top = fitsAbove ? above : fitsBelow ? below : clamp(above, margin, maxTop);

  return { left, top, placement: fitsAbove ? "above" as const : fitsBelow ? "below" as const : "clamped" as const };
}

function ArrangementButton({
  operation,
  disabled,
  onArrange,
  children
}: {
  operation: NodeArrangementOperation;
  disabled?: boolean;
  onArrange: (operation: NodeArrangementOperation) => void;
  children: ReactNode;
}) {
  const label = nodeArrangementLabel(operation);

  return (
    <EditorIconButton
      type="button"
      context="toolbar"
      label={label}
      tooltipSide="top"
      disabled={disabled}
      onClick={() => onArrange(operation)}
    >
      {children}
    </EditorIconButton>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
