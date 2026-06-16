export type GraphDirection = "TD" | "TB" | "BT" | "RL" | "LR";

export type CanvasNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  fill: string;
};

export type EdgeStyle = "solid" | "thick" | "dotted";
export type EdgeRouting = "straight" | "bezier";
export type LegacyEdgePath = "straight" | "curved" | "orthogonal";

export const DEFAULT_EDGE_ROUTING: EdgeRouting = "bezier";

export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  style: EdgeStyle;
};

export type MermaidGraph = {
  direction: GraphDirection;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type EditorMode = "select" | "connect" | "pan";

export type Selection = {
  nodeIds: string[];
  edgeIds: string[];
  primaryId?: string;
};

export type ViewportState = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasLayoutNode = {
  x: number;
  y: number;
  fill: string;
};

export type CanvasLayoutEdge = {
  path?: LegacyEdgePath;
};

export type CanvasLayout = {
  version: 1;
  edgeRouting?: EdgeRouting;
  nodes: Record<string, CanvasLayoutNode>;
  edges?: Record<string, CanvasLayoutEdge>;
  viewport: ViewportState;
};

export type ClipboardPayload = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type EditorSnapshot = {
  source: string;
  graph: MermaidGraph;
  selection: Selection;
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
};

export type EditorHistory = {
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
};

export type EditorState = EditorSnapshot & {
  layout: CanvasLayout;
  mode: EditorMode;
  history: EditorHistory;
};
