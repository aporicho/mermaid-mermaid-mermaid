import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeAction,
  CanvasNodeAsset,
  CanvasSubgraph,
  DiagramType,
  EdgeAnimation,
  EdgeMarker,
  EdgeStyle,
  EditableKind,
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
import {
  inferNodeActionFromMermaidTarget,
  nodeActionTarget,
  normalizeNodeAction
} from "@/features/mermaid-editor/lib/node-actions";

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
  operator: ParsedEdgeOperator;
};

type PendingEdgeStatement = ParsedEdgeStatement & {
  parentId?: string;
};

type ParsedEdgeOperator = {
  raw: string;
  style: EdgeStyle;
  markerStart: EdgeMarker;
  markerEnd: EdgeMarker;
  minLength: number;
  mermaidId?: string;
};

type PendingEdgeProperty = {
  mermaidId: string;
  fields: Map<string, string>;
  raw: string;
};

type PendingLinkStyle = {
  targets: "default" | number[];
  styleText: string;
  raw: string;
};

type PendingClassStatement = {
  ids: string[];
  classes: string[];
  raw: string;
};

type PendingNodeActionStatement = {
  nodeId: string;
  action: CanvasNodeAction;
};

const FLOWCHART_LINE_PATTERN = /^(flowchart|graph)\s+/i;
const EDGE_OPERATOR_SCAN_PATTERN = /(?:\b[A-Za-z][\w-]*@)?[<ox]?(?:-\.{1,}-|-{2,}|={2,}|~~~)[>ox]?/g;
const EDGE_ID_PREFIX_PATTERN = /^([A-Za-z][\w-]*)@/;
const MERMAID_CURVES = new Set(["basis", "bumpX", "bumpY", "cardinal", "catmullRom", "linear", "monotoneX", "monotoneY", "natural", "step", "stepAfter", "stepBefore"]);

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

function escapeMermaidStringLiteral(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "<br/>").replace(/"/g, '\\"');
}

function markerFromStart(value: string | undefined): EdgeMarker {
  if (value === "<") return "arrow";
  if (value === "o") return "circle";
  if (value === "x") return "cross";
  return "none";
}

function markerFromEnd(value: string | undefined): EdgeMarker {
  if (value === ">") return "arrow";
  if (value === "o") return "circle";
  if (value === "x") return "cross";
  return "none";
}

function markerStartChar(marker: EdgeMarker | undefined) {
  if (marker === "arrow") return "<";
  if (marker === "circle") return "o";
  if (marker === "cross") return "x";
  return "";
}

function markerEndChar(marker: EdgeMarker | undefined) {
  if (marker === "arrow") return ">";
  if (marker === "circle") return "o";
  if (marker === "cross") return "x";
  return "";
}

function normalizeEdgeMarker(value: EdgeMarker | undefined, fallback: EdgeMarker): EdgeMarker {
  return value === "arrow" || value === "circle" || value === "cross" || value === "none" ? value : fallback;
}

function edgeMarkerStart(edge: Pick<CanvasEdge, "markerStart">): EdgeMarker {
  return normalizeEdgeMarker(edge.markerStart, "none");
}

function edgeMarkerEnd(edge: Pick<CanvasEdge, "markerEnd" | "arrowType">): EdgeMarker {
  return normalizeEdgeMarker(edge.markerEnd || edge.arrowType, "arrow");
}

