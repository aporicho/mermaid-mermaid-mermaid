import type {
  CanvasNode,
  CanvasNodeAsset,
  CanvasSubgraph,
  DiagramType,
  EdgeStyle,
  EditableKind,
  FlowchartArrowType,
  FlowchartNodeShape,
  GraphDirection,
  MermaidGraph
} from "@/features/mermaid-editor/lib/editor-types";
import {
  DEFAULT_FLOWCHART_NODE_SHAPE,
  normalizeFlowchartShape
} from "@/features/mermaid-editor/lib/flowchart-shapes";
import {
  createImageAsset,
  imageLabelPositionFromMermaid,
  mermaidImagePosition,
  normalizeImageAsset
} from "@/features/mermaid-editor/lib/node-assets";

const NODE_COLORS = [
  "#fbf6ef",
  "#ffe1e5",
  "#fff0cf",
  "#eadfd2",
  "#e9eff0",
  "#f3e6f1",
  "#e7eadb",
  "#f1eadf"
];

const DEFAULT_SOURCE = `flowchart LR
  Start([想法]) --> Draft[写 Mermaid]
  Draft --> Canvas[拖拽画布整理]
  Canvas --> Preview{渲染满意吗}
  Preview -->|是| Ship[导出 / 复制]
  Preview -->|否| Canvas`;

export const palette = NODE_COLORS;
export const initialMermaidSource = DEFAULT_SOURCE;

