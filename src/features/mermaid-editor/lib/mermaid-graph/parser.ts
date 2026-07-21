import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeAsset,
  CanvasNodePreview,
  CanvasSubgraph,
  DiagramType,
  EditableKind,
  EdgeMarker,
  EdgeStyle,
  FlowchartNodeShape,
  GraphDirection,
  MermaidGraph
} from "@/features/mermaid-editor/lib/editor-types";
import { DEFAULT_FLOWCHART_NODE_SHAPE } from "@/features/mermaid-editor/lib/flowchart-shapes";
import { csvTableDocumentReferenceKey, isCsvTableFilePath } from "@/features/mermaid-editor/lib/csv-table-document";

import { NODE_COLORS } from "./constants";
import {
  applyEdgeMetadata,
  edgeMarkerEnd,
  edgeMarkerStart,
  parseClassStatement,
  parseEdgePropertyStatement,
  parseEdgeStatements,
  parseLinkStyleStatement
} from "./edge-token";
import { parseNodeActionStatement } from "./node-action-token";
import { parseNodeToken } from "./node-token";
import {
  assignNodeToSubgraph,
  endpointKind,
  isGraphDirection,
  parseSubgraphHeader
} from "./subgraph";
import { FLOWCHART_LINE_PATTERN } from "./syntax";
import type {
  PendingClassStatement,
  PendingEdgeProperty,
  PendingEdgeStatement,
  PendingLinkStyle,
  PendingNodeActionStatement
} from "./types";

