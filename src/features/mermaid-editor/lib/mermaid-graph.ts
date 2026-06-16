import type {
  CanvasEdge,
  CanvasNode,
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
  hasShape: boolean;
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

  const modern = readModernNodeShape(rest);
  if (modern) {
    return {
      id,
      label: normalizeLabel(modern.label),
      shape: modern.shape,
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

function readModernNodeShape(value: string): { shape: FlowchartNodeShape; label: string } | null {
  const match = value.match(/^@\{\s*([\s\S]*?)\s*\}$/);
  if (!match) return null;

  const shape = normalizeFlowchartShape(match[1].match(/\bshape\s*:\s*([A-Za-z0-9_-]+)/)?.[1]);
  if (!shape) return null;

  return {
    shape,
    label: readObjectLabel(match[1])
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

function readObjectLabel(value: string) {
  const doubleQuoted = value.match(/\blabel\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (doubleQuoted) return unescapeMermaidString(doubleQuoted[1]);

  const singleQuoted = value.match(/\blabel\s*:\s*'((?:\\.|[^'\\])*)'/);
  if (singleQuoted) return unescapeMermaidString(singleQuoted[1]);

  return "";
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
  const suffix = arrowType === "arrow" ? ">" : arrowType === "circle" ? "o" : arrowType === "cross" ? "x" : "";

  if (style === "thick") return arrowType === "none" ? "===" : `==${suffix}`;
  if (style === "dotted") return arrowType === "none" ? "-.-" : `-.${suffix}`;
  return arrowType === "none" ? "---" : `--${suffix}`;
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
  const edges: CanvasEdge[] = [];
  const subgraphs: CanvasSubgraph[] = [];
  const subgraphStack: CanvasSubgraph[] = [];
  const preservedStatements: string[] = [];
  const lines = bodyLines;
  const flowLine = lines.find((line) => FLOWCHART_LINE_PATTERN.test(line.trim()));
  const direction = ((flowLine?.trim().split(/\s+/)[1] || "LR") as GraphDirection) || "LR";

  function ensureNode(id: string, label?: string, shape?: FlowchartNodeShape) {
    const old = previous?.nodes.find((node) => node.id === id);

    if (!nodes.has(id)) {
      const index = nodes.size;
      nodes.set(id, {
        id,
        label: label || old?.label || id,
        x: old?.x ?? 120 + (index % 3) * 250,
        y: old?.y ?? 120 + Math.floor(index / 3) * 150,
        fill: old?.fill || NODE_COLORS[index % NODE_COLORS.length],
        shape: shape || old?.shape || DEFAULT_FLOWCHART_NODE_SHAPE
      });
    } else {
      const node = nodes.get(id)!;
      if (label) node.label = label;
      if (shape) node.shape = shape;
    }

    for (const subgraph of subgraphStack) {
      if (!subgraph.nodeIds.includes(id)) subgraph.nodeIds.push(id);
    }
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
      subgraphs.push(subgraph);
      subgraphStack.push(subgraph);
      continue;
    }

    if (/^end;?$/i.test(clean)) {
      subgraphStack.pop();
      continue;
    }

    const edge = parseEdgeStatement(clean);
    if (edge) {
      const { left, right, label, operator } = edge;
      if (left && right) {
        ensureNode(left.id, left.label, left.hasShape ? left.shape : undefined);
        ensureNode(right.id, right.label, right.hasShape ? right.shape : undefined);
        edges.push({
          id: resolveEdgeId(previous, left.id, right.id, label, styleFromEdgeOperator(operator), arrowTypeFromEdgeOperator(operator), edges.length),
          from: left.id,
          to: right.id,
          label,
          style: styleFromEdgeOperator(operator),
          arrowType: arrowTypeFromEdgeOperator(operator)
        });
      }
      continue;
    }

    const node = parseNodeToken(clean);
    if (node) {
      ensureNode(node.id, node.label, node.hasShape ? node.shape : undefined);
      continue;
    }

    preservedStatements.push(line.trimEnd());
  }

  return {
    diagramType,
    editableKind,
    parseStatus: "parsed",
    direction,
    nodes: [...nodes.values()],
    edges,
    subgraphs: subgraphs.filter((subgraph) => subgraph.nodeIds.length > 0),
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
  const shape = node.shape || DEFAULT_FLOWCHART_NODE_SHAPE;

  return `${node.id}@{ shape: ${shape}, label: "${label}" }`;
}

export function serializeMermaid(graph: MermaidGraph) {
  const lines = [];
  const frontmatter = graph.frontmatter?.trim();
  if (frontmatter) lines.push(frontmatter);

  lines.push(`flowchart ${graph.direction || "LR"}`);
  const declaredInSubgraph = new Set<string>();

  for (const subgraph of graph.subgraphs || []) {
    const nodes = subgraph.nodeIds.map((id) => graph.nodes.find((node) => node.id === id)).filter(Boolean) as CanvasNode[];
    if (!nodes.length) continue;

    lines.push(`  ${serializeSubgraphHeader(subgraph)}`);
    for (const node of nodes) {
      declaredInSubgraph.add(node.id);
      lines.push(`    ${serializeNodeToken(node)}`);
    }
    lines.push("  end");
  }

  for (const node of graph.nodes) {
    if (!declaredInSubgraph.has(node.id)) lines.push(`  ${serializeNodeToken(node)}`);
  }

  for (const edge of graph.edges) {
    if (!graph.nodes.some((node) => node.id === edge.from) || !graph.nodes.some((node) => node.id === edge.to)) continue;

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
