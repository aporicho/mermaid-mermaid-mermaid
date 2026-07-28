import { buildMermaidDocument } from "@/features/mermaid-editor/lib/mermaid-document";
import { serializeMermaid } from "@/features/mermaid-editor/lib/mermaid-graph";
import type { CanvasEdge, CanvasNode, CanvasSubgraph, MermaidGraph } from "@/features/mermaid-editor/lib/editor-types";

export type PerformanceFixtureSize = 100 | 300 | 800;

export const PERFORMANCE_FIXTURE_SIZES: PerformanceFixtureSize[] = [100, 300, 800];
export const MIXED_PERFORMANCE_FIXTURE_NODE_COUNT = 120;

const NODE_GAP_X = 220;
const NODE_GAP_Y = 130;
const GROUP_SIZE = 25;

export function createPerformanceFixtureGraph(size: PerformanceFixtureSize): MermaidGraph {
  const columns = columnsForSize(size);
  const nodes = buildFixtureNodes(size, columns);
  const edges = buildFixtureEdges(size, columns);
  const subgraphs = buildFixtureSubgraphs(size);

  return {
    diagramType: "flowchart",
    editableKind: "flowchart",
    parseStatus: "parsed",
    direction: "LR",
    nodes,
    edges,
    subgraphs
  };
}

export function createPerformanceFixtureDocument(size: PerformanceFixtureSize) {
  const graph = createPerformanceFixtureGraph(size);
  return buildMermaidDocument(serializeMermaid(graph), graph, { x: 120, y: 90, scale: 0.7 }, "bezier", "manual");
}

export function createMixedPerformanceFixtureGraph(): MermaidGraph {
  const nodes = Array.from({ length: MIXED_PERFORMANCE_FIXTURE_NODE_COUNT }, (_, index) => mixedFixtureNode(index));
  const edges: CanvasEdge[] = nodes.slice(0, -1).map((node, index) => ({
    id: `ME${index + 1}`,
    from: node.id,
    to: nodes[index + 1].id,
    label: index % 12 === 0 ? `混合步骤 ${index + 1}` : "",
    style: "solid",
    arrowType: "arrow"
  }));
  return {
    diagramType: "flowchart",
    editableKind: "flowchart",
    parseStatus: "parsed",
    direction: "LR",
    nodes,
    edges,
    subgraphs: []
  };
}

function buildFixtureNodes(size: PerformanceFixtureSize, columns: number): CanvasNode[] {
  return Array.from({ length: size }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: fixtureNodeId(index),
      label: `节点 ${index + 1}`,
      x: column * NODE_GAP_X,
      y: row * NODE_GAP_Y,
      fill: index % 7 === 0 ? "#fff2d9" : index % 5 === 0 ? "#e8f4f0" : "#ffffff",
      shape: index % 11 === 0 ? "rounded" : index % 13 === 0 ? "diam" : undefined
    };
  });
}

function buildFixtureEdges(size: PerformanceFixtureSize, columns: number): CanvasEdge[] {
  const edges: CanvasEdge[] = [];

  for (let index = 0; index < size - 1; index += 1) {
    edges.push({
      id: `E${edges.length}`,
      from: fixtureNodeId(index),
      to: fixtureNodeId(index + 1),
      label: index % 10 === 0 ? `步骤 ${index + 1}` : "",
      style: index % 9 === 0 ? "dotted" : index % 7 === 0 ? "thick" : "solid",
      arrowType: index % 17 === 0 ? "circle" : "arrow"
    });
  }

  for (let index = 0; index + columns < size; index += 3) {
    edges.push({
      id: `E${edges.length}`,
      from: fixtureNodeId(index),
      to: fixtureNodeId(index + columns),
      label: "",
      style: "solid",
      arrowType: "arrow"
    });
  }

  return edges;
}