function parseEdgeOperator(rawOperator: string): ParsedEdgeOperator | null {
  let raw = rawOperator.trim();
  const idMatch = raw.match(EDGE_ID_PREFIX_PATTERN);
  const mermaidId = idMatch?.[1];
  if (mermaidId) raw = raw.slice(idMatch[0].length);

  if (raw === "~~~") {
    return {
      raw: rawOperator,
      style: "invisible",
      markerStart: "none",
      markerEnd: "none",
      minLength: 1,
      ...(mermaidId ? { mermaidId } : {})
    };
  }

  const markerStart = markerFromStart(raw[0]);
  if (markerStart !== "none") raw = raw.slice(1);

  const markerEnd = markerFromEnd(raw.at(-1));
  if (markerEnd !== "none") raw = raw.slice(0, -1);

  const style: EdgeStyle = raw.includes("=") ? "thick" : raw.includes(".") ? "dotted" : "solid";
  if (style === "dotted" && !/^-\.{1,}-$/.test(raw)) return null;
  if (style === "thick" && !/^={2,}$/.test(raw)) return null;
  if (style === "solid" && !/^-{2,}$/.test(raw)) return null;

  const hasMarker = markerStart !== "none" || markerEnd !== "none";
  const minLength = style === "dotted" ? raw.replace(/[^.]/g, "").length : Math.max(1, raw.length - (hasMarker ? 1 : 2));

  return {
    raw: rawOperator,
    style,
    markerStart,
    markerEnd,
    minLength: Math.max(1, minLength),
    ...(mermaidId ? { mermaidId } : {})
  };
}

function edgeOperatorFromSemantics(edge: Pick<CanvasEdge, "style" | "arrowType" | "markerStart" | "markerEnd" | "minLength" | "mermaidId">) {
  const style = edge.style || "solid";
  const markerStart = style === "invisible" ? "none" : edgeMarkerStart(edge);
  let markerEnd = style === "invisible" ? "none" : edgeMarkerEnd(edge);
  if (markerStart !== "none" && markerEnd === "none") markerEnd = "arrow";
  const minLength = Math.max(1, Math.round(edge.minLength || 1));
  const idPrefix = edge.mermaidId ? `${edge.mermaidId}@` : "";

  if (style === "invisible") return `${idPrefix}~~~`;

  const hasMarker = markerStart !== "none" || markerEnd !== "none";
  const body =
    style === "dotted"
      ? `-${".".repeat(minLength)}-`
      : (style === "thick" ? "=" : "-").repeat(minLength + (hasMarker ? 1 : 2));

  return `${idPrefix}${markerStartChar(markerStart)}${body}${markerEndChar(markerEnd)}`;
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
    return action ? { ...node, action } : node;
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

function parseNodeActionStatement(clean: string): PendingNodeActionStatement | null {
  const source = clean.trim().replace(/;$/, "");
  const match = source.match(/^click\s+([A-Za-z][\w-]*)\s+([\s\S]+)$/i);
  if (!match) return null;

  const nodeId = match[1];
  const tokens = readMermaidActionTokens(match[2]);
  if (!tokens.length) return null;

  const first = tokens[0].toLowerCase();
  if (first === "call" || first === "callback") return null;

  const target = first === "href" ? tokens[1] : tokens[0];
  const tooltipCandidate = first === "href" ? tokens[2] : tokens[1];
  const tooltip = tooltipCandidate && !tooltipCandidate.startsWith("_") ? tooltipCandidate : undefined;
  const action = inferNodeActionFromMermaidTarget(target || "", tooltip);
  return action ? { nodeId, action } : null;
}

function readMermaidActionTokens(value: string) {
  const tokens: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    tokens.push(unescapeMermaidString(match[1] ?? match[2] ?? match[3]));
  }

  return tokens;
}

function parseEdgeStatements(clean: string): ParsedEdgeStatement[] | null {
  const inlineLabel = parseInlineLabelEdgeStatement(clean);
  if (inlineLabel) return [inlineLabel];

  const source = clean.trim().replace(/;$/, "");
  EDGE_OPERATOR_SCAN_PATTERN.lastIndex = 0;

  const operands: string[] = [];
  const operators: (ParsedEdgeOperator & { label: string })[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = EDGE_OPERATOR_SCAN_PATTERN.exec(source))) {
    const token = match[0];

    const operand = source.slice(cursor, match.index).trim();
    if (!operand && !operands.length) return null;
    operands.push(operand);

    const operator = parseEdgeOperator(token);
    if (!operator) return null;

    cursor = EDGE_OPERATOR_SCAN_PATTERN.lastIndex;
    const pipeLabel = readPipeLabel(source, cursor);
    if (pipeLabel) cursor = pipeLabel.nextIndex;

    operators.push({ ...operator, label: pipeLabel?.label || "" });
  }

  if (!operators.length) return null;
  const tail = source.slice(cursor).trim();
  if (!tail) return null;
  operands.push(tail);
  if (operands.length !== operators.length + 1) return null;

  const edges: ParsedEdgeStatement[] = [];
  for (const [index, operator] of operators.entries()) {
    const leftNodes = parseEndpointList(operands[index]);
    const rightNodes = parseEndpointList(operands[index + 1]);
    if (!leftNodes.length || !rightNodes.length) return null;

    for (const left of leftNodes) {
      for (const right of rightNodes) {
        edges.push({
          left,
          right,
          label: operator.label,
          operator
        });
      }
    }
  }

  return edges.length ? edges : null;
}

