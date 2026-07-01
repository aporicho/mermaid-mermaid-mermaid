import type {
  CanvasNodeAction,
  CanvasNodeAsset,
  EdgeMarker,
  EdgeStyle,
  FlowchartNodeShape
} from "@/features/mermaid-editor/lib/editor-types";

export type ParsedNodeToken = {
  id: string;
  label: string;
  shape: FlowchartNodeShape;
  asset?: CanvasNodeAsset;
  hasShape: boolean;
};

export type ParsedEdgeStatement = {
  left: ParsedNodeToken;
  right: ParsedNodeToken;
  label: string;
  operator: ParsedEdgeOperator;
};

export type PendingEdgeStatement = ParsedEdgeStatement & {
  parentId?: string;
};

export type ParsedEdgeOperator = {
  raw: string;
  style: EdgeStyle;
  markerStart: EdgeMarker;
  markerEnd: EdgeMarker;
  minLength: number;
  mermaidId?: string;
};

export type PendingEdgeProperty = {
  mermaidId: string;
  fields: Map<string, string>;
  raw: string;
};

export type PendingLinkStyle = {
  targets: "default" | number[];
  styleText: string;
  raw: string;
};

export type PendingClassStatement = {
  ids: string[];
  classes: string[];
  raw: string;
};

export type PendingNodeActionStatement = {
  nodeId: string;
  action: CanvasNodeAction;
};
