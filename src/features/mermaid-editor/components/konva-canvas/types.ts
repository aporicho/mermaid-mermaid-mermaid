import type { CanvasPoint } from "@/features/mermaid-editor/lib/canvas-interaction";
import type { DagreEdgeRoute } from "@/features/mermaid-editor/lib/canvas-auto-layout";
import type { CanvasVisualTokens } from "@/features/mermaid-editor/lib/canvas-visual-state";
import type { EditorThemeGeometryTokens } from "@/features/mermaid-editor/lib/editor-theme";
import type { RuntimeEditorMotion } from "@/features/mermaid-editor/lib/editor-motion";
import type { CanvasNode, EdgeRouting, EditorMode, LayoutMode, MermaidGraph, Selection, ViewportState } from "@/features/mermaid-editor/lib/editor-types";
import type { EditorCommand } from "@/features/mermaid-editor/lib/interaction/commands";
import type { ViewFilters } from "@/features/mermaid-editor/lib/view-filters";

export type ViewportCommandSource = Extract<EditorCommand, { type: "viewport.set" }>["source"];

export type ScheduledViewport = {
  viewport: ViewportState;
  source: ViewportCommandSource;
};

export type CanvasLiveState = {
  canvasSize?: { width: number; height: number };
  editing?: { kind: "node" | "subgraph" | "edge"; id: string; draftText: string } | null;
  interaction?: string;
};

export type CanvasNodeMotionVisual = {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  highlight: number;
};

export type CanvasEdgeMotionVisual = {
  highlight: number;
};

export type NodeProximityRuntime = {
  interactive: boolean;
  frames: { id: string; x: number; y: number; width: number; height: number }[];
  radiusPx: number;
  maxScale: number;
  durationMs: number;
};

export type SafariGestureEvent = Event & {
  scale?: number;
  clientX?: number;
  clientY?: number;
};

export type ScreenPointResolver = (clientX: number | undefined, clientY: number | undefined) => CanvasPoint | null;

export type KonvaCanvasProps = {
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  mode: EditorMode;
  panningRequested: boolean;
  viewFilters: ViewFilters;
  edgeRouting: EdgeRouting;
  mermaidEdgeRoutes?: DagreEdgeRoute[];
  layoutMode: LayoutMode;
  imageDisplaySrcBySrc?: Record<string, string>;
  visualTokens?: CanvasVisualTokens;
  geometryTokens?: EditorThemeGeometryTokens;
  motion?: RuntimeEditorMotion;
  onEditorCommand: (command: EditorCommand) => void;
  onOpenNodeAction?: (node: CanvasNode) => void;
  onEditNodeAction?: (node: CanvasNode) => void;
  onPointerWorldChange?: (point: CanvasPoint) => void;
  onLiveStateChange?: (state: CanvasLiveState) => void;
};
