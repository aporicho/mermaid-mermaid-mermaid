import type { CanvasEdge, CanvasNode, GraphDirection, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

const NODE_COLORS = [
  "#ffffff",
  "#e8f4f0",
  "#fff2d9",
  "#f8e3e6",
  "#e7eef9",
  "#edf0f2",
  "#f1eadf",
  "#e9e4f5"
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
  return value.trim().replace(/^["']|["']$/g, "");
}

function cleanNodeId(value: string) {
  const cleaned = value.trim().replace(/[^\w-]/g, "_");
  if (!cleaned) return `Node_${Date.now()}`;
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `Node_${cleaned}`;
}

function parseNodeToken(raw: string) {
  const token = raw.trim().replace(/;$/, "");
  const match = token.match(
    /^([A-Za-z][\w-]*)(?:\s*(?:\[\[([^\]]+)\]\]|\(\(([^)]+)\)\)|\(\[([^)]+)\]\)|\{([^}]+)\}|\[([^\]]+)\]|\(([^)]+)\)))?/
  );

  if (!match) return null;

  return {
    id: match[1],
    label: normalizeLabel(match[2] || match[3] || match[4] || match[5] || match[6] || match[7] || "")
  };
}

export function toSafeNodeId(value: string, existingIds: string[], fallback = "Node") {
  const base = cleanNodeId(value || fallback);
  if (!existingIds.includes(base)) return base;

  let index = 2;
  while (existingIds.includes(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function createNode(existingNodes: CanvasNode[], x = 160, y = 120): CanvasNode {
  const id = toSafeNodeId(`Node${existingNodes.length + 1}`, existingNodes.map((node) => node.id));
  return {
    id,
    label: "新节点",
    x,
    y,
    fill: NODE_COLORS[existingNodes.length % NODE_COLORS.length]
  };
}

export function parseMermaid(source: string, previous?: MermaidGraph): MermaidGraph {
  const nodes = new Map<string, CanvasNode>();
  const edges: CanvasEdge[] = [];
  const lines = source.split(/\r?\n/);
  const flowLine = lines.find((line) => /^\s*(flowchart|graph)\s+/i.test(line));
  const direction = ((flowLine?.trim().split(/\s+/)[1] || "LR") as GraphDirection) || "LR";

  function ensureNode(id: string, label?: string) {
    const old = previous?.nodes.find((node) => node.id === id);

    if (!nodes.has(id)) {
      const index = nodes.size;
      nodes.set(id, {
        id,
        label: label || old?.label || id,
        x: old?.x ?? 120 + (index % 3) * 250,
        y: old?.y ?? 120 + Math.floor(index / 3) * 150,
        fill: old?.fill || NODE_COLORS[index % NODE_COLORS.length]
      });
    } else if (label) {
      nodes.get(id)!.label = label;
    }
  }

  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith("%%") || /^(flowchart|graph)\s+/i.test(clean)) continue;

    const edgeMatch = clean.match(/^(.*?)\s*(-{1,3}>|={1,3}>|-->|---)\s*(.*)$/);
    if (edgeMatch) {
      const left = parseNodeToken(edgeMatch[1]);
      let rightRaw = edgeMatch[3].trim().replace(/;$/, "");
      let label = "";
      const labelMatch = rightRaw.match(/^\|([^|]*)\|\s*(.*)$/);

      if (labelMatch) {
        label = normalizeLabel(labelMatch[1]);
        rightRaw = labelMatch[2].trim();
      }

      const right = parseNodeToken(rightRaw);
      if (left && right) {
        ensureNode(left.id, left.label);
        ensureNode(right.id, right.label);
        edges.push({
          id: `${left.id}_${right.id}_${edges.length}`,
          from: left.id,
          to: right.id,
          label
        });
      }
      continue;
    }

    const node = parseNodeToken(clean);
    if (node) ensureNode(node.id, node.label);
  }

  return {
    direction,
    nodes: [...nodes.values()],
    edges
  };
}

function escapeMermaidLabel(value: string) {
  return value.replace(/"/g, '\\"');
}

export function serializeMermaid(graph: MermaidGraph) {
  const lines = [`flowchart ${graph.direction || "LR"}`];
  const connected = new Set<string>();

  for (const edge of graph.edges) {
    const from = graph.nodes.find((node) => node.id === edge.from);
    const to = graph.nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;

    connected.add(from.id);
    connected.add(to.id);
    const edgeText = edge.label ? `-->|${escapeMermaidLabel(edge.label)}|` : "-->";
    lines.push(
      `  ${from.id}["${escapeMermaidLabel(from.label)}"] ${edgeText} ${to.id}["${escapeMermaidLabel(to.label)}"]`
    );
  }

  for (const node of graph.nodes) {
    if (!connected.has(node.id)) {
      lines.push(`  ${node.id}["${escapeMermaidLabel(node.label)}"]`);
    }
  }

  return lines.join("\n");
}
