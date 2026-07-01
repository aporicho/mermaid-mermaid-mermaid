import type {
  CanvasEdge,
  EdgeAnimation,
  EdgeMarker,
  EdgeStyle
} from "@/features/mermaid-editor/lib/editor-types";

import { parseNodeToken } from "./node-token";
import {
  normalizeLabel,
  readObjectFields,
  uniqueStrings
} from "./syntax";
import type {
  ParsedEdgeOperator,
  ParsedEdgeStatement,
  ParsedNodeToken,
  PendingClassStatement,
  PendingEdgeProperty,
  PendingLinkStyle
} from "./types";

const EDGE_OPERATOR_SCAN_PATTERN = /(?:\b[A-Za-z][\w-]*@)?[<ox]?(?:-\.{1,}-|-{2,}|={2,}|~~~)[>ox]?/g;
const EDGE_ID_PREFIX_PATTERN = /^([A-Za-z][\w-]*)@/;
const MERMAID_CURVES = new Set([
  "basis",
  "bumpX",
  "bumpY",
  "cardinal",
  "catmullRom",
  "linear",
  "monotoneX",
  "monotoneY",
  "natural",
  "step",
  "stepAfter",
  "stepBefore"
]);

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

export function edgeMarkerStart(edge: Pick<CanvasEdge, "markerStart">): EdgeMarker {
  return normalizeEdgeMarker(edge.markerStart, "none");
}

export function edgeMarkerEnd(edge: Pick<CanvasEdge, "markerEnd" | "arrowType">): EdgeMarker {
  return normalizeEdgeMarker(edge.markerEnd || edge.arrowType, "arrow");
}

export function parseEdgeOperator(rawOperator: string): ParsedEdgeOperator | null {
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

export function edgeOperatorFromSemantics(edge: Pick<CanvasEdge, "style" | "arrowType" | "markerStart" | "markerEnd" | "minLength" | "mermaidId">) {
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

export function parseEdgeStatements(clean: string): ParsedEdgeStatement[] | null {
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
    .filter((token): token is ParsedNodeToken => Boolean(token));
}

export function parseEdgePropertyStatement(clean: string): PendingEdgeProperty | null {
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

export function parseLinkStyleStatement(clean: string): PendingLinkStyle | null {
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

export function parseClassStatement(clean: string): PendingClassStatement | null {
  const match = clean.match(/^class\s+(.+?)\s+(.+?);?$/i);
  if (!match) return null;

  const ids = match[1].split(",").map((value) => value.trim()).filter(Boolean);
  const classes = match[2].split(/[,\s]+/).map((value) => value.trim()).filter(Boolean);
  if (!ids.length || !classes.length) return null;

  return { ids, classes, raw: clean };
}

export function applyEdgeMetadata(
  edges: CanvasEdge[],
  properties: PendingEdgeProperty[],
  linkStyles: PendingLinkStyle[],
  classStatements: PendingClassStatement[]
) {
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

export function serializeEdgeProperties(edge: CanvasEdge) {
  const fields: string[] = [];
  if (edge.animation && edge.animation !== "none") {
    if (edge.animation === "on") fields.push("animate: true");
    else fields.push(`animation: ${edge.animation}`);
  }
  if (edge.curve) fields.push(`curve: ${edge.curve}`);
  return fields.join(", ");
}
