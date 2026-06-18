import type { FlowchartNodeShape } from "@/features/mermaid-editor/lib/flowchart-shapes";

export type { FlowchartNodeShape } from "@/features/mermaid-editor/lib/flowchart-shapes";

export type GraphDirection = "TD" | "TB" | "BT" | "RL" | "LR";

export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "state"
  | "er"
  | "gantt"
  | "pie"
  | "mindmap"
  | "timeline"
  | "architecture"
  | "unknown";

export type EditableKind = "flowchart" | "render-only";
export type ParseStatus = "parsed" | "render-only";

export type CanvasNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  fill: string;
  shape?: FlowchartNodeShape;
  asset?: CanvasNodeAsset;
};

export type ImageLabelPosition = "top" | "bottom";

export type CanvasNodeAsset = {
  kind: "image";
  src: string;
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  labelPosition: ImageLabelPosition;
};

export type EdgeStyle = "solid" | "thick" | "dotted";
export type FlowchartArrowType = "arrow" | "none" | "circle" | "cross";
export type EdgeRouting = "straight" | "bezier" | "orthogonal" | "mermaid";
export type LegacyEdgePath = "straight" | "curved" | "orthogonal";
export type LayoutMode = "manual" | "auto";

export const DEFAULT_EDGE_ROUTING: EdgeRouting = "bezier";
export const DEFAULT_LAYOUT_MODE: LayoutMode = "manual";

export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  style: EdgeStyle;
  arrowType?: FlowchartArrowType;
};

export type CanvasSubgraph = {
  id: string;
  title: string;
  nodeIds: string[];
  parentId?: string;
  direction?: GraphDirection;
};

export type MermaidGraph = {
  diagramType?: DiagramType;
  editableKind?: EditableKind;
  parseStatus?: ParseStatus;
  direction: GraphDirection;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  subgraphs?: CanvasSubgraph[];
  preservedStatements?: string[];
  frontmatter?: string;
};

export type EditorMode = "select" | "connect";

export type Selection = {
  nodeIds: string[];
  edgeIds: string[];
  subgraphIds?: string[];
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

export type CanvasLayoutTheme = {
  themeId?: string;
  customTheme?: unknown | null;
};

export type CanvasLayout = {
  version: 1;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  theme?: CanvasLayoutTheme;
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
  layoutMode: LayoutMode;
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
