import type {
  CanvasNode,
  CanvasNodeAsset,
  FlowchartNodeShape
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

import type { ParsedNodeToken } from "./types";
import { escapeMermaidLabel, normalizeLabel, readObjectFields } from "./syntax";

export function parseNodeToken(raw: string): ParsedNodeToken | null {
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

export function serializeNodeToken(node: CanvasNode) {
  const label = escapeMermaidLabel(node.label || node.id);
  const asset = normalizeImageAsset(node.asset);
  if (asset) {
    return `${node.id}@{ img: "${escapeMermaidLabel(asset.src)}", label: "${label}", pos: "${mermaidImagePosition(asset.labelPosition)}", w: ${asset.width}, h: ${asset.height}, constraint: "${asset.preserveAspectRatio ? "on" : "off"}" }`;
  }

  const shape = node.shape || DEFAULT_FLOWCHART_NODE_SHAPE;

  return `${node.id}@{ shape: ${shape}, label: "${label}" }`;
}