export function parseMermaid(source: string, previous?: MermaidGraph): MermaidGraph {
  const { frontmatter, bodyLines } = extractFrontmatter(source);
  const diagramType = detectDiagramType(source);
  const editableKind = editableKindFromDiagramType(diagramType);
  if (editableKind !== "flowchart") {
    return emptyGraph({
      diagramType,
      editableKind,
      parseStatus: "render-only",
      frontmatter
    });
  }
  const nodes = new Map<string, CanvasNode>();
  const pendingEdges: PendingEdgeStatement[] = [];
  const pendingEdgeProperties: PendingEdgeProperty[] = [];
  const pendingLinkStyles: PendingLinkStyle[] = [];
  const pendingClassStatements: PendingClassStatement[] = [];
  const pendingNodeActions = new Map<string, PendingNodeActionStatement>();
  const subgraphs: CanvasSubgraph[] = [];
  const subgraphStack: CanvasSubgraph[] = [];
  const preservedStatements: string[] = [];
  const lines = bodyLines;
  const flowLine = lines.find((line) => FLOWCHART_LINE_PATTERN.test(line.trim()));
  const direction = ((flowLine?.trim().split(/\s+/)[1] || "LR") as GraphDirection) || "LR";

  function ensureNode(id: string, label?: string, shape?: FlowchartNodeShape, parentId?: string, asset?: CanvasNodeAsset, preview?: CanvasNodePreview) {
    const old = previous?.nodes.find((node) => node.id === id);

    if (!nodes.has(id)) {
      const index = nodes.size;
      nodes.set(id, {
        id,
        label: label || old?.label || id,
        x: old?.x ?? 120 + (index % 3) * 250,
        y: old?.y ?? 120 + Math.floor(index / 3) * 150,
        fill: old?.fill || NODE_COLORS[index % NODE_COLORS.length],
        shape: shape || old?.shape || DEFAULT_FLOWCHART_NODE_SHAPE,
        ...(asset || old?.asset ? { asset: asset || old?.asset } : {}),
        ...(preview || old?.preview ? { preview: preview || old?.preview } : {}),
        ...(old?.tablePresentation ? { tablePresentation: old.tablePresentation } : {})
      });
    } else {
      const node = nodes.get(id)!;
      if (label) node.label = label;
      if (shape) node.shape = shape;
      if (asset) node.asset = asset;
      if (preview) node.preview = preview;
    }

    if (parentId) assignNodeToSubgraph(subgraphs, id, parentId);
  }

  for (const line of lines) {
    const clean = line.trim();
    if (!clean || FLOWCHART_LINE_PATTERN.test(clean)) continue;
    if (clean.startsWith("%%")) {
      preservedStatements.push(line.trimEnd());
      continue;
    }

    if (/^subgraph\s+/i.test(clean)) {
      const subgraph = parseSubgraphHeader(clean, subgraphs.length);
      subgraph.parentId = subgraphStack.at(-1)?.id;
      subgraphs.push(subgraph);
      subgraphStack.push(subgraph);
      continue;
    }

    if (/^end;?$/i.test(clean)) {
      subgraphStack.pop();
      continue;
    }

    if (subgraphStack.length && /^direction\s+/i.test(clean)) {
      const localDirection = clean.split(/\s+/)[1] as GraphDirection | undefined;
      if (isGraphDirection(localDirection)) subgraphStack[subgraphStack.length - 1].direction = localDirection;
      continue;
    }

    const edgeProperty = parseEdgePropertyStatement(clean);
    if (edgeProperty) {
      pendingEdgeProperties.push(edgeProperty);
      continue;
    }

    const linkStyle = parseLinkStyleStatement(clean);
    if (linkStyle) {
      pendingLinkStyles.push(linkStyle);
      continue;
    }

    const classStatement = parseClassStatement(clean);
    if (classStatement) {
      pendingClassStatements.push(classStatement);
      continue;
    }

    const nodeAction = parseNodeActionStatement(clean);
    if (nodeAction) {
      pendingNodeActions.set(nodeAction.nodeId, nodeAction);
      continue;
    }

    const edgeStatements = parseEdgeStatements(clean);
    if (edgeStatements) {
      pendingEdges.push(...edgeStatements.map((edge) => ({ ...edge, parentId: subgraphStack.at(-1)?.id })));
      continue;
    }

    const node = parseNodeToken(clean);
    if (node) {
      ensureNode(node.id, node.label, node.hasShape ? node.shape : undefined, subgraphStack.at(-1)?.id, node.asset, node.preview);
      continue;
    }

    preservedStatements.push(line.trimEnd());
  }

  const subgraphIds = new Set(subgraphs.map((subgraph) => subgraph.id));
  const edges: CanvasEdge[] = pendingEdges.map((edge, index) => {
    const leftKind = endpointKind(edge.left, subgraphIds);
    const rightKind = endpointKind(edge.right, subgraphIds);

    if (leftKind === "node") ensureNode(edge.left.id, edge.left.label, edge.left.hasShape ? edge.left.shape : undefined, edge.parentId, edge.left.asset, edge.left.preview);
    if (rightKind === "node") ensureNode(edge.right.id, edge.right.label, edge.right.hasShape ? edge.right.shape : undefined, edge.parentId, edge.right.asset, edge.right.preview);
    const style = edge.operator.style;
    const markerStart = edge.operator.markerStart;
    const markerEnd = edge.operator.markerEnd;
    const arrowType = markerEnd;
    const minLength = edge.operator.minLength;
    const mermaidId = edge.operator.mermaidId;
    const previousEdge = findPreviousEdge(previous, edge.left.id, edge.right.id, edge.label, style, markerStart, markerEnd, minLength, mermaidId);

    return {
      id: resolveEdgeId(
        previous,
        edge.left.id,
        edge.right.id,
        edge.label,
        style,
        markerStart,
        markerEnd,
        minLength,
        mermaidId,
        index
      ),
      from: edge.left.id,
      to: edge.right.id,
      label: edge.label,
      style,
      markerStart,
      markerEnd,
      arrowType,
      minLength,
      ...(mermaidId ? { mermaidId } : {}),
      ...(previousEdge?.fromAnchor ? { fromAnchor: previousEdge.fromAnchor } : {}),
      ...(previousEdge?.toAnchor ? { toAnchor: previousEdge.toAnchor } : {})
    };
  });
  const preservedAfterEdgeMetadata = applyEdgeMetadata(edges, pendingEdgeProperties, pendingLinkStyles, pendingClassStatements);

  const graphNodes = [...nodes.values()].map((node) => {
    const action = pendingNodeActions.get(node.id)?.action;
    const previousNode = previous?.nodes.find((candidate) => candidate.id === node.id);
    const content = action?.kind === "file"
      && previousNode?.action?.kind === "file"
      && isCsvTableFilePath(action.path)
      && csvTableDocumentReferenceKey(action.path) === csvTableDocumentReferenceKey(previousNode.action.path)
      ? previousNode.content
      : undefined;
    return {
      ...node,
      ...(action ? { action } : {}),
      ...(content ? { content } : {})
    };
  });

  return {
    diagramType,
    editableKind,
    parseStatus: "parsed",
    direction,
    nodes: graphNodes,
    edges,
    subgraphs: subgraphs.filter((subgraph) => subgraph.nodeIds.length > 0 || subgraphs.some((child) => child.parentId === subgraph.id)),
    preservedStatements: [...preservedStatements, ...preservedAfterEdgeMetadata],
    defaultEdgeStyleText: pendingLinkStyles.find((style) => style.targets === "default")?.styleText,
    frontmatter
  };
}