function buildFixtureSubgraphs(size: PerformanceFixtureSize): CanvasSubgraph[] {
  const groups = Math.ceil(size / GROUP_SIZE);
  return Array.from({ length: groups }, (_, groupIndex) => {
    const start = groupIndex * GROUP_SIZE;
    const end = Math.min(size, start + GROUP_SIZE);
    return {
      id: `Group${groupIndex + 1}`,
      title: `分区 ${groupIndex + 1}`,
      nodeIds: range(start, end).map(fixtureNodeId)
    };
  });
}

function columnsForSize(size: PerformanceFixtureSize) {
  return size === 100 ? 10 : size === 300 ? 18 : 32;
}

function fixtureNodeId(index: number) {
  return `N${index + 1}`;
}

function range(start: number, end: number) {
  return Array.from({ length: end - start }, (_, offset) => start + offset);
}

function mixedFixtureNode(index: number): CanvasNode {
  const column = index % 12;
  const row = Math.floor(index / 12);
  const base = {
    id: `M${index + 1}`,
    label: `混合节点 ${index + 1}`,
    x: column * 500,
    y: row * 700,
    fill: "#ffffff"
  } satisfies CanvasNode;

  if (index < 40) {
    return {
      ...base,
      label: index % 3 === 0 ? `包含多行内容的性能节点 ${index + 1}\n用于验证静态文字缓存` : base.label,
      shape: index % 5 === 0 ? "cyl" : index % 7 === 0 ? "doc" : index % 3 === 0 ? "rounded" : "rect",
      ...(index % 9 === 0 ? { action: { kind: "url" as const, url: `https://example.com/${index}`, openMode: "app-browser" as const } } : {})
    };
  }

  if (index < 60) {
    const source = mixedFixtureImageSource(index);
    return {
      ...base,
      label: `原图 ${index - 39}`,
      asset: {
        kind: "image",
        src: source,
        width: 320,
        height: 320,
        preserveAspectRatio: true,
        labelPosition: "bottom"
      }
    };
  }

  if (index < 80) {
    const source = mixedFixtureImageSource(index);
    return {
      ...base,
      label: `小红书卡片 ${index - 59}`,
      preview: {
        kind: "link-card",
        pluginId: "xiaohongshu",
        provider: "小红书",
        sourceUrl: `https://www.xiaohongshu.com/explore/fixture-${index}`,
        title: `不降低封面分辨率的缓存性能测试 ${index - 59}`,
        status: "ready",
        cover: { src: source, width: 2048, height: 2048, persistent: true }
      }
    };
  }

  if (index < 96) {
    return {
      ...base,
      label: `Markdown 性能文档 ${index - 79}`,
      action: { kind: "file", path: `fixtures/document-${index}.md`, openMode: "app-window" }
    };
  }

  if (index < 108) {
    return {
      ...base,
      label: `HTML 性能文档 ${index - 95}`,
      action: { kind: "file", path: `fixtures/page-${index}.html`, openMode: "app-window" }
    };
  }

  return {
    ...base,
    label: `表格性能节点 ${index - 107}`,
    content: mixedFixtureTable(index)
  };
}

function mixedFixtureImageSource(index: number) {
  const variant = index % 12;
  const hue = (variant * 31) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 72% 64%)"/><stop offset="1" stop-color="hsl(${(hue + 120) % 360} 60% 22%)"/></linearGradient></defs><rect width="2048" height="2048" fill="url(#g)"/><circle cx="1024" cy="1024" r="620" fill="none" stroke="white" stroke-width="48"/><text x="1024" y="1080" text-anchor="middle" font-size="240" font-family="sans-serif" fill="white">${variant + 1}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mixedFixtureTable(seed: number): NonNullable<CanvasNode["content"]> {
  const columns = Array.from({ length: 6 }, (_, index) => ({
    id: `c${index + 1}`,
    label: `字段 ${index + 1}`,
    width: 120 + (index % 3) * 24,
    align: index === 0 ? "left" as const : "center" as const
  }));
  const rows = Array.from({ length: 12 }, (_, rowIndex) => ({
    id: `r${rowIndex + 1}`,
    cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, `数据 ${seed}-${rowIndex + 1}-${columnIndex + 1}`]))
  }));
  return { kind: "table", version: 1, columns, rows };
}
