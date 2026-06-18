import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeAsset,
  CanvasSubgraph,
  ClipboardPayload,
  EdgeRouting,
  EditorMode,
  FlowchartArrowType,
  FlowchartNodeShape,
  GraphDirection,
  LayoutMode,
  MermaidGraph,
  Selection,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";
import type { InteractionIntent } from "@/features/mermaid-editor/lib/interaction/intent";

export type EditorCommandSource = "pointer" | "wheel" | "gesture" | "keyboard" | "menu" | "api";
export type UiCommandSource = Extract<EditorCommandSource, "keyboard" | "menu" | "api">;
export type GraphCommandSource = Extract<EditorCommandSource, "pointer" | "keyboard" | "menu" | "api">;

export type EditorCommand =
  | { type: "mode.set"; mode: EditorMode; source: UiCommandSource }
  | { type: "viewport.set"; viewport: ViewportState; source: Extract<EditorCommandSource, "pointer" | "wheel" | "gesture" | "keyboard" | "menu" | "api"> }
  | { type: "selection.set"; selection: Selection; source: Extract<EditorCommandSource, "pointer" | "keyboard" | "menu" | "api"> }
  | { type: "selection.clear"; source: Extract<EditorCommandSource, "pointer" | "keyboard" | "menu" | "api"> }
  | { type: "viewFilters.set"; filters: ViewFilters; message: string; source: "menu" | "api" }
  | { type: "viewFilters.reset"; message?: string; source: "menu" | "api" }
  | { type: "history.capture"; source: Extract<EditorCommandSource, "pointer" | "keyboard" | "menu" | "api"> }
  | { type: "history.undo"; source: UiCommandSource }
  | { type: "history.redo"; source: UiCommandSource }
  | { type: "clipboard.copy"; source: UiCommandSource }
  | { type: "graph.addNodeAtViewportCenter"; message?: string; source: GraphCommandSource }
  | { type: "graph.addNodeAt"; point: { x: number; y: number; parentId?: string }; message?: string; source: GraphCommandSource }
  | { type: "graph.addImageNodeAt"; point: { x: number; y: number; parentId?: string }; asset: CanvasNodeAsset; label?: string; message?: string; source: GraphCommandSource }
  | { type: "graph.createSubgraphFromSelection"; source: GraphCommandSource }
  | { type: "graph.deleteSelection"; source: GraphCommandSource }
  | { type: "graph.pasteClipboard"; payload: ClipboardPayload; source: GraphCommandSource }
  | { type: "graph.setDirection"; direction: GraphDirection; source: GraphCommandSource }
  | { type: "graph.createEdge"; fromId: string; toId: string; message?: string; source: Extract<EditorCommandSource, "pointer" | "menu" | "api"> }
  | { type: "graph.retargetEdge"; edgeId: string; side: "from" | "to"; targetId: string; message?: string; source: Extract<EditorCommandSource, "pointer" | "menu" | "api"> }
  | { type: "graph.renameNode"; nodeId: string; value: string; source: GraphCommandSource }
  | { type: "graph.renameSubgraph"; subgraphId: string; value: string; source: GraphCommandSource }
  | { type: "graph.updateNode"; nodeId: string; patch: Partial<Pick<CanvasNode, "label" | "fill" | "shape" | "asset">>; message?: string; source: GraphCommandSource }
  | { type: "graph.updateNodeFill"; nodeIds: string[]; fill: string; source: GraphCommandSource }
  | { type: "graph.updateEdge"; edgeId: string; patch: Partial<Pick<CanvasEdge, "from" | "to" | "label" | "style" | "arrowType">>; message?: string; source: GraphCommandSource }
  | { type: "graph.updateSubgraph"; subgraphId: string; patch: Partial<Pick<CanvasSubgraph, "title" | "parentId" | "direction">>; message?: string; source: GraphCommandSource }
  | { type: "graph.updateNodeLabel"; nodeId: string; label: string; message?: string; source: GraphCommandSource }
  | { type: "graph.updateEdgeLabel"; edgeId: string; label: string; message?: string; source: GraphCommandSource }
  | { type: "graph.draftNodePositions"; positions: Record<string, { x: number; y: number }>; message?: string; syncSource?: boolean; source: Extract<EditorCommandSource, "pointer" | "api"> }
  | { type: "graph.commitDragMembership"; graph: MermaidGraph; message?: string; source: Extract<EditorCommandSource, "pointer" | "api"> }
  | { type: "edgeRouting.set"; edgeRouting: EdgeRouting; source: UiCommandSource }
  | { type: "layoutMode.set"; layoutMode: LayoutMode; source: UiCommandSource }
  | { type: "source.refreshGraph"; source: UiCommandSource }
  | { type: "layout.syncAuto"; source: UiCommandSource };

export type NodeShapePatch = FlowchartNodeShape;
export type EdgeArrowPatch = FlowchartArrowType;

export function commandFromInteractionIntent(intent: InteractionIntent): EditorCommand | null {
  if (intent.kind === "view" && (intent.action === "pan" || intent.action === "zoom")) {
    return {
      type: "viewport.set",
      viewport: intent.viewport,
      source: intent.source
    };
  }

  if (intent.kind === "filter") {
    return {
      type: "viewFilters.set",
      filters: intent.filters,
      message: intent.message,
      source: "menu"
    };
  }

  return null;
}