export function detectDiagramType(source: string): DiagramType {
  const { bodyLines } = extractFrontmatter(source);
  const firstLine = bodyLines.map((line) => line.trim()).find((line) => line && !line.startsWith("%%"));
  if (!firstLine) return "unknown";

  if (FLOWCHART_LINE_PATTERN.test(firstLine)) return "flowchart";
  if (/^sequenceDiagram\b/i.test(firstLine)) return "sequence";
  if (/^classDiagram\b/i.test(firstLine)) return "class";
  if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return "state";
  if (/^erDiagram\b/i.test(firstLine)) return "er";
  if (/^gantt\b/i.test(firstLine)) return "gantt";
  if (/^pie\b/i.test(firstLine)) return "pie";
  if (/^mindmap\b/i.test(firstLine)) return "mindmap";
  if (/^timeline\b/i.test(firstLine)) return "timeline";
  if (/^architecture(?:-beta)?\b/i.test(firstLine)) return "architecture";

  return "unknown";
}

export function editableKindFromDiagramType(diagramType: DiagramType): EditableKind {
  return diagramType === "flowchart" ? "flowchart" : "render-only";
}

export function inspectMermaidSource(source: string) {
  const diagramType = detectDiagramType(source);
  return {
    diagramType,
    editableKind: editableKindFromDiagramType(diagramType)
  };
}

function extractFrontmatter(source: string) {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { frontmatter: "", bodyLines: lines };

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex < 0) return { frontmatter: "", bodyLines: lines };

  return {
    frontmatter: lines.slice(0, endIndex + 1).join("\n"),
    bodyLines: lines.slice(endIndex + 1)
  };
}

function emptyGraph(input: Pick<MermaidGraph, "diagramType" | "editableKind" | "parseStatus" | "frontmatter">): MermaidGraph {
  return {
    ...input,
    direction: "LR",
    nodes: [],
    edges: [],
    subgraphs: [],
    preservedStatements: []
  };
}

function resolveEdgeId(
  previous: MermaidGraph | undefined,
  from: string,
  to: string,
  label: string,
  style: EdgeStyle,
  markerStart: EdgeMarker,
  markerEnd: EdgeMarker,
  minLength: number,
  mermaidId: string | undefined,
  index: number
) {
  const previousEdge = findPreviousEdge(previous, from, to, label, style, markerStart, markerEnd, minLength, mermaidId);

  return previousEdge?.id || mermaidId || `${from}_${to}_${index}`;
}

function findPreviousEdge(
  previous: MermaidGraph | undefined,
  from: string,
  to: string,
  label: string,
  style: EdgeStyle,
  markerStart: EdgeMarker,
  markerEnd: EdgeMarker,
  minLength: number,
  mermaidId?: string
) {
  if (mermaidId) {
    const byMermaidId = previous?.edges.find((edge) => edge.mermaidId === mermaidId || edge.id === mermaidId);
    if (byMermaidId) return byMermaidId;
  }

  return previous?.edges.find(
    (edge) =>
      edge.from === from &&
      edge.to === to &&
      edge.label === label &&
      edge.style === style &&
      edgeMarkerStart(edge) === markerStart &&
      edgeMarkerEnd(edge) === markerEnd &&
      (edge.minLength || 1) === minLength
  );
}