function parseInlineLabelEdgeStatement(clean: string): ParsedEdgeStatement | null {
  const source = clean.trim().replace(/;$/, "");
  const patterns = [
    /^(.*?)\s+(([A-Za-z][\w-]*)@)?([<ox]?-{2,})\s+(.+?)\s+(-{2,}[>ox]?)\s+(.*?)$/,
    /^(.*?)\s+(([A-Za-z][\w-]*)@)?([<ox]?={2,})\s+(.+?)\s+(={2,}[>ox]?)\s+(.*?)$/,
    /^(.*?)\s+(([A-Za-z][\w-]*)@)?([<ox]?-\.)\s+(.+?)\s+(\.-[>ox]?)\s+(.*?)$/
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const [, leftRaw, , mermaidId, operatorStart, label, operatorEnd, rightRaw] = match;
    const left = parseNodeToken(leftRaw);
    const right = parseNodeToken(rightRaw);
    const operator = parseEdgeOperator(`${mermaidId ? `${mermaidId}@` : ""}${inlineLabelOperator(operatorStart, operatorEnd)}`);
    if (!left || !right || !operator) continue;

    return {
      left,
      right,
      label: normalizeLabel(label),
      operator
    };
  }

  return null;
}

function inlineLabelOperator(start: string, end: string) {
  const startMarker = markerStartChar(markerFromStart(start[0]));
  if (start.includes(".")) return `${startMarker}-.${end.replace(/^\./, "")}`;
  return `${startMarker}${end}`;
}

function readPipeLabel(source: string, index: number) {
  const leading = source.slice(index).match(/^\s*/)?.[0] || "";
  const start = index + leading.length;
  if (source[start] !== "|") return null;

  const end = source.indexOf("|", start + 1);
  if (end < 0) return null;

  return {
    label: normalizeLabel(source.slice(start + 1, end)),
    nextIndex: end + 1
  };
}

function parseEndpointList(value: string) {
  return value
    .split("&")
    .map((part) => parseNodeToken(part.trim()))
    .filter(Boolean) as ParsedNodeToken[];
}

function parseEdgePropertyStatement(clean: string): PendingEdgeProperty | null {
  const match = clean.match(/^([A-Za-z][\w-]*)@\{\s*([\s\S]*?)\s*\};?$/);
  if (!match) return null;

  const fields = readObjectFields(match[2]);
  if (!fields.has("animate") && !fields.has("animation") && !fields.has("curve")) return null;

  return {
    mermaidId: match[1],
    fields,
    raw: clean
  };
}

function parseLinkStyleStatement(clean: string): PendingLinkStyle | null {
  const match = clean.match(/^linkStyle\s+(.+?)\s+(.+?);?$/i);
  if (!match) return null;

  const targetText = match[1].trim();
  if (targetText === "default") {
    return { targets: "default", styleText: match[2].trim(), raw: clean };
  }

  const targets = targetText.split(",").map((value) => Number(value.trim()));
  if (!targets.length || targets.some((value) => !Number.isInteger(value) || value < 0)) return null;

  return {
    targets,
    styleText: match[2].trim(),
    raw: clean
  };
}

function parseClassStatement(clean: string): PendingClassStatement | null {
  const match = clean.match(/^class\s+(.+?)\s+(.+?);?$/i);
  if (!match) return null;

  const ids = match[1].split(",").map((value) => value.trim()).filter(Boolean);
  const classes = match[2].split(/[,\s]+/).map((value) => value.trim()).filter(Boolean);
  if (!ids.length || !classes.length) return null;

  return { ids, classes, raw: clean };
}

