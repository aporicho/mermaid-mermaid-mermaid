import type {
  CanvasEdge,
  CanvasNode,
  CanvasSubgraph,
  EdgeAnimation,
  EdgeMarker,
  EdgeRouting,
  EdgeStyle,
  FlowchartArrowType,
  GraphDirection,
  LayoutMode,
  MermaidCurve,
  MermaidGraph,
  ViewportState
} from "@/features/mermaid-editor/lib/editor-types";
import type { EditorDiagnostic } from "@/features/mermaid-editor/lib/editor-diagnostics";

export const DEFAULT_VIEWPORT: ViewportState = { x: 160, y: 90, scale: 1 };

export type ImageAssetPatch = {
  kind?: "image";
  src: string;
  width?: number;
  height?: number;
  preserveAspectRatio?: boolean;
  labelPosition?: "top" | "bottom";
};

export type PatchOperation =
  | {
      type: "addNode";
      id?: string;
      label?: string;
      x?: number;
      y?: number;
      fill?: string;
      shape?: string;
      asset?: ImageAssetPatch;
      imageSrc?: string;
      parentId?: string;
    }
  | {
      type: "updateNode";
      id: string;
      label?: string;
      x?: number;
      y?: number;
      fill?: string;
      shape?: string;
      asset?: ImageAssetPatch | null;
      imageSrc?: string | null;
      parentId?: string | null;
    }
  | { type: "deleteNode"; id: string }
  | {
      type: "addEdge";
      id?: string;
      from: string;
      to: string;
      label?: string;
      style?: EdgeStyle;
      arrowType?: FlowchartArrowType;
      markerStart?: EdgeMarker;
      markerEnd?: EdgeMarker;
      minLength?: number;
      mermaidId?: string;
      animation?: EdgeAnimation;
      curve?: MermaidCurve;
      classes?: string[];
      styleText?: string;
      fromAnchor?: string;
      toAnchor?: string;
    }
  | {
      type: "updateEdge";
      id: string;
      from?: string;
      to?: string;
      label?: string;
      style?: EdgeStyle;
      arrowType?: FlowchartArrowType;
      markerStart?: EdgeMarker;
      markerEnd?: EdgeMarker;
      minLength?: number;
      mermaidId?: string | null;
      animation?: EdgeAnimation;
      curve?: MermaidCurve | null;
      classes?: string[];
      styleText?: string | null;
      fromAnchor?: string | null;
      toAnchor?: string | null;
    }
  | { type: "deleteEdge"; id: string }
  | {
      type: "createSubgraph";
      id: string;
      title?: string;
      nodeIds?: string[];
      parentId?: string;
      direction?: GraphDirection;
    }
  | {
      type: "updateSubgraph";
      id: string;
      title?: string;
      nodeIds?: string[];
      parentId?: string | null;
      direction?: GraphDirection | null;
    }
  | { type: "deleteSubgraph"; id: string }
  | {
      type: "setGraph";
      direction?: GraphDirection;
      edgeRouting?: EdgeRouting;
      layoutMode?: LayoutMode;
      viewport?: ViewportState;
    };

export type PatchInput = PatchOperation[] | { ops?: PatchOperation[] };

export type GraphSummary = {
  direction: GraphDirection;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  subgraphs: CanvasSubgraph[];
  preservedStatementsCount: number;
};

export type DiffChange = {
  type: "added" | "removed" | "updated";
  id: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

export type DiffResult = {
  hasChanges: boolean;
  semanticChanges: Record<string, DiffChange[]>;
  layoutChanges: Record<string, DiffChange[]>;
  metadataChanges: Record<string, DiffChange[]>;
};

export type MermaidPatchResult = {
  source: string;
  changed: boolean;
  written: boolean;
  diff: DiffResult;
  graph: GraphSummary;
};

export type MermaidPatchEnvelope = {
  ok: boolean;
  result?: MermaidPatchResult;
  diagnostics: EditorDiagnostic[];
};

export type PatchState = {
  viewport: ViewportState;
  edgeRouting: EdgeRouting;
  layoutMode: LayoutMode;
};

export type PatchOperationResult = {
  graph?: MermaidGraph;
  viewport?: ViewportState;
  edgeRouting?: EdgeRouting;
  layoutMode?: LayoutMode;
  diagnostic?: EditorDiagnostic;
};