function normalizeLabel(value: string) {
  return value.trim().replace(/^["']|["']$/g, "").replace(/<br\s*\/?>/gi, "\n");
}

function cleanNodeId(value: string) {
  const cleaned = value.trim().replace(/[^\w-]/g, "_");
  if (!cleaned) return `Node_${Date.now()}`;
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `Node_${cleaned}`;
}

type ParsedNodeToken = {
  id: string;
  label: string;
  shape: FlowchartNodeShape;
  asset?: CanvasNodeAsset;
  hasShape: boolean;
};

type ParsedEdgeStatement = {
  left: ParsedNodeToken;
  right: ParsedNodeToken;
  label: string;
  operator: string;
};

type PendingEdgeStatement = ParsedEdgeStatement & {
  parentId?: string;
};

const FLOWCHART_LINE_PATTERN = /^(flowchart|graph)\s+/i;
const EDGE_OPERATOR_PATTERN = "-\\.->|-\\.-|-\\.o|-\\.x|==>|===|==o|==x|-->|---|--o|--x";

function parseNodeToken(raw: string): ParsedNodeToken | null {
  const token = raw.trim().replace(/;$/, "");
  const idMatch = token.match(/^([A-Za-z][\w-]*)/);

  if (!idMatch) return null;

  const id = idMatch[1];
  const rest = token.slice(id.length).trim();

  if (!rest) return { id, label: "", shape: DEFAULT_FLOWCHART_NODE_SHAPE, hasShape: false };

  const modern = readModernNodeProps(rest);
  if (modern) {
    return {
      id,
      label: normalizeLabel(modern.label),
      shape: modern.shape,
      asset: modern.asset,
      hasShape: true
    };
  }

  const wrapped = readNodeShape(rest);
  if (!wrapped) return null;

  return {
    id,
    label: normalizeLabel(wrapped.label),
    shape: wrapped.shape,
    hasShape: true
  };
}

function readModernNodeProps(value: string): { shape: FlowchartNodeShape; label: string; asset?: CanvasNodeAsset } | null {
  const match = value.match(/^@\{\s*([\s\S]*?)\s*\}$/);
  if (!match) return null;

  const fields = readObjectFields(match[1]);
  const asset = readImageAsset(fields);
  const shape = normalizeFlowchartShape(fields.get("shape")) || DEFAULT_FLOWCHART_NODE_SHAPE;
  if (!asset && !normalizeFlowchartShape(fields.get("shape"))) return null;

  return {
    shape,
    label: fields.get("label") || "",
    asset
  };
}

function readNodeShape(value: string): { shape: FlowchartNodeShape; label: string } | null {
  const shapes: { shape: FlowchartNodeShape; start: string; end: string }[] = [
    { shape: "fr-rect", start: "[[", end: "]]" },
    { shape: "cyl", start: "[(", end: ")]" },
    { shape: "circle", start: "((", end: "))" },
    { shape: "stadium", start: "([", end: "])" },
    { shape: "hex", start: "{{", end: "}}" },
    { shape: "diam", start: "{", end: "}" },
    { shape: "rect", start: "[", end: "]" },
    { shape: "rounded", start: "(", end: ")" }
  ];

  for (const item of shapes) {
    if (value.startsWith(item.start) && value.endsWith(item.end)) {
      return {
        shape: item.shape,
        label: value.slice(item.start.length, value.length - item.end.length)
      };
    }
  }

  return null;
}

function readObjectFields(value: string) {
  const fields = new Map<string, string>();
  const fieldPattern = /([A-Za-z][\w-]*)\s*:\s*("((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|[^,\n\r}]+)/g;
  let match: RegExpExecArray | null;

  while ((match = fieldPattern.exec(value))) {
    const [, rawKey, rawValue, doubleQuoted, singleQuoted] = match;
    fields.set(rawKey, unescapeMermaidString(doubleQuoted ?? singleQuoted ?? rawValue.trim()));
  }

  return fields;
}

function readImageAsset(fields: Map<string, string>) {
  const src = fields.get("img");
  if (!src) return undefined;

  return createImageAsset({
    src,
    width: fields.has("w") ? Number(fields.get("w")) : undefined,
    height: fields.has("h") ? Number(fields.get("h")) : undefined,
    preserveAspectRatio: fields.get("constraint") !== "off",
    labelPosition: imageLabelPositionFromMermaid(fields.get("pos"))
  });
}

function unescapeMermaidString(value: string) {
  return value.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function styleFromEdgeOperator(operator: string): EdgeStyle {
  if (operator.includes("=")) return "thick";
  if (operator.includes(".")) return "dotted";
  return "solid";
}

function arrowTypeFromEdgeOperator(operator: string): FlowchartArrowType {
  if (operator.endsWith("o")) return "circle";
  if (operator.endsWith("x")) return "cross";
  if (operator.endsWith(">")) return "arrow";
  return "none";
}

function edgeOperatorFromSemantics(style: EdgeStyle = "solid", arrowType: FlowchartArrowType = "arrow") {
  const operators: Record<EdgeStyle, Record<FlowchartArrowType, string>> = {
    solid: {
      arrow: "-->",
      none: "---",
      circle: "--o",
      cross: "--x"
    },
    thick: {
      arrow: "==>",
      none: "===",
      circle: "==o",
      cross: "==x"
    },
    dotted: {
      arrow: "-.->",
      none: "-.-",
      circle: "-.o",
      cross: "-.x"
    }
  };

  return operators[style][arrowType];
}

export function toSafeNodeId(value: string, existingIds: string[], fallback = "Node") {
  const base = cleanNodeId(value || fallback);
  if (!existingIds.includes(base)) return base;

  let index = 2;
  while (existingIds.includes(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function nextCanvasNodeId(existingNodes: CanvasNode[]) {
  const existingIds = existingNodes.map((node) => node.id);
  const maxGeneratedIndex = existingIds.reduce((max, id) => {
    const match = id.match(/^N(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return toSafeNodeId(`N${maxGeneratedIndex + 1}`, existingIds, "N1");
}

export function createNode(existingNodes: CanvasNode[], x = 160, y = 120): CanvasNode {
  const id = nextCanvasNodeId(existingNodes);
  return {
    id,
    label: "新节点",
    x,
    y,
    fill: NODE_COLORS[existingNodes.length % NODE_COLORS.length],
    shape: DEFAULT_FLOWCHART_NODE_SHAPE
  };
}

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
  const subgraphs: CanvasSubgraph[] = [];
  const subgraphStack: CanvasSubgraph[] = [];
  const preservedStatements: string[] = [];
  const lines = bodyLines;
  const flowLine = lines.find((line) => FLOWCHART_LINE_PATTERN.test(line.trim()));
  const direction = ((flowLine?.trim().split(/\s+/)[1] || "LR") as GraphDirection) || "LR";

  function ensureNode(id: string, label?: string, shape?: FlowchartNodeShape, parentId?: string, asset?: CanvasNodeAsset) {
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
        ...(asset || old?.asset ? { asset: asset || old?.asset } : {})
      });
    } else {
      const node = nodes.get(id)!;
      if (label) node.label = label;
      if (shape) node.shape = shape;
      if (asset) node.asset = asset;
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

    const edge = parseEdgeStatement(clean);
    if (edge) {
      pendingEdges.push({ ...edge, parentId: subgraphStack.at(-1)?.id });
      continue;
    }

    const node = parseNodeToken(clean);
    if (node) {
      ensureNode(node.id, node.label, node.hasShape ? node.shape : undefined, subgraphStack.at(-1)?.id, node.asset);
      continue;
    }

    preservedStatements.push(line.trimEnd());
  }

  const subgraphIds = new Set(subgraphs.map((subgraph) => subgraph.id));
  const edges = pendingEdges.map((edge, index) => {
    const leftKind = endpointKind(edge.left, subgraphIds);
    const rightKind = endpointKind(edge.right, subgraphIds);

    if (leftKind === "node") ensureNode(edge.left.id, edge.left.label, edge.left.hasShape ? edge.left.shape : undefined, edge.parentId, edge.left.asset);
    if (rightKind === "node") ensureNode(edge.right.id, edge.right.label, edge.right.hasShape ? edge.right.shape : undefined, edge.parentId, edge.right.asset);

    return {
      id: resolveEdgeId(
        previous,
        edge.left.id,
        edge.right.id,
        edge.label,
        styleFromEdgeOperator(edge.operator),
        arrowTypeFromEdgeOperator(edge.operator),
        index
      ),
      from: edge.left.id,
      to: edge.right.id,
      label: edge.label,
      style: styleFromEdgeOperator(edge.operator),
      arrowType: arrowTypeFromEdgeOperator(edge.operator)
    };
  });

  return {
    diagramType,
    editableKind,
    parseStatus: "parsed",
    direction,
    nodes: [...nodes.values()],
    edges,
    subgraphs: subgraphs.filter((subgraph) => subgraph.nodeIds.length > 0 || subgraphs.some((child) => child.parentId === subgraph.id)),
    preservedStatements,
    frontmatter
  };
}

function parseEdgeStatement(clean: string) {
  const edgeMatch = clean.match(new RegExp(`^(.*?)\\s*(${EDGE_OPERATOR_PATTERN})\\s*(.*)$`));
  if (!edgeMatch) return null;

  const left = parseNodeToken(edgeMatch[1]);
  let rightRaw = edgeMatch[3].trim().replace(/;$/, "");
  let label = "";
  const labelMatch = rightRaw.match(/^\|([^|]*)\|\s*(.*)$/);

  if (labelMatch) {
    label = normalizeLabel(labelMatch[1]);
    rightRaw = labelMatch[2].trim();
  }

  const right = parseNodeToken(rightRaw);
  if (!left || !right) return null;

  return {
    left,
    right,
    label,
    operator: edgeMatch[2]
  };
}

function escapeMermaidLabel(value: string) {
  return value.replace(/\r?\n/g, "<br/>").replace(/"/g, '\\"');
}

function serializeNodeToken(node: CanvasNode) {
  const label = escapeMermaidLabel(node.label || node.id);
  const asset = normalizeImageAsset(node.asset);
  if (asset) {
    return `${node.id}@{ img: "${escapeMermaidLabel(asset.src)}", label: "${label}", pos: "${mermaidImagePosition(asset.labelPosition)}", w: ${asset.width}, h: ${asset.height}, constraint: "${asset.preserveAspectRatio ? "on" : "off"}" }`;
  }

  const shape = node.shape || DEFAULT_FLOWCHART_NODE_SHAPE;

  return `${node.id}@{ shape: ${shape}, label: "${label}" }`;
}

export function serializeMermaid(graph: MermaidGraph) {
  const lines = [];
  const frontmatter = graph.frontmatter?.trim();
  if (frontmatter) lines.push(frontmatter);

  lines.push(`flowchart ${graph.direction || "LR"}`);
  const declaredInSubgraph = new Set<string>();
  const childrenByParent = groupSubgraphsByParent(graph.subgraphs || []);

  for (const subgraph of childrenByParent.get("__root__") || []) {
    serializeSubgraph(lines, graph, subgraph, childrenByParent, declaredInSubgraph, "  ");
  }

  for (const node of graph.nodes) {
    if (!declaredInSubgraph.has(node.id)) lines.push(`  ${serializeNodeToken(node)}`);
  }

  for (const edge of graph.edges) {
    if (!graphEndpointExists(graph, edge.from) || !graphEndpointExists(graph, edge.to)) continue;

    const operator = edgeOperatorFromSemantics(edge.style || "solid", edge.arrowType || "arrow");
    const edgeText = edge.label ? `${operator}|${escapeMermaidLabel(edge.label)}|` : operator;
    lines.push(`  ${edge.from} ${edgeText} ${edge.to}`);
  }

  for (const statement of graph.preservedStatements || []) {
    if (statement.trim()) lines.push(statement);
  }

  return lines.join("\n");
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

function parseSubgraphHeader(clean: string, index: number): CanvasSubgraph {
  const raw = clean.replace(/^subgraph\s+/i, "").trim().replace(/;$/, "");
  const idAndTitle = raw.match(/^([A-Za-z][\w-]*)\s*\[(.*)\]$/);
  if (idAndTitle) {
    return {
      id: idAndTitle[1],
      title: normalizeLabel(idAndTitle[2]),
      nodeIds: []
    };
  }

  const nodeLike = parseNodeToken(raw);
  if (nodeLike?.label) {
    return {
      id: nodeLike.id,
      title: nodeLike.label,
      nodeIds: []
    };
  }

  const id = /^[A-Za-z][\w-]*$/.test(raw) ? raw : cleanNodeId(raw || `Subgraph_${index + 1}`);
  return {
    id,
    title: raw || id,
    nodeIds: []
  };
}

function serializeSubgraphHeader(subgraph: CanvasSubgraph) {
  if (!subgraph.title || subgraph.title === subgraph.id) return `subgraph ${subgraph.id}`;
  return `subgraph ${subgraph.id} [${escapeMermaidLabel(subgraph.title)}]`;
}

function isGraphDirection(value: string | undefined): value is GraphDirection {
  return value === "TD" || value === "TB" || value === "BT" || value === "RL" || value === "LR";
}

function assignNodeToSubgraph(subgraphs: CanvasSubgraph[], nodeId: string, parentId: string) {
  for (const subgraph of subgraphs) {
    subgraph.nodeIds = subgraph.nodeIds.filter((id) => id !== nodeId);
  }

  const parent = subgraphs.find((subgraph) => subgraph.id === parentId);
  if (parent && !parent.nodeIds.includes(nodeId)) parent.nodeIds.push(nodeId);
}

function endpointKind(token: ParsedNodeToken, subgraphIds: Set<string>) {
  return !token.hasShape && subgraphIds.has(token.id) ? "subgraph" : "node";
}

function groupSubgraphsByParent(subgraphs: CanvasSubgraph[]) {
  const childrenByParent = new Map<string, CanvasSubgraph[]>();

  for (const subgraph of subgraphs) {
    const parentId = subgraph.parentId || "__root__";
    const children = childrenByParent.get(parentId) || [];
    children.push(subgraph);
    childrenByParent.set(parentId, children);
  }

  return childrenByParent;
}

function serializeSubgraph(
  lines: string[],
  graph: MermaidGraph,
  subgraph: CanvasSubgraph,
  childrenByParent: Map<string, CanvasSubgraph[]>,
  declaredInSubgraph: Set<string>,
  indent: string
) {
  lines.push(`${indent}${serializeSubgraphHeader(subgraph)}`);
  if (subgraph.direction) lines.push(`${indent}  direction ${subgraph.direction}`);

  for (const child of childrenByParent.get(subgraph.id) || []) {
    serializeSubgraph(lines, graph, child, childrenByParent, declaredInSubgraph, `${indent}  `);
  }

  for (const node of subgraph.nodeIds.map((id) => graph.nodes.find((item) => item.id === id)).filter(Boolean) as CanvasNode[]) {
    declaredInSubgraph.add(node.id);
    lines.push(`${indent}  ${serializeNodeToken(node)}`);
  }

  lines.push(`${indent}end`);
}

function graphEndpointExists(graph: MermaidGraph, id: string) {
  return graph.nodes.some((node) => node.id === id) || (graph.subgraphs || []).some((subgraph) => subgraph.id === id);
}

function resolveEdgeId(
  previous: MermaidGraph | undefined,
  from: string,
  to: string,
  label: string,
  style: EdgeStyle,
  arrowType: FlowchartArrowType,
  index: number
) {
  const previousEdge = previous?.edges.find(
    (edge) =>
      edge.from === from &&
      edge.to === to &&
      edge.label === label &&
      edge.style === style &&
      (edge.arrowType || "arrow") === arrowType
  );

  return previousEdge?.id || `${from}_${to}_${index}`;
}