function applyEdgeMetadata(edges: CanvasEdge[], properties: PendingEdgeProperty[], linkStyles: PendingLinkStyle[], classStatements: PendingClassStatement[]) {
  const preserved: string[] = [];
  const edgesByMermaidId = new Map(edges.flatMap((edge) => (edge.mermaidId ? [[edge.mermaidId, edge] as const] : [])));

  for (const property of properties) {
    const edge = edgesByMermaidId.get(property.mermaidId);
    if (!edge) {
      preserved.push(property.raw);
      continue;
    }

    const animation = edgeAnimationFromFields(property.fields);
    const curve = property.fields.get("curve");
    if (animation) edge.animation = animation;
    if (isMermaidCurve(curve)) edge.curve = curve;
  }

  for (const linkStyle of linkStyles) {
    if (linkStyle.targets === "default") continue;

    for (const target of linkStyle.targets) {
      const edge = edges[target];
      if (edge) edge.styleText = linkStyle.styleText;
    }
  }

  for (const classStatement of classStatements) {
    const targetEdges = classStatement.ids.map((id) => edgesByMermaidId.get(id));
    if (targetEdges.some((edge) => !edge)) {
      preserved.push(classStatement.raw);
      continue;
    }

    for (const edge of targetEdges) {
      edge!.classes = uniqueStrings([...(edge!.classes || []), ...classStatement.classes]);
    }
  }

  return preserved;
}

function edgeAnimationFromFields(fields: Map<string, string>): EdgeAnimation | undefined {
  const animation = fields.get("animation");
  if (animation === "fast" || animation === "slow") return animation;

  const animate = fields.get("animate");
  if (animate === "true") return "on";
  if (animate === "false") return "none";

  return undefined;
}

function isMermaidCurve(value: string | undefined): value is NonNullable<CanvasEdge["curve"]> {
  return Boolean(value && MERMAID_CURVES.has(value));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
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

    const operator = edgeOperatorFromSemantics(edge);
    const edgeText = edge.label ? `${operator}|${escapeMermaidLabel(edge.label)}|` : operator;
    lines.push(`  ${edge.from} ${edgeText} ${edge.to}`);
  }

  for (const edge of graph.edges) {
    if (!edge.mermaidId) continue;
    const propertyText = serializeEdgeProperties(edge);
    if (propertyText) lines.push(`  ${edge.mermaidId}@{ ${propertyText} }`);
  }

  for (const edge of graph.edges) {
    if (edge.mermaidId && edge.classes?.length) lines.push(`  class ${edge.mermaidId} ${edge.classes.join(",")}`);
  }

  if (graph.defaultEdgeStyleText) lines.push(`  linkStyle default ${graph.defaultEdgeStyleText}`);

  graph.edges.forEach((edge, index) => {
    if (edge.styleText) lines.push(`  linkStyle ${index} ${edge.styleText}`);
  });

  for (const node of graph.nodes) {
    const actionStatement = serializeNodeActionStatement(node);
    if (actionStatement) lines.push(actionStatement);
  }

  for (const statement of graph.preservedStatements || []) {
    if (statement.trim()) lines.push(statement);
  }

  return lines.join("\n");
}

function serializeNodeActionStatement(node: CanvasNode) {
  const action = normalizeNodeAction(node.action);
  if (!action) return "";
  const target = escapeMermaidStringLiteral(nodeActionTarget(action));
  const tooltip = escapeMermaidStringLiteral(action.tooltip || (action.kind === "url" ? "打开链接" : "打开文件"));
  return `  click ${node.id} href "${target}" "${tooltip}" _blank`;
}

function serializeEdgeProperties(edge: CanvasEdge) {
  const fields: string[] = [];
  if (edge.animation && edge.animation !== "none") {
    if (edge.animation === "on") fields.push("animate: true");
    else fields.push(`animation: ${edge.animation}`);
  }
  if (edge.curve) fields.push(`curve: ${edge.curve}`);
  return fields.join(", ");
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
