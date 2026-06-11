export type GraphDirection = "TD" | "TB" | "BT" | "RL" | "LR";

export type CanvasNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  fill: string;
};

export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
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

export type CanvasLayout = {
  version: 1;
  nodes: Record<string, CanvasLayoutNode>;
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
